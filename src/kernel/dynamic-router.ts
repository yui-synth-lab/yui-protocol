import { BaseAgent } from '../agents/base-agent.js';
import { FacilitatorAgent } from '../agents/facilitator-agent.js';
import { Message, Session, Agent, AgentResponse, SessionConsensusSnapshot, AgentConsensusData } from '../types/index.js';
import { ConsensusIndicator, DialogueState, DynamicRound, FacilitatorAction, DynamicInstruction } from '../types/consensus.js';
import { RAGRetriever } from './rag/rag-retriever.js';
import { SessionStorage } from './session-storage.js';
import { Language } from '../templates/prompts.js';
import { createFacilitatorMessage, createConsensusMessage } from '../utils/message-converters.js';
import { createConvergenceMessage, createVotingStartMessage, createVotingResultMessage } from '../utils/convergence-messages.js';
import { createCollaborationIntroMessage, createCollaborationProgressMessage, createCollaborationSummaryMessage } from '../utils/collaboration-messages.js';
import { getRoundGuidanceText, v2PromptTemplates } from '../templates/v2-prompts.js';
import { getV2ConsensusConfig } from '../config/v2-config-loader.js';

export class DynamicDialogueRouter {
  private facilitator: FacilitatorAgent;
  private maxRounds: number;
  private convergenceThreshold: number;
  private sessionStorage: SessionStorage;
  private activeConsensusChecks = new Set<string>(); // 重複実行防止
  private wsEmitter?: (event: string, data: any) => void; // WebSocket emitter
  private originalQuery: string = ''; // 初期クエリを保持
  private recentSpeakers: string[] = []; // 最近発言したエージェントを追跡
  private agentParticipationCount: Map<string, number> = new Map(); // エージェントの発言回数
  private initialThoughts: Message[] = []; // Individual Thoughtの結果を保持
  private currentRound: number = 0; // 現在のラウンド番号
  private ragRetriever?: RAGRetriever; // v2.0: RAG不協和音検出用

  constructor(
    sessionStorage: SessionStorage,
    wsEmitter?: (event: string, data: any) => void,
    ragRetriever?: RAGRetriever // v2.0: RAG不協和音検出用（オプショナル）
  ) {
    this.facilitator = new FacilitatorAgent();
    this.sessionStorage = sessionStorage;
    this.wsEmitter = wsEmitter;
    this.ragRetriever = ragRetriever;

    // Load configuration
    const consensusConfig = getV2ConsensusConfig();
    this.maxRounds = consensusConfig.maxRounds;
    this.convergenceThreshold = consensusConfig.convergenceThreshold;
  }

  async conductDynamicDialogue(
    initialQuery: string,
    agents: Record<string, BaseAgent>,
    sessionId: string,
    language: Language = 'en'
  ): Promise<Session> {
    let round = 0;
    let converged = false;
    const messages: Message[] = [];
    const agentList = Object.values(agents);
    let lastConsensusData: ConsensusIndicator[] = [];

    // 初期クエリを保持
    this.originalQuery = initialQuery;

    // 状態をリセット
    this.recentSpeakers = [];
    this.agentParticipationCount.clear();
    this.initialThoughts = []; // Initial Thoughtをリセット
    this.currentRound = 0; // ラウンド番号をリセット
    agentList.forEach(agent => {
      this.agentParticipationCount.set(agent.getAgent().id, 0);
    });

    // ファシリテーターをセッション用に初期化（存在する場合のみ）
    if (this.facilitator.initializeSession) {
      this.facilitator.initializeSession(sessionId);
    }

    // セッション初期化
    let session = await this.initializeSession(sessionId, initialQuery, agentList, language);

    // 初期ユーザーメッセージを追加
    const userMessage: Message = {
      id: this.generateMessageId(),
      agentId: 'user',
      content: initialQuery,
      timestamp: new Date(),
      role: 'user',
      sequenceNumber: 1
    };
    messages.push(userMessage);
    session = await this.updateSession(session, messages); // リアルタイム更新

    // 初期応答を取得（各応答が完了するたびにWebSocketで送信）
    console.log(`[DynamicRouter] Getting initial responses for: "${initialQuery}"`);
    const initialResponses = await this.getInitialResponses(initialQuery, agentList, messages, language, sessionId);
    messages.push(...initialResponses);

    // Individual Thoughtの結果を保持
    this.initialThoughts = initialResponses.filter(m => m.stage === 'individual-thought');
    console.log(`[DynamicRouter] Preserved ${this.initialThoughts.length} initial thoughts for future reference`);

    session = await this.updateSession(session, messages); // リアルタイム更新

    // Note: Round 0ファシリテーター処理を削除
    // 初期応答直後のファシリテーター実行は不要（Round 1で即座に実行されるため）
    // これによりAI API呼び出しを削減し、より自然な対話フローを実現

    while (!converged && round < this.maxRounds) {
      round++;
      this.currentRound = round; // 現在のラウンドを更新
      console.log(`[DynamicRouter] Starting round ${round}`);

      // Emit round start event
      this.emitWebSocketEvent('v2-round-start', {
        sessionId,
        round,
        timestamp: new Date().toISOString()
      });

      // Round 1以降のみコンセンサス分析を実行（初回ファシリテーター判断後）
      let consensusData: any[] = [];
      let dialogueState: any;

      if (round === 1 && messages.length <= 2) {
        // 初回ラウンド：コンセンサス分析をスキップしてファシリテーター判断のみ
        dialogueState = await this.facilitator.analyzeDialogueState(messages, [], round, this.originalQuery);
        lastConsensusData = [];
      } else {
        // 通常ラウンド：コンセンサス分析を実行
        consensusData = await this.gatherConsensus(agentList, messages, language, round);
        lastConsensusData = consensusData;
        // ファシリテーターに発言数を同期
        this.facilitator.updateParticipationCount(this.agentParticipationCount);
        dialogueState = await this.facilitator.analyzeDialogueState(messages, consensusData, round, this.originalQuery);

        // Calculate actual overall consensus from the consensus data
        const calculatedOverallConsensus = this.facilitator.calculateOverallConsensus(consensusData);
        dialogueState.overallConsensus = calculatedOverallConsensus;

        // Save consensus data to session
        await this.saveConsensusSnapshot(session, round, consensusData, dialogueState);

        // コンセンサス情報をメッセージとして追加
        const consensusMessage = createConsensusMessage(
          session.consensusHistory![session.consensusHistory!.length - 1],
          sessionId,
          agentList.map(a => a.getAgent())
        );
        messages.push(consensusMessage);

        // Emit consensus update
        this.emitWebSocketEvent('v2-consensus-update', {
          sessionId,
          consensusLevel: dialogueState.overallConsensus,
          round
        });

        // コンセンサスメッセージをWebSocketで送信
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message: consensusMessage,
          round
        });
      }

      // 収束判定 - より厳密な条件
      const readyToMoveCount = consensusData.length > 0 ? consensusData.filter(c => c.readyToMove).length : 0;
      const averageSatisfaction = consensusData.length > 0 ?
        consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length : 0;
      const totalAgentsChecked = consensusData.length;
      const majorityThreshold = Math.ceil(totalAgentsChecked / 2);

      // 初回ラウンドはコンセンサスデータがないため収束判定をスキップ
      if (totalAgentsChecked > 0 && (
        !dialogueState.shouldContinue ||
        (dialogueState.overallConsensus >= 7.0 && round >= 3) ||
        (averageSatisfaction >= 8.0 && readyToMoveCount >= majorityThreshold && round >= 2))) {
        console.log(`[DynamicRouter] Convergence reached. Consensus: ${dialogueState.overallConsensus}, Satisfaction: ${averageSatisfaction}, Ready: ${readyToMoveCount}/${totalAgentsChecked}, Round: ${round}`);

        // 収束理由を判定
        let convergenceReason: 'natural_consensus' | 'max_rounds' | 'facilitator_decision' | 'high_satisfaction';
        if (averageSatisfaction >= 8.0 && readyToMoveCount >= majorityThreshold) {
          convergenceReason = 'natural_consensus';
        } else if (!dialogueState.shouldContinue) {
          convergenceReason = 'facilitator_decision';
        } else if (dialogueState.overallConsensus >= 7.0 && round >= 3) {
          convergenceReason = 'high_satisfaction';
        } else {
          convergenceReason = 'natural_consensus';
        }

        // 収束説明メッセージを追加
        const convergenceMessage = createConvergenceMessage(
          convergenceReason,
          round,
          dialogueState.overallConsensus,
          readyToMoveCount,
          consensusData.length,
          sessionId,
          language,
          `平均満足度: ${averageSatisfaction.toFixed(1)}/10`
        );
        messages.push(convergenceMessage);

        // WebSocketで収束メッセージを送信
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message: convergenceMessage,
          round
        });

        converged = true;
        break;
      }

      // ファシリテーター介入
      for (const action of dialogueState.suggestedActions.slice(0, 2)) {
        this.emitWebSocketEvent('v2-facilitator-action', {
          sessionId,
          action: action.type,
          target: action.target,
          reason: action.reason
        });
      }

      // ファシリテーターアクションの簡略化メッセージを追加
      const facilitatorMessage = this.createFacilitatorActionMessage(
        sessionId,
        dialogueState,
        round,
        language
      );
      if (facilitatorMessage) {
        messages.push(facilitatorMessage);

        // Emit facilitator message via WebSocket
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message: facilitatorMessage,
          round
        });
      }

      const nextActions = await this.executeActions(
        dialogueState.suggestedActions,
        agentList,
        messages,
        language,
        dialogueState.recommendedActionCount
      );
      messages.push(...nextActions);

      // Emit new messages
      for (const message of nextActions) {
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message,
          round
        });
      }

      // ラウンド記録
      const roundRecord: DynamicRound = {
        roundId: round,
        topic: dialogueState.currentTopic,
        messages: nextActions,
        consensusData,
        facilitatorActions: dialogueState.suggestedActions,
        duration: 0 // 実装時に計測
      };
      this.facilitator.recordRound(roundRecord);

      // セッション更新（各ラウンド後）
      session = await this.updateSession(session, messages);
    }

    // ループ終了時の理由判定
    if (round >= this.maxRounds) {
      console.log(`[DynamicRouter] Max rounds reached: ${round}`);

      // 最大ラウンド到達メッセージを追加
      const maxRoundsMessage = createConvergenceMessage(
        'max_rounds',
        round,
        lastConsensusData ? this.facilitator.calculateOverallConsensus(lastConsensusData) : 0,
        lastConsensusData ? lastConsensusData.filter(c => c.readyToMove).length : 0,
        lastConsensusData ? lastConsensusData.length : 0,
        sessionId,
        language,
        `設定された最大ラウンド数 (${this.maxRounds}) に到達`
      );
      messages.push(maxRoundsMessage);

      // WebSocketで最大ラウンドメッセージを送信
      this.emitWebSocketEvent('v2-message', {
        sessionId,
        message: maxRoundsMessage,
        round
      });
    }

    // 最終統合
    console.log(`[DynamicRouter] Generating final output after ${round} rounds`);
    const finalOutput = await this.generateFinalOutput(messages, agentList, language, sessionId, round);
    if (finalOutput) {
      messages.push(finalOutput);

      // Emit final message
      this.emitWebSocketEvent('v2-message', {
        sessionId,
        message: finalOutput,
        round: round
      });
    }

    // 最終セッション更新とメタデータ追加
    session = await this.updateSession(session, messages);
    session.status = 'concluded'; // v2では concluded ステータスで完全終了
    session.metadata = {
      totalRounds: round,
      finalConsensus: lastConsensusData?.length > 0
        ? lastConsensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / lastConsensusData.length
        : 0
    };

    // ファシリテーターログを保存
    console.log(`[DynamicRouter] Session finalized with consensus data`);

    // ファシリテーターログをファイルにも保存
    await this.saveFacilitatorLogs(sessionId);

    await this.sessionStorage.saveSession(session);

    return session;
  }

  private async initializeSession(
    sessionId: string,
    query: string,
    agents: BaseAgent[],
    language: Language
  ): Promise<Session> {
    const session: Session = {
      id: sessionId,
      title: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
      agents: agents.map(a => a.getAgent()),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      currentStage: 'individual-thought',
      stageHistory: [],
      language,
      version: '2.0', // Dynamic router is for v2.0
      sequenceNumber: 1
    };

    return session;
  }

  private async getInitialResponses(
    query: string,
    agents: BaseAgent[],
    context: Message[],
    language: Language,
    sessionId: string
  ): Promise<Message[]> {
    const responses: Message[] = [];

    // ファシリテーターに発言順序を決定させる
    console.log(`[DynamicRouter] Asking facilitator to determine speaking order...`);
    const agentInfos = agents.map(a => ({
      id: a.getAgent().id,
      name: a.getAgent().name,
      style: a.getAgent().style,
      expertise: a.getAgent().expertise || []
    }));

    const speakingOrder = await this.facilitator.determineInitialSpeakingOrder(query, agentInfos);
    console.log(`[DynamicRouter] Speaking order determined: ${speakingOrder.join(' → ')}`);

    // 決定された順序でエージェントに順次発言させる
    for (let i = 0; i < speakingOrder.length; i++) {
      const agentId = speakingOrder[i];
      const agent = agents.find(a => a.getAgent().id === agentId);

      if (!agent) {
        console.warn(`[DynamicRouter] Agent ${agentId} not found in agent list`);
        continue;
      }

      try {
        console.log(`[DynamicRouter] ${i + 1}/${speakingOrder.length}: Getting initial response from ${agent.getAgent().name}`);

        // これまでの発言を含むコンテキストを構築（自分より前のエージェントの発言のみ）
        const previousResponses = responses.slice(); // これまでのすべての応答
        const enrichedContext = [...context, ...previousResponses];

        const response = await agent.stage1IndividualThought(query, enrichedContext, language);

        const message: Message = {
          id: this.generateMessageId(),
          agentId: agent.getAgent().id,
          content: response.content,
          timestamp: new Date(),
          role: 'agent',
          stage: 'individual-thought',
          sequenceNumber: i + 1,
          metadata: {
            reasoning: response.reasoning,
            confidence: 0.8,
            references: agent.getAgent().references || [],
            stageData: response,
            speakingOrder: i + 1,
            totalSpeakers: speakingOrder.length,
            previousSpeakers: speakingOrder.slice(0, i)
          }
        };

        // 初期応答でも参加カウントを追跡
        this.trackAgentParticipation(agent.getAgent().id);

        responses.push(message);

        // Emit each response immediately via WebSocket
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message,
          round: 0, // Initial responses are round 0
          speakingOrder: {
            current: i + 1,
            total: speakingOrder.length,
            agentName: agent.getAgent().name
          }
        });

        console.log(`[DynamicRouter] Sent initial response ${i + 1}/${speakingOrder.length} from ${agent.getAgent().name} via WebSocket`);
      } catch (error) {
        console.error(`[DynamicRouter] Error getting response from ${agent.getAgent().name}:`, error);
      }
    }

    return responses;
  }

  private async gatherConsensus(
    agents: BaseAgent[],
    messages: Message[],
    language: Language,
    currentRound: number = 0
  ): Promise<ConsensusIndicator[]> {
    const consensusData: ConsensusIndicator[] = [];

    // エージェントの順番をランダムにシャッフル
    const shuffledAgents = [...agents].sort(() => Math.random() - 0.5);
    const totalAgents = shuffledAgents.length;
    const majorityThreshold = Math.ceil(totalAgents / 2); // 過半数

    console.log(`[DynamicRouter] Starting optimized consensus gathering - checking up to ${totalAgents} agents, early exit at ${majorityThreshold} continuing votes`);

    let continuingVotes = 0;
    let checkedAgents = 0;

    for (const agent of shuffledAgents) {
      const agentKey = `${agent.getAgent().id}-consensus`;

      // 重複実行チェック
      if (this.activeConsensusChecks.has(agentKey)) {
        console.warn(`[DynamicRouter] Skipping duplicate consensus check for ${agent.getAgent().name}`);
        continue;
      }

      this.activeConsensusChecks.add(agentKey);

      try {
        const consensus = await this.askForConsensus(agent, messages, language, currentRound);
        consensusData.push(consensus);
        checkedAgents++;

        // 継続したいエージェントをカウント (readyToMove が false または hasAdditionalPoints が true)
        if (!consensus.readyToMove || consensus.hasAdditionalPoints) {
          continuingVotes++;
          console.log(`[DynamicRouter] ${agent.getAgent().name} wants to continue (ready:${consensus.readyToMove}, critical:${consensus.hasAdditionalPoints}) (${continuingVotes}/${checkedAgents})`);
        } else {
          console.log(`[DynamicRouter] ${agent.getAgent().name} ready to conclude (ready:${consensus.readyToMove}, critical:${consensus.hasAdditionalPoints}) (${continuingVotes}/${checkedAgents})`);
        }

        // 早期終了条件: 継続票が過半数を超えた時点で次ラウンドへ
        if (continuingVotes >= majorityThreshold) {
          console.log(`[DynamicRouter] Early exit: ${continuingVotes}/${checkedAgents} agents want to continue (majority reached)`);

          // 既に回答したエージェントの平均満足度を計算
          const actualResponses = consensusData.filter(c => !c.reasoning?.includes('Error occurred'));
          const avgSatisfaction = actualResponses.length > 0
            ? actualResponses.reduce((sum, c) => sum + c.satisfactionLevel, 0) / actualResponses.length
            : 6; // フォールバック値

          const avgHasAdditionalPoints = actualResponses.length > 0
            ? actualResponses.filter(c => c.hasAdditionalPoints).length / actualResponses.length
            : 0.5;

          console.log(`[DynamicRouter] Early exit estimation: avgSatisfaction=${avgSatisfaction.toFixed(1)}, avgHasAdditionalPoints=${(avgHasAdditionalPoints * 100).toFixed(0)}%`);

          // 残りのエージェントには推定値を追加（既存の平均値に基づく）
          for (let i = checkedAgents; i < totalAgents; i++) {
            const remainingAgent = shuffledAgents[i];
            consensusData.push({
              agentId: remainingAgent.getAgent().id,
              satisfactionLevel: Math.round(avgSatisfaction * 10) / 10, // 既存の平均値を使用
              hasAdditionalPoints: avgHasAdditionalPoints > 0.5, // 過半数が追加ポイントありなら true
              questionsForOthers: [],
              readyToMove: false, // 継続を仮定（過半数が継続票のため）
              reasoning: `Early exit - estimated based on ${actualResponses.length} actual responses (avg satisfaction: ${avgSatisfaction.toFixed(1)})`
            });
          }
          break;
        }

      } catch (error) {
        console.error(`[DynamicRouter] Error gathering consensus from ${agent.getAgent().name}:`, error);
        // フォールバック値
        consensusData.push({
          agentId: agent.getAgent().id,
          satisfactionLevel: 5,
          hasAdditionalPoints: false,
          questionsForOthers: [],
          readyToMove: true,
          reasoning: 'Error occurred during consensus gathering'
        });
        checkedAgents++;
      } finally {
        this.activeConsensusChecks.delete(agentKey);
      }
    }

    console.log(`[DynamicRouter] Consensus gathering completed: checked ${checkedAgents}/${totalAgents} agents, ${continuingVotes} want to continue`);
    return consensusData;
  }

  private async askForConsensus(
    agent: BaseAgent,
    messages: Message[],
    language: Language,
    currentRound: number = 0
  ): Promise<ConsensusIndicator> {
    const recentMessages = messages.slice(-5);
    const contextText = recentMessages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

    // Detect if topic is philosophical based on query content
    const philosophicalKeywords = ['時間', 'time', '存在', 'existence', '意識', 'consciousness', '本質', 'essence', '哲学', 'philosophy', '真理', 'truth', '永遠', 'eternity'];
    const isPhilosophical = philosophicalKeywords.some(keyword =>
      this.originalQuery.toLowerCase().includes(keyword.toLowerCase())
    );

    const roundGuidance = getRoundGuidanceText(currentRound, isPhilosophical);
    const additionalGuidance = currentRound <= 2 ?
      'NOTE: In early rounds, consider whether the discussion could benefit from more exploration and different perspectives before concluding.' :
      'Consider: A satisfaction level of 6+ with meaningful insights often indicates readiness for conclusion.';

    const promptTemplate = v2PromptTemplates.dynamic_consensus[language];
    const prompt = promptTemplate
      .replace('{originalQuery}', this.originalQuery)
      .replace('{currentRound}', currentRound.toString())
      .replace('{roundGuidance}', roundGuidance)
      .replace('{contextText}', contextText)
      .replace('{additionalGuidance}', additionalGuidance);

    const personality = (agent as any).getPersonalityPrompt(language);
    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'consensus-check' as any,
      'consensus gathering'
    );

    return this.parseConsensusResponse(response, agent.getAgent().id);
  }

  private parseConsensusResponse(response: string, agentId: string): ConsensusIndicator {
    // デフォルト値
    let satisfactionLevel = 5;
    let hasAdditionalPoints = false;
    let questionsForOthers: string[] = [];
    let readyToMove = false; // デフォルトをfalseに変更（慎重な判断）
    let reasoning = '';

    try {
      // 1. Try JSON parsing first
      const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]|\{\s*"[\s\S]*"\s*:\s*[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[0]);
          // Map JSON fields to ConsensusIndicator fields
          if (json.satisfaction) satisfactionLevel = Math.min(10, Math.max(1, parseInt(json.satisfaction)));

          // Map boolean fields
          if (json.readyToConclude !== undefined) readyToMove = json.readyToConclude;
          else if (json.readyToMove !== undefined) readyToMove = json.readyToMove; // Fallback

          if (json.additionalPoints !== undefined) hasAdditionalPoints = json.additionalPoints;
          else if (json.anotherRoundValuable !== undefined) hasAdditionalPoints = json.anotherRoundValuable;
          else if (json.hasAdditionalPoints !== undefined) hasAdditionalPoints = json.hasAdditionalPoints;

          if (json.questions && Array.isArray(json.questions)) questionsForOthers = json.questions;

          if (json.reasoning) reasoning = json.reasoning;

          // If successful, return immediately
          return {
            agentId,
            satisfactionLevel,
            hasAdditionalPoints,
            questionsForOthers,
            readyToMove,
            reasoning
          };
        } catch (e) {
          console.warn(`[DynamicRouter] JSON parsing failed for ${agentId}, falling back to text parsing`, e);
        }
      }

      // 2. Fallback to Text Parsing
      const lines = response.split('\n');
      let capturingReasoning = false;
      let reasoningLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        if (trimmed.startsWith('Satisfaction:')) {
          const match = trimmed.match(/(\d+)/);
          if (match) satisfactionLevel = Math.min(10, Math.max(1, parseInt(match[1])));
          capturingReasoning = false;
        } else if (trimmed.startsWith('Meaningful insights:')) {
          // 新しいフォーマットでは meaningful insights を評価
          const hasMeaningfulInsights = trimmed.toLowerCase().includes('yes');
          // 意味ある洞察は満足度の指標であり、追加議論の必要性とは別
          // hasAdditionalPointsは別途Critical pointsで判定する
          capturingReasoning = false;
        } else if (trimmed.startsWith('Ready to conclude:')) {
          readyToMove = trimmed.toLowerCase().includes('yes');
          capturingReasoning = false;
        } else if (trimmed.startsWith('Critical points remaining:')) {
          // 重要な未討論ポイントがある場合、継続が必要
          const hasCriticalPoints = trimmed.toLowerCase().includes('yes');
          if (hasCriticalPoints) {
            readyToMove = false; // 重要ポイントがあれば継続
            hasAdditionalPoints = true;
          }
          capturingReasoning = false;
        } else if (trimmed.startsWith('Reasoning:')) {
          // Reasoning の開始
          const firstLine = trimmed.replace('Reasoning:', '').trim();
          if (firstLine) {
            reasoningLines.push(firstLine);
          }
          capturingReasoning = true;
        } else if (capturingReasoning && trimmed) {
          // Reasoning の続き（空行でない場合）
          // 次のフィールドの開始をチェック
          const isNextField = trimmed.match(/^(Satisfaction|Meaningful insights|Ready to conclude|Critical points remaining|New insights|Another round):/i);
          if (isNextField) {
            capturingReasoning = false;
            // このラインは次のイテレーションで処理される
            i--; // ループカウンタを戻す
          } else {
            reasoningLines.push(trimmed);
          }
        }
      }

      // Reasoning を結合
      const textReasoning = reasoningLines.join(' ').trim();
      if (textReasoning) {
        reasoning = textReasoning;
      }

      // 満足度ベースの自動判定ロジック強化
      if (satisfactionLevel >= 7 && hasAdditionalPoints && !readyToMove) {
        // 高満足度でも継続希望の場合、満足度を基準に判断を調整
        console.log(`[DynamicRouter] ${agentId}: High satisfaction (${satisfactionLevel}) detected, considering readiness adjustment`);
      }

    } catch (error) {
      console.warn(`[DynamicRouter] Error parsing consensus response from ${agentId}:`, error);
    }

    return {
      agentId,
      satisfactionLevel,
      hasAdditionalPoints,
      questionsForOthers,
      readyToMove,
      reasoning
    };
  }

  private async executeActions(
    actions: any[],
    agents: BaseAgent[],
    messages: Message[],
    language: Language,
    recommendedActionCount?: number
  ): Promise<Message[]> {
    const newMessages: Message[] = [];

    // アクションを優先度順にソート
    const sortedActions = actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 実行するアクション数を決定（推奨値またはデフォルト2）
    const actionCount = recommendedActionCount || 2;
    const actionsToExecute = sortedActions.slice(0, actionCount);

    console.log(`[DynamicRouter] Executing ${actionsToExecute.length} actions (recommended: ${recommendedActionCount || 'default'})`);

    // アクションを逐次実行し、各アクションの結果を次のアクションのコンテキストに含める
    for (let i = 0; i < actionsToExecute.length; i++) {
      const action = actionsToExecute[i];
      try {
        console.log(`[DynamicRouter] Executing action ${i + 1}/${actionsToExecute.length}: ${action.type} (target: ${action.target || 'auto'})`);

        // 現在までのメッセージ配列（元のmessages + このラウンドで既に生成されたメッセージ）
        const currentContext = [...messages, ...newMessages];

        const actionMessages = await this.executeAction(action, agents, currentContext, language);
        newMessages.push(...actionMessages);

        console.log(`[DynamicRouter] Action ${i + 1} completed, generated ${actionMessages.length} message(s)`);
      } catch (error) {
        console.error(`[DynamicRouter] Error executing action ${action.type}:`, error);
      }
    }

    console.log(`[DynamicRouter] Total messages generated in this round: ${newMessages.length}`);
    return newMessages;
  }

  /**
   * RAGで類似の過去結論を検索し、「不協和音」として注入する指示を生成
   * v2.0: 過去の結論を「正解」ではなく、現在の議論を揺さぶる素材として使用
   */
  private async detectRAGDissonance(
    currentTopic: string,
    messages: Message[],
    minSimilarityThreshold: number = 0.75
  ): Promise<DynamicInstruction['ragDissonance'] | null> {
    if (!this.ragRetriever) {
      return null;
    }

    try {
      const recentContent = messages.slice(-5).map(m => m.content).join(' ');
      const queryText = `${currentTopic} ${recentContent.substring(0, 500)}`;

      const ragContext = await this.ragRetriever.retrieveEnhancedContext(queryText, {
        sourceType: ['session-history']
      });

      if (!ragContext || ragContext.retrievedKnowledge.length === 0) {
        return null;
      }

      const topResult = ragContext.retrievedKnowledge[0];

      if (topResult.score >= minSimilarityThreshold) {
        const pastConclusion = topResult.chunk.content.substring(0, 200);
        console.log(`[DynamicRouter] RAG dissonance found: similarity=${topResult.score.toFixed(2)}, source=${topResult.chunk.metadata.sessionId || 'unknown'}`);

        return {
          sourceSessionId: topResult.chunk.metadata.sessionId || 'unknown',
          sourceConclusionSummary: pastConclusion,
          similarityScore: topResult.score,
          deconstructionHint: `かつて「${pastConclusion}...」と結論づけられました。
しかし今の文脈で、この結論は不完全だったかもしれません。
何が変わったか？どんな新しい視点がこの理解に挑戦するか？
可能性Bを考慮してください。`
        };
      }

      return null;
    } catch (error) {
      console.error('[DynamicRouter] RAG dissonance detection failed:', error);
      return null;
    }
  }

  private async executeAction(
    action: FacilitatorAction,
    agents: BaseAgent[],
    messages: Message[],
    language: Language
  ): Promise<Message[]> {
    const newMessages: Message[] = [];
    let success = false;
    let errorMessage: string | undefined;
    const agentResponses: string[] = [];

    // v2.0: RAG不協和音チェック（動的指示がない場合のみ）
    if (!action.dynamicInstruction && this.ragRetriever) {
      const ragDissonance = await this.detectRAGDissonance(this.originalQuery, messages);

      if (ragDissonance) {
        action.dynamicInstruction = {
          content: ragDissonance.deconstructionHint,
          tone: 'deconstructive',
          ragDissonance,
          metadata: {
            triggerReason: 'rag_similarity',
            generatedAt: new Date()
          }
        };
        console.log(`[DynamicRouter] RAG dissonance detected (similarity: ${ragDissonance.similarityScore.toFixed(2)}), adding deconstructive instruction`);
      }
    }

    try {
      switch (action.type) {
        case 'deep_dive':
          let targetAgent: BaseAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            targetAgent = agents.find(a => a.getAgent().id === action.target);
            console.log(`[DynamicRouter] Deep dive target specified: ${action.target}, found: ${targetAgent ? 'yes' : 'no'}`);
          }
          if (!targetAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            targetAgent = this.selectBalancedAgent(agents);
            console.log(`[DynamicRouter] Deep dive target auto-selected: ${targetAgent.getAgent().id}`);
          }
          const deepDiveResponse = await this.askForDeepDive(targetAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(deepDiveResponse);
          agentResponses.push(`${targetAgent.getAgent().name}: ${deepDiveResponse.content.slice(0, 100)}...`);
          this.trackAgentParticipation(targetAgent.getAgent().id);
          console.log(`[DynamicRouter] Deep dive executed by ${targetAgent.getAgent().id}, new participation count: ${this.agentParticipationCount.get(targetAgent.getAgent().id)}`);
          success = true;
          break;

        case 'clarification':
          let clarifyAgent: BaseAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            clarifyAgent = agents.find(a => a.getAgent().id === action.target);
          }
          if (!clarifyAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            clarifyAgent = this.selectBalancedAgent(agents);
          }
          const clarificationResponse = await this.askForClarification(clarifyAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(clarificationResponse);
          agentResponses.push(`${clarifyAgent.getAgent().name}: ${clarificationResponse.content.slice(0, 100)}...`);
          this.trackAgentParticipation(clarifyAgent.getAgent().id);
          success = true;
          break;

        case 'perspective_shift':
          let perspectiveAgent: BaseAgent | undefined;
          if (action.target && action.target !== 'all' && action.target !== 'auto') {
            perspectiveAgent = agents.find(a => a.getAgent().id === action.target);
          }
          if (!perspectiveAgent) {
            // ターゲットが指定されていない、または見つからない場合はバランス良く選択
            perspectiveAgent = this.selectBalancedAgent(agents, undefined, true);
          }
          const perspectiveResponse = await this.askForPerspectiveShift(perspectiveAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(perspectiveResponse);
          agentResponses.push(`${perspectiveAgent.getAgent().name}: ${perspectiveResponse.content.slice(0, 100)}...`);
          this.trackAgentParticipation(perspectiveAgent.getAgent().id);
          success = true;
          break;

        case 'summarize':
          // 論理的スタイルを優先するが、発言バランスも考慮
          const summaryAgent = this.selectBalancedAgent(agents, 'logical', true);
          const summary = await this.askForSummary(summaryAgent, messages, language, action.dynamicInstruction);
          newMessages.push(summary);
          agentResponses.push(`${summaryAgent.getAgent().name}: ${summary.content.slice(0, 100)}...`);
          this.trackAgentParticipation(summaryAgent.getAgent().id);
          success = true;
          break;

        case 'redirect':
          // 発言バランスを考慮してエージェントを選んで元のトピックに戻す
          const redirectAgent = this.selectBalancedAgent(agents, undefined, true);
          const redirect = await this.askForRedirect(redirectAgent, action.reason, messages, language, action.dynamicInstruction);
          newMessages.push(redirect);
          agentResponses.push(`${redirectAgent.getAgent().name}: ${redirect.content.slice(0, 100)}...`);
          this.trackAgentParticipation(redirectAgent.getAgent().id);
          success = true;
          break;

        default:
          errorMessage = `Unknown action type: ${action.type}`;
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[DynamicRouter] Error executing action ${action.type}:`, error);
    }

    // Log the intervention
    this.facilitator.logIntervention(action, success, errorMessage, agentResponses);

    return newMessages;
  }

  private async askForDeepDive(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.buildFullContext(recentMessages, agent.getAgent().id);
    const contextNote = this.currentRound <= 2
      ? "including all agents' initial thoughts and recent discussion"
      : "from recent discussion";

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルでこのメタ指示を適用してください。
会話は自然に、150-200語で。問いや比喩で締めくくってください。
`;
    } else {
      instructionSection = `
FACILITATOR REQUEST: ${reason}

Based on the above context, please contribute your unique perspective to "${this.originalQuery}".

IMPORTANT GUIDELINES:
- Build directly on or respond to specific points made by other agents in the discussion
- Avoid generic openings like "皆さま" or "これまでの議論で"
- Reference specific ideas or arguments from the context when relevant
- Bring your unique ${agent.getAgent().style} perspective to advance the discussion
- Keep it conversational and engaging (150-200 words)
- End with a thought-provoking question or meaningful metaphor
`;
    }

    const prompt = `
CURRENT DISCUSSION: "${this.originalQuery}"

CONTEXT (${contextNote}):
${contextText}

${instructionSection}

Start your response naturally without formal greetings.
`;

    const personality = (agent as any).getPersonalityPrompt(language);

    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'deep-dive' as any,
      'deep dive exploration'
    );

    return {
      id: this.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'deep-dive' as any,
      metadata: {
        facilitatorAction: 'deep_dive',
        reasoning: reason,
        hasDynamicInstruction: !!dynamicInstruction,
        wordCountTarget: '150-200 words',
        endingGuidance: 'End with question or metaphor'
      }
    };
  }

  private async askForClarification(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルでこのメタ指示を適用してください。
会話は自然に、150-200語で。問いで締めくくってください。
`;
    } else {
      instructionSection = `
CLARIFICATION NEEDED: ${reason}

Based on the context above, please provide clarification to help advance our understanding of "${this.originalQuery}".

GUIDELINES:
- Address specific unclear points from the discussion
- Avoid starting with "皆さま" - respond naturally to the conversation
- Use concrete examples or analogies to clarify complex concepts
- Connect your clarification back to the main question
- Keep response focused and engaging (150-200 words)
- End with a question that deepens the inquiry
`;
    }

    const prompt = `
CURRENT DISCUSSION: "${this.originalQuery}"

CONTEXT:
${contextText}

${instructionSection}

Respond directly to help clarify the discussion.
`;

    const personality = (agent as any).getPersonalityPrompt(language);

    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'clarification' as any,
      'clarification request'
    );

    return {
      id: this.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'clarification' as any,
      metadata: {
        reasoning: `Facilitator clarification: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForPerspectiveShift(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

あなた固有の${agent.getAgent().style}スタイルで、既存の前提に挑戦するか、
まだ探求されていない視点を導入してください。
`;
    } else {
      instructionSection = `
The facilitator suggests introducing a different perspective to enrich the discussion about this topic.

Reason: ${reason}

Based on the context above, please consider "${this.originalQuery}" from an alternative angle, challenge existing assumptions about this topic, or introduce a viewpoint that hasn't been fully explored yet.
`;
    }

    const prompt = `
We are discussing: "${this.originalQuery}"

CONTEXT:
${contextText}

${instructionSection}
`;

    const personality = (agent as any).getPersonalityPrompt(language);

    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'perspective-shift' as any,
      'perspective shift'
    );

    return {
      id: this.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'perspective-shift' as any,
      metadata: {
        reasoning: `Facilitator perspective shift: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForSummary(
    agent: BaseAgent,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

要約しつつも、このメタ指示に沿って未解決の緊張や開かれた問いを強調してください。
`;
    } else {
      instructionSection = `
Please provide a summary of our discussion about this topic, highlighting:
1. Key insights about "${this.originalQuery}" that have been established
2. Areas of agreement among participants regarding this topic
3. Remaining questions or disagreements about "${this.originalQuery}"
4. The overall direction of our exploration of this topic

Keep the summary focused on "${this.originalQuery}" and be both concise and comprehensive.
`;
    }

    const prompt = `
We are discussing: "${this.originalQuery}"

${instructionSection}
`;

    const personality = (agent as any).getPersonalityPrompt(language);

    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'summary' as any,
      'discussion summary'
    );

    return {
      id: this.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'summary' as any,
      metadata: {
        reasoning: 'Facilitator-requested summary',
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async askForRedirect(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language,
    dynamicInstruction?: DynamicInstruction
  ): Promise<Message> {
    // 完全なコンテキストを構築（Round 1-2: Initial Thoughts + 最近の議論、Round 3+: 最近の議論のみ）
    const recentMessages = messages.slice(-5);
    const contextText = this.buildFullContext(recentMessages, agent.getAgent().id);

    // v2.0: 動的指示がある場合はプロンプトをオーバーライド
    let instructionSection: string;

    if (dynamicInstruction) {
      instructionSection = `
ファシリテーター メタ指示 (オーバーライド):
${dynamicInstruction.content}

${dynamicInstruction.ragDissonance ? `
過去の視点への挑戦:
${dynamicInstruction.ragDissonance.deconstructionHint}
` : ''}

議論を元の問いに戻しつつ、このメタ指示に沿った新しい角度を提供してください。
150-200語で、焦点を絞った問いで締めくくってください。
`;
    } else {
      instructionSection = `
REDIRECTION NEEDED: ${reason}

Looking at the context above, please help refocus on "${this.originalQuery}" by providing a specific new angle or insight.

GUIDELINES:
- Don't start with generic acknowledgments like "皆さま" or "これまでの議論で"
- Reference specific points from the conversation
- Identify what specific aspect of the drift needs addressing
- Bring a fresh perspective that connects back to the core question
- Be direct and engaging (150-200 words)
- End with a focused question that brings us back on track
`;
    }

    const prompt = `
ORIGINAL DISCUSSION: "${this.originalQuery}"

CONTEXT:
${contextText}

${instructionSection}

Jump directly into your perspective on the original question.
`;

    const personality = (agent as any).getPersonalityPrompt(language);

    const response = await (agent as any).executeAIWithErrorHandling(
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-session',
      'redirect' as any,
      'topic redirection'
    );

    return {
      id: this.generateMessageId(),
      agentId: agent.getAgent().id,
      content: response,
      timestamp: new Date(),
      role: 'agent',
      stage: 'redirect' as any,
      metadata: {
        reasoning: `Facilitator redirect: ${reason}`,
        hasDynamicInstruction: !!dynamicInstruction
      }
    };
  }

  private async generateFinalOutput(
    messages: Message[],
    agents: BaseAgent[],
    language: Language,
    sessionId: string,
    round: number
  ): Promise<Message | null> {
    try {
      // v1の投票システムを踏襲してFinalize担当を決定
      const finalizers = await this.selectFinalizerByVoting(messages, agents, language, sessionId, round);

      const recentMessages = messages.slice(-10);
      const contextText = recentMessages.map(m => `${m.agentId}: ${m.content}`).join('\n\n');

      const prompt = `
We have been exploring: "${this.originalQuery}"

As the selected finalizer, you have been chosen through democratic voting to provide the concluding synthesis of our rich dialogue. This is a significant responsibility - please provide a comprehensive and thoughtful conclusion that:

1. **Deep Synthesis**: Weave together the key insights about "${this.originalQuery}" that emerged throughout our entire conversation, not just recent exchanges
2. **Multi-Perspective Integration**: Acknowledge and integrate the diverse viewpoints, approaches, and wisdom that different participants brought to this exploration
3. **Nuanced Understanding**: Capture both areas where we found convergence and the beautiful complexities or tensions that remain unresolved about this topic
4. **Philosophical Depth**: Reflect on what this exploration revealed not just about "${this.originalQuery}" but about the nature of inquiry, understanding, and collaborative thinking itself
5. **Future Directions**: Suggest what new questions or avenues of exploration this dialogue has opened up
6. **Essence Distillation**: Articulate the core essence of what was discovered about "${this.originalQuery}" through this collective thinking process
7. **Inquiry Spirit**: Honor the spirit of genuine inquiry rather than forcing premature closure or oversimplified answers

RECENT DISCUSSION CONTEXT (for reference):
${contextText}

Please take your time to craft a substantial, nuanced, and insightful final reflection on our exploration of "${this.originalQuery}". This synthesis should be worthy of the depth of thinking that preceded it and serve as a meaningful conclusion to our collaborative inquiry.

Remember: You are not just summarizing - you are synthesizing, integrating, and elevating the collective wisdom that emerged from our dialogue into a coherent and profound final statement.
`;

      // 複数のファイナライザーが選出された場合
      if (finalizers.length > 1) {
        console.log(`[DynamicRouter] Multiple finalizers selected: ${finalizers.map(f => f.getAgent().name).join(', ')}`);

        return await this.handleMultipleFinalizers(finalizers, messages, contextText, language, sessionId, round);

      } else {
        // 単一のファイナライザーの場合（従来通り）
        const finalizer = finalizers[0];
        const personality = (finalizer as any).getPersonalityPrompt(language);

        const response = await (finalizer as any).executeAIWithErrorHandling(
          prompt,
          personality,
          finalizer.getSessionId() || 'dynamic-session',
          'finalize' as any,
          'final synthesis'
        );

        return {
          id: this.generateMessageId(),
          agentId: finalizer.getAgent().id,
          content: response,
          timestamp: new Date(),
          role: 'agent',
          stage: 'finalize',
          metadata: {
            reasoning: 'Dynamic dialogue final synthesis'
          }
        };
      }
    } catch (error) {
      console.error('[DynamicRouter] Error generating final output:', error);
      return null;
    }
  }

  // 複数ファイナライザーの協力システム
  private async handleMultipleFinalizers(
    finalizers: BaseAgent[],
    messages: Message[],
    contextText: string,
    language: Language,
    sessionId: string,
    round: number
  ): Promise<Message> {
    console.log(`[DynamicRouter] Starting collaborative finalization with ${finalizers.length} finalizers`);

    // Step 1: 協力紹介メッセージを作成・送信
    const collaborationInfo = {
      sessionId,
      finalizers: finalizers.map((f, index) => ({
        id: f.getAgent().id,
        name: f.getAgent().name,
        role: index === 0 ? 'foundation' : (index === finalizers.length - 1 ? 'integrator' : 'enricher')
      })),
      totalSteps: finalizers.length,
      topic: this.originalQuery
    };

    const introMessage = createCollaborationIntroMessage(collaborationInfo, language);
    messages.push(introMessage);

    this.emitWebSocketEvent('v2-message', {
      sessionId,
      message: introMessage,
      round,
      collaborationPhase: 'introduction'
    });

    this.emitWebSocketEvent('v2-collaboration-start', {
      sessionId,
      type: 'multiple-finalizers',
      finalizers: collaborationInfo.finalizers,
      round
    });

    const collaborationMessages: Message[] = [];

    // Step 2: 各ファイナライザーが順番に発言
    for (const [index, finalizer] of finalizers.entries()) {
      const isFirst = index === 0;
      const isLast = index === finalizers.length - 1;

      // 前のファイナライザーの発言を参考に含める
      const previousAnalyses = collaborationMessages.length > 0
        ? `\n\nPREVIOUS FINALIZER ANALYSES:\n${collaborationMessages.map((msg, i) => `${i + 1}. **${msg.agentId}**: ${msg.content.slice(0, 300)}...`).join('\n\n')}`
        : '';

      const collaborativePrompt = `
We have been exploring: "${this.originalQuery}"

🎆 **COLLABORATIVE FINALIZATION - ${index + 1}/${finalizers.length}**

You are ${finalizer.getAgent().name}, working with ${finalizers.filter(f => f !== finalizer).map(f => f.getAgent().name).join(' and ')} to create a comprehensive final synthesis.

${isFirst ? `🌱 **YOUR ROLE AS THE FOUNDATION BUILDER**:
- Begin our collaborative synthesis with your ${finalizer.getAgent().style} perspective
- Establish key analytical frameworks and foundational insights
- Set the stage for others to build upon your analysis
- Focus on ${this.getFinalizerFocus(finalizer.getAgent().id)}` :
          (isLast ? `🎆 **YOUR ROLE AS THE SYNTHESIS INTEGRATOR**:
- Weave together all previous analyses into a unified conclusion
- Build upon insights from ${finalizers.slice(0, -1).map(f => f.getAgent().name).join(' and ')}
- Provide the culminating understanding that honors all perspectives
- Create the definitive conclusion about "${this.originalQuery}"` :
            `🌿 **YOUR ROLE AS THE PERSPECTIVE ENRICHER**:
- Build meaningfully on what ${finalizers.slice(0, index).map(f => f.getAgent().name).join(' and ')} established
- Add your unique ${finalizer.getAgent().style} insights to deepen understanding
- Bridge different analytical approaches and fill important gaps
- Prepare the foundation for the final integrative analysis`)}

**DISCUSSION CONTEXT:**
${contextText}${previousAnalyses}

**YOUR SPECIFIC CONTRIBUTION:**
${this.getCollaborativeInstructions(finalizer.getAgent().id, isFirst, isLast, index + 1, finalizers.length)}

**Remember**: This is a collaborative effort. Your contribution should clearly build on others while bringing your unique perspective to create something greater than the sum of its parts.
`;

      const personality = (finalizer as any).getPersonalityPrompt(language);

      // 進行状況メッセージを送信
      const role = isFirst ? 'foundation' : (isLast ? 'integrator' : 'enricher');
      const progressMessage = createCollaborationProgressMessage(
        finalizer.getAgent().name,
        index + 1,
        finalizers.length,
        role,
        sessionId,
        language
      );

      messages.push(progressMessage);
      this.emitWebSocketEvent('v2-message', {
        sessionId,
        message: progressMessage,
        round,
        collaborationPhase: 'progress',
        stepInfo: { current: index + 1, total: finalizers.length, role }
      });

      console.log(`[DynamicRouter] Finalizer ${index + 1}/${finalizers.length} (${finalizer.getAgent().name}) starting...`);

      // ファイナライザー専用の高コストLLMを使用するため、agent idに'-finalizer'を追加
      const finalizerAgentId = `${finalizer.getAgent().id}-finalizer`;
      const response = await (finalizer as any).executeAIWithFinalizerModel(
        collaborativePrompt,
        personality,
        finalizerAgentId,
        finalizer.getSessionId() || 'dynamic-session',
        'finalize' as any,
        `collaborative synthesis ${index + 1}/${finalizers.length}`
      );

      const finalizerMessage: Message = {
        id: this.generateMessageId(),
        agentId: finalizer.getAgent().id,
        content: response,
        timestamp: new Date(),
        role: 'agent',
        stage: 'finalize',
        metadata: {
          collaborativeFinalize: true,
          finalizerIndex: index + 1,
          totalFinalizers: finalizers.length,
          finalizerRole: isFirst ? 'foundation' : (isLast ? 'integrator' : 'enricher'),
          coFinalizers: finalizers.filter(f => f !== finalizer).map(f => f.getAgent().name),
          reasoning: `Collaborative finalizer ${index + 1}/${finalizers.length}: ${isFirst ? 'Foundation Builder' : (isLast ? 'Synthesis Integrator' : 'Perspective Enricher')}`
        }
      };

      collaborationMessages.push(finalizerMessage);
      messages.push(finalizerMessage);

      // 各ファイナライザーのメッセージをWebSocketで送信
      this.emitWebSocketEvent('v2-message', {
        sessionId,
        message: finalizerMessage,
        round,
        collaborationStep: {
          current: index + 1,
          total: finalizers.length,
          role: finalizerMessage.metadata?.finalizerRole,
          agentName: finalizer.getAgent().name
        }
      });

      console.log(`[DynamicRouter] Finalizer ${index + 1}/${finalizers.length} (${finalizer.getAgent().name}) completed`);

      // 間に少し間をあける（最後以外）
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Step 3: 協力完了メッセージを作成・送信
    const summaryMessage = createCollaborationSummaryMessage(
      finalizers.map(f => f.getAgent().name),
      collaborationMessages.length,
      sessionId,
      this.originalQuery,
      language
    );

    messages.push(summaryMessage);

    this.emitWebSocketEvent('v2-message', {
      sessionId,
      message: summaryMessage,
      round,
      collaborationPhase: 'summary'
    });

    this.emitWebSocketEvent('v2-collaboration-complete', {
      sessionId,
      type: 'multiple-finalizers',
      totalMessages: collaborationMessages.length,
      finalizers: finalizers.map(f => f.getAgent().name),
      round
    });

    console.log(`[DynamicRouter] Collaborative finalization completed with ${collaborationMessages.length} contributions`);

    // 最後のメッセージ（統合担当）をメインの結果として返す
    return collaborationMessages[collaborationMessages.length - 1];
  }

  // ファイナライザーのフォーカスエリアを取得
  private getFinalizerFocus(agentId: string): string {
    const focuses: Record<string, string> = {
      'eiro-001': 'logical analysis and systematic reasoning',
      'yui-000': 'emotional resonance and human connections',
      'hekito-001': 'analytical depth and methodical examination',
      'yoga-001': 'poetic insights and creative perspectives',
      'kanshi-001': 'critical evaluation and balanced assessment'
    };
    return focuses[agentId] || 'comprehensive analysis';
  }

  // 協力的インストラクションを取得
  private getCollaborativeInstructions(agentId: string, isFirst: boolean, isLast: boolean, position: number, total: number): string {
    if (isFirst) {
      return `As the foundation builder, provide:
1. **Core Framework**: Establish the main analytical structure
2. **Key Insights**: Identify the most important discoveries from our dialogue
3. **Thematic Organization**: Create clear thematic threads for others to develop`;
    } else if (isLast) {
      return `As the synthesis integrator, provide:
1. **Comprehensive Weaving**: Unite all previous analyses into a coherent whole
2. **Elevated Understanding**: Transform individual insights into collective wisdom
3. **Future Vision**: Articulate what this exploration opens up for continued inquiry`;
    } else {
      return `As perspective enricher ${position}/${total}, provide:
1. **Complementary Analysis**: Add dimensions not fully explored by previous finalizers
2. **Connective Insights**: Link different aspects of the previous analyses
3. **Depth Enhancement**: Deepen understanding through your unique analytical lens`;
    }
  }

  private async updateSession(session: Session, messages: Message[]): Promise<Session> {
    session.messages = messages;
    session.updatedAt = new Date();
    session.messageCount = messages.length;

    await this.sessionStorage.saveSession(session);
    return session;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ファシリテーターアクションの簡略化メッセージを作成
  private createFacilitatorActionMessage(
    sessionId: string,
    dialogueState: DialogueState,
    round: number,
    language: Language
  ): Message | null {
    if (dialogueState.suggestedActions.length === 0) return null;

    const recommendedCount = dialogueState.recommendedActionCount || 2;
    const actionsToDisplay = dialogueState.suggestedActions.slice(0, recommendedCount);
    const primaryAction = actionsToDisplay[0];

    const content = this.formatFacilitatorActionContent(
      actionsToDisplay,
      dialogueState,
      round,
      language,
      recommendedCount
    );

    return {
      id: this.generateMessageId(),
      agentId: 'facilitator-001',
      content,
      timestamp: new Date(),
      role: 'agent',
      stage: 'facilitator',
      sequenceNumber: 1,
      metadata: {
        facilitatorAction: primaryAction.type,
        facilitatorReasoning: primaryAction.reason,
        consensusLevel: dialogueState.overallConsensus,
        roundNumber: round,
        participationBalance: this.getParticipationBalance(dialogueState),
        isFacilitatorAction: true,
        priority: primaryAction.priority,
        recommendedActionCount: recommendedCount,
        totalSuggestedActions: dialogueState.suggestedActions.length
      }
    };
  }

  // ファシリテーターアクションの内容をフォーマット
  private formatFacilitatorActionContent(
    actions: FacilitatorAction[],
    dialogueState: DialogueState,
    round: number,
    language: Language,
    actionCount: number
  ): string {
    const actionDescriptions = {
      ja: {
        deep_dive: '深掘り',
        clarification: '明確化',
        perspective_shift: '視点転換',
        summarize: '要約',
        conclude: '終結',
        redirect: '方向転換'
      },
      en: {
        deep_dive: 'Deep Dive',
        clarification: 'Clarification',
        perspective_shift: 'Perspective Shift',
        summarize: 'Summarize',
        conclude: 'Conclude',
        redirect: 'Redirect'
      }
    };

    const consensusLevel = Math.round(dialogueState.overallConsensus * 10) / 10;

    if (language === 'ja') {
      // 複数アクションの場合
      if (actions.length > 1) {
        const actionLines = actions.map((action, index) => {
          const actionName = actionDescriptions[language]?.[action.type] || action.type;
          return `**アクション ${index + 1}**: ${actionName}
**対象**: ${action.target || '全体'}
**理由**: ${action.reason}`;
        }).join('\n\n');

        return `🔧 **ラウンド ${round} - ファシリテーター判断**

**実行アクション数**: ${actionCount}/${dialogueState.suggestedActions.length}
**コンセンサス**: ${consensusLevel}/10

${actionLines}

*この判定により対話の流れを調整します*`;
      } else {
        // 単一アクションの場合
        const action = actions[0];
        const actionName = actionDescriptions[language]?.[action.type] || action.type;
        return `🔧 **ラウンド ${round} - ファシリテーター判断**

**アクション**: ${actionName}
**対象**: ${action.target || '全体'}
**コンセンサス**: ${consensusLevel}/10
**理由**: ${action.reason}

*この判定により対話の流れを調整します*`;
      }
    } else {
      // 複数アクションの場合（英語）
      if (actions.length > 1) {
        const actionLines = actions.map((action, index) => {
          const actionName = actionDescriptions[language]?.[action.type] || action.type;
          return `**Action ${index + 1}**: ${actionName}
**Target**: ${action.target || 'Overall'}
**Reason**: ${action.reason}`;
        }).join('\n\n');

        return `🔧 **Round ${round} - Facilitator Decision**

**Actions to Execute**: ${actionCount}/${dialogueState.suggestedActions.length}
**Consensus**: ${consensusLevel}/10

${actionLines}

*This decision guides the dialogue flow*`;
      } else {
        // 単一アクションの場合（英語）
        const action = actions[0];
        const actionName = actionDescriptions[language]?.[action.type] || action.type;
        return `🔧 **Round ${round} - Facilitator Decision**

**Action**: ${actionName}
**Target**: ${action.target || 'Overall'}
**Consensus**: ${consensusLevel}/10
**Reason**: ${action.reason}

*This decision guides the dialogue flow*`;
      }
    }
  }

  // 参加バランスを取得
  private getParticipationBalance(dialogueState: DialogueState): Record<string, number> {
    const balance: Record<string, number> = {};

    // 全エージェントを初期化（0で開始）
    const allAgents = ['eiro-001', 'yui-000', 'hekito-001', 'yoga-001', 'kanshi-001'];
    allAgents.forEach(agentId => {
      balance[agentId] = 0;
    });

    // participantStatesから実際の参加カウントを設定
    dialogueState.participantStates.forEach(state => {
      balance[state.agentId] = 1; // 参加している場合は1
    });

    return balance;
  }

  // v1の投票システムを踏襲してFinalize担当を選出
  private async selectFinalizerByVoting(
    messages: Message[],
    agents: BaseAgent[],
    language: Language,
    sessionId: string,
    round: number
  ): Promise<BaseAgent[]> {
    console.log('[DynamicRouter] Starting voting process for finalizer selection');

    // 投票開始メッセージを追加
    const votingStartMessage = createVotingStartMessage(sessionId, round);
    messages.push(votingStartMessage);

    try {
      // 全エージェントから投票を収集
      const votes: { agentId: string; voteFor: string | undefined; voteReasoning?: string }[] = [];

      for (const agent of agents) {
        try {
          const vote = await this.askForVote(agent, messages, language, agents);
          if (vote.voteFor) {
            votes.push(vote);
            console.log(`[DynamicRouter] Vote from ${vote.agentId}: ${vote.voteFor} (${vote.voteReasoning})`);
          }
        } catch (error) {
          console.error(`[DynamicRouter] Error getting vote from ${agent.getAgent().id}:`, error);
        }
      }

      // ファシリテーターに投票結果の分析と最終判断を委ねる
      if (votes.length > 0) {
        const selectedAgentIds = await this.facilitator.analyzeFinalizeVotes(votes, agents.map(a => a.getAgent().id));
        const selectedAgents = agents.filter(a => selectedAgentIds.includes(a.getAgent().id));

        if (selectedAgents.length > 0) {
          console.log(`[DynamicRouter] Finalizers selected by facilitator analysis: ${selectedAgentIds.join(', ')}`);

          // 投票結果メッセージを作成（複数選出の場合は最初のエージェントをプライマリとして表示）
          const votingResults = votes.map(vote => ({
            voter: vote.agentId,
            voterName: agents.find(a => a.getAgent().id === vote.agentId)?.getAgent().name || vote.agentId,
            votedFor: vote.voteFor!,
            votedForName: agents.find(a => a.getAgent().id === vote.voteFor)?.getAgent().name || vote.voteFor!,
            reasoning: vote.voteReasoning || 'No reasoning provided'
          }));

          // 複数選出の場合はすべてのファイナライザーを表示用文字列として処理
          const finalizerNames = selectedAgents.map(a => a.getAgent().name).join(' & ');
          const finalizerIds = selectedAgentIds.join(' & ');

          const votingResultMessage = createVotingResultMessage(
            votingResults,
            finalizerIds,
            finalizerNames,
            sessionId,
            round
          );
          messages.push(votingResultMessage);

          return selectedAgents;
        }
      }

      console.log('[DynamicRouter] No votes or voting failed, falling back to style-based selection');
    } catch (error) {
      console.error('[DynamicRouter] Error in voting process:', error);
    }

    // フォールバック: 従来のstyle-based選択
    const fallbackAgent = agents.find(a =>
      a.getAgent().style === 'logical' || a.getAgent().style === 'meta'
    ) || agents[0];
    return [fallbackAgent];
  }

  // 各エージェントから投票を取得
  private async askForVote(
    agent: BaseAgent,
    messages: Message[],
    language: Language,
    allAgents: BaseAgent[]
  ): Promise<{ agentId: string; voteFor: string | undefined; voteReasoning?: string }> {
    const agentList = allAgents
      .filter(a => a.getAgent().id !== agent.getAgent().id)
      .map(a => a.getAgent().id);
    const recentMessages = messages.slice(-5);
    const contextText = recentMessages.map(m => `${m.agentId}: ${m.content.slice(0, 100)}...`).join('\n\n');

    const prompt = language === 'ja'
      ? `議論の総括を担当するエージェントを選んでください。

最近の議論の流れ:
${contextText}

選択肢: ${agentList.join(', ')}

以下の形式で回答してください：
投票: [エージェントID]
理由: [選択理由]

注意: 自分自身には投票できません。最も議論を的確に総括できると思うエージェントに投票してください。`
      : `Please select an agent to provide the final synthesis of our discussion.

Recent discussion flow:
${contextText}

Available agents: ${agentList.join(', ')}

Please respond in this format:
Vote: [agent-id]
Reason: [reason for selection]

Note: You cannot vote for yourself. Vote for the agent you think can best synthesize our discussion.`;

    const compressedContext = await agent['prepareContext'](messages);
    const personality = agent['getPersonalityPrompt'](language);

    const response = await agent['executeAIWithErrorHandling'](
      prompt,
      personality,
      agent.getSessionId() || 'dynamic-vote',
      'voting' as any,
      'finalizer voting'
    );

    return this.parseVoteResponse(response, agent.getAgent().id, agentList, allAgents);
  }

  // 投票レスポンスを解析
  private parseVoteResponse(
    response: string,
    voterId: string,
    validAgents: string[],
    allAgents?: BaseAgent[]
  ): { agentId: string; voteFor: string | undefined; voteReasoning?: string } {
    let voteFor: string | undefined;
    let voteReasoning: string | undefined;

    // 日本語パターン
    const jaVoteMatch = response.match(/投票:\s*([^\n]+)/);
    const jaReasonMatch = response.match(/理由:\s*([^\n]+)/);

    // 英語パターン
    const enVoteMatch = response.match(/Vote:\s*([^\n]+)/);
    const enReasonMatch = response.match(/Reason:\s*([^\n]+)/);

    const voteText = (jaVoteMatch?.[1] || enVoteMatch?.[1] || '').trim();
    voteReasoning = (jaReasonMatch?.[1] || enReasonMatch?.[1] || '').trim();

    // まず有効なエージェントIDかチェック
    if (voteText && validAgents.includes(voteText)) {
      voteFor = voteText;
    } else if (voteText && allAgents) {
      // IDで見つからない場合、名前で検索
      const agentByName = allAgents.find(a =>
        a.getAgent().name === voteText &&
        validAgents.includes(a.getAgent().id)
      );
      if (agentByName) {
        voteFor = agentByName.getAgent().id;
        console.log(`[DynamicRouter] Vote converted from name "${voteText}" to ID "${voteFor}"`);
      }
    }

    return {
      agentId: voterId,
      voteFor,
      voteReasoning
    };
  }

  // Save consensus snapshot to session
  private async saveConsensusSnapshot(
    session: Session,
    round: number,
    consensusData: ConsensusIndicator[],
    dialogueState: DialogueState
  ): Promise<void> {
    try {
      const agentConsensus: AgentConsensusData[] = consensusData.map(c => ({
        agentId: c.agentId,
        agentName: this.getAgentName(c.agentId),
        satisfaction: c.satisfactionLevel,
        additionalPoints: c.hasAdditionalPoints,
        questions: c.questionsForOthers,
        readyToMove: c.readyToMove,
        reasoning: c.reasoning,
        timestamp: new Date()
      }));

      const snapshot: SessionConsensusSnapshot = {
        round,
        timestamp: new Date(),
        overallConsensus: dialogueState.overallConsensus,
        agentConsensus,
        facilitatorActions: dialogueState.suggestedActions.map(a => `${a.type}: ${a.reason}`)
      };

      if (!session.consensusHistory) {
        session.consensusHistory = [];
      }

      session.consensusHistory.push(snapshot);

      // Update session in storage
      await this.sessionStorage.saveSession(session);

      console.log(`[DynamicRouter] Saved consensus snapshot for round ${round}`);
    } catch (error) {
      console.error('[DynamicRouter] Error saving consensus snapshot:', error);
    }
  }

  private async saveFacilitatorLogs(sessionId: string): Promise<void> {
    try {
      const logs = this.facilitator.getAllLogs();

      for (const log of logs) {
        const logFileName = `facilitator-r${log.roundNumber}-${log.action}-${Date.now()}.json`;
        const logPath = `logs/${sessionId}/facilitator/${logFileName}`;

        const logData = {
          sessionId: log.sessionId,
          roundNumber: log.roundNumber,
          timestamp: log.timestamp.toISOString(),
          action: log.action,
          decision: {
            type: log.decision.type,
            reasoning: log.decision.reasoning,
            dataAnalyzed: log.decision.dataAnalyzed,
            suggestedActions: log.decision.suggestedActions,
            selectedAction: log.decision.selectedAction
          },
          executionDetails: log.executionDetails || null
        };

        await this.sessionStorage.saveFile(logPath, JSON.stringify(logData, null, 2));
      }

      console.log(`[DynamicRouter] Saved ${logs.length} facilitator logs to files`);
    } catch (error) {
      console.error('[DynamicRouter] Error saving facilitator logs:', error);
    }
  }

  // エージェント選択のヘルパーメソッド
  private selectBalancedAgent(agents: BaseAgent[], preferredStyle?: string, excludeRecent: boolean = true): BaseAgent {
    // 最近発言していないエージェントを優先
    let candidates = agents;

    console.log(`[DynamicRouter] selectBalancedAgent called - Current participation:`,
      Array.from(this.agentParticipationCount.entries()).map(([id, count]) => `${id}:${count}`).join(', '));
    console.log(`[DynamicRouter] Recent speakers:`, this.recentSpeakers);

    if (excludeRecent && this.recentSpeakers.length > 0) {
      const nonRecentAgents = agents.filter(agent =>
        !this.recentSpeakers.slice(-2).includes(agent.getAgent().id)
      );
      if (nonRecentAgents.length > 0) {
        candidates = nonRecentAgents;
        console.log(`[DynamicRouter] Excluded recent speakers, candidates:`, candidates.map(a => a.getAgent().id));
      }
    }

    // 発言回数が少ないエージェントを優先
    const sortedByParticipation = candidates.sort((a, b) => {
      const countA = this.agentParticipationCount.get(a.getAgent().id) || 0;
      const countB = this.agentParticipationCount.get(b.getAgent().id) || 0;
      return countA - countB;
    });

    console.log(`[DynamicRouter] Sorted by participation:`,
      sortedByParticipation.map(a => `${a.getAgent().id}:${this.agentParticipationCount.get(a.getAgent().id) || 0}`));

    // 特定のスタイルが指定されている場合
    if (preferredStyle) {
      const styleMatches = sortedByParticipation.filter(agent =>
        agent.getAgent().style === preferredStyle
      );
      if (styleMatches.length > 0) {
        console.log(`[DynamicRouter] Selected by style preference: ${styleMatches[0].getAgent().id}`);
        return styleMatches[0];
      }
    }

    // 発言回数が最も少ないエージェントを選択
    const selected = sortedByParticipation[0];
    console.log(`[DynamicRouter] Selected least active agent: ${selected.getAgent().id} (${this.agentParticipationCount.get(selected.getAgent().id) || 0} contributions)`);
    return selected;
  }

  private trackAgentParticipation(agentId: string): void {
    // 発言回数を更新
    const currentCount = this.agentParticipationCount.get(agentId) || 0;
    this.agentParticipationCount.set(agentId, currentCount + 1);

    // 最近の発言者リストを更新（最大3人まで保持）
    this.recentSpeakers.push(agentId);
    if (this.recentSpeakers.length > 3) {
      this.recentSpeakers.shift();
    }

    console.log(`[DynamicRouter] Agent participation: ${agentId} (${currentCount + 1} times)`);
  }

  // Helper to get agent name
  private getAgentName(agentId: string): string {
    const agentNames: Record<string, string> = {
      'eiro-001': '慧露',
      'kanshi-001': '観至',
      'yoga-001': '陽雅',
      'hekito-001': '碧統',
      'yui-000': '結心'
    };
    return agentNames[agentId] || agentId;
  }

  // 統計情報の取得
  getDialogueStats() {
    return this.facilitator.getDialogueStats();
  }

  // WebSocketイベント送信ヘルパー
  private emitWebSocketEvent(event: string, data: any) {
    if (this.wsEmitter) {
      try {
        console.log(`[DynamicRouter] Emitting WebSocket event: ${event}`, data);
        this.wsEmitter(event, data);
      } catch (error) {
        console.warn(`[DynamicRouter] Failed to emit WebSocket event ${event}:`, error);
      }
    } else {
      console.warn(`[DynamicRouter] No WebSocket emitter available for event: ${event}`);
    }
  }

  // Initial Thoughtsを含む完全なコンテキストを構築
  // Round 1-2: Initial Thoughts + 最近の議論
  // Round 3以降: 最近の議論のみ（トークン節約）
  private buildFullContext(recentMessages: Message[], excludeAgentId?: string): string {
    // Round 3以降はInitial Thoughtsを含めない（トークン節約のため）
    const includeInitialThoughts = this.currentRound <= 2;

    let initialThoughtsText = '';
    if (includeInitialThoughts) {
      // Initial Thoughtsを最初に含める
      initialThoughtsText = this.initialThoughts
        .filter(m => !excludeAgentId || m.agentId !== excludeAgentId)
        .map(m => `${m.agentId} [Initial Thought]: ${m.content}`)
        .join('\n\n');
    }

    // 最近のメッセージを追加（ただしInitial Thoughtは除外）
    const recentText = recentMessages
      .filter(m => m.stage !== 'individual-thought' && m.role === 'agent')
      .filter(m => !excludeAgentId || m.agentId !== excludeAgentId)
      .map(m => `${m.agentId}: ${m.content}`)
      .join('\n\n');

    // 両方を結合
    if (initialThoughtsText && recentText) {
      return `INITIAL THOUGHTS FROM ALL AGENTS (Round ${this.currentRound}):\n${initialThoughtsText}\n\n---\n\nRECENT DISCUSSION:\n${recentText}`;
    } else if (initialThoughtsText) {
      return `INITIAL THOUGHTS FROM ALL AGENTS (Round ${this.currentRound}):\n${initialThoughtsText}`;
    } else if (recentText) {
      return `RECENT DISCUSSION (Round ${this.currentRound}):\n${recentText}`;
    }

    return "No context available.";
  }
}