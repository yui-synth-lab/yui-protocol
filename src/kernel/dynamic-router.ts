import { BaseAgent } from '../agents/base-agent.js';
import { FacilitatorAgent } from '../agents/facilitator-agent.js';
import { Message, Session, Agent, AgentResponse, SessionConsensusSnapshot, AgentConsensusData } from '../types/index.js';
import { ConsensusIndicator, DialogueState, DynamicRound, FacilitatorAction } from '../types/consensus.js';
import { SessionStorage } from './session-storage.js';
import { Language } from '../templates/prompts.js';
import { createFacilitatorMessage, createConsensusMessage } from '../utils/message-converters.js';
import { createConvergenceMessage, createVotingStartMessage, createVotingResultMessage } from '../utils/convergence-messages.js';
import { getRoundGuidanceText } from '../templates/v2-prompts.js';
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

  constructor(sessionStorage: SessionStorage, wsEmitter?: (event: string, data: any) => void) {
    this.facilitator = new FacilitatorAgent();
    this.sessionStorage = sessionStorage;
    this.wsEmitter = wsEmitter;

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

    session = await this.updateSession(session, messages); // リアルタイム更新

    // 初期応答後のファシリテーター判断
    const initialConsensus = await this.gatherConsensus(agentList, messages, language, 0);
    // ファシリテーターに発言数を同期
    this.facilitator.updateParticipationCount(this.agentParticipationCount);
    const initialDialogueState = await this.facilitator.analyzeDialogueState(messages, initialConsensus, 0, this.originalQuery);

    // 初期ファシリテーターメッセージを作成・送信
    const initialFacilitatorMessage = this.createFacilitatorActionMessage(
      sessionId,
      initialDialogueState,
      0,
      language
    );
    if (initialFacilitatorMessage) {
      messages.push(initialFacilitatorMessage);
      this.emitWebSocketEvent('v2-message', {
        sessionId,
        message: initialFacilitatorMessage,
        round: 0
      });
    }

    session = await this.updateSession(session, messages); // リアルタイム更新

    while (!converged && round < this.maxRounds) {
      round++;
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

      const nextActions = await this.executeActions(dialogueState.suggestedActions, agentList, messages, language);
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
    session.status = 'completed';
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

    for (const agent of agents) {
      try {
        console.log(`[DynamicRouter] Getting initial response from ${agent.getAgent().name}`);
        const response = await agent.stage1IndividualThought(query, context, language);

        const message: Message = {
          id: this.generateMessageId(),
          agentId: agent.getAgent().id,
          content: response.content,
          timestamp: new Date(),
          role: 'agent',
          stage: 'individual-thought',
          sequenceNumber: 1,
          metadata: {
            reasoning: response.reasoning,
            confidence: 0.8, // デフォルト値
            references: agent.getAgent().references || [],
            stageData: response
          }
        };

        // 初期応答でも参加カウントを追跡
        this.trackAgentParticipation(agent.getAgent().id);

        responses.push(message);

        // Emit each response immediately via WebSocket
        this.emitWebSocketEvent('v2-message', {
          sessionId,
          message,
          round: 0 // Initial responses are round 0
        });

        console.log(`[DynamicRouter] Sent initial response from ${agent.getAgent().name} via WebSocket`);
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

          // 残りのエージェントにはデフォルト値を追加（統計目的）
          for (let i = checkedAgents; i < totalAgents; i++) {
            const remainingAgent = shuffledAgents[i];
            consensusData.push({
              agentId: remainingAgent.getAgent().id,
              satisfactionLevel: 6, // 中間値
              hasAdditionalPoints: true, // 継続を仮定
              questionsForOthers: [],
              readyToMove: false, // 継続を仮定
              reasoning: 'Early exit - assumed continuing based on majority vote'
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
    const roundGuidance = getRoundGuidanceText(currentRound);

    const prompt = `
You are discussing: "${this.originalQuery}"

CURRENT ROUND: ${currentRound}
${roundGuidance}

Based on the recent discussion, please evaluate your satisfaction and readiness regarding this original topic:

RECENT DISCUSSION:
${contextText}

Please respond with:
1. Your satisfaction level with how we've explored "${this.originalQuery}" (1-10)
2. Has this discussion provided meaningful insights and value about "${this.originalQuery}"? (yes/no)
3. Are you ready to move to conclusion, even if some aspects could be explored further? (yes/no)
4. Do you have critical additional points that MUST be discussed before concluding? (yes/no - only say "yes" if truly essential)
5. Brief reasoning for your readiness assessment

${currentRound <= 2 ?
  'NOTE: In early rounds, consider whether the discussion could benefit from more exploration and different perspectives before concluding.' :
  'Consider: A satisfaction level of 6+ with meaningful insights often indicates readiness for conclusion.'
}

Format your response exactly like this:
Satisfaction: [1-10]
Meaningful insights: [yes/no]
Ready to conclude: [yes/no]
Critical points remaining: [yes/no]
Reasoning: [brief explanation focusing on whether this is a good stopping point]
`;

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
    let reasoning = 'No specific reasoning provided';

    try {
      const lines = response.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('Satisfaction:')) {
          const match = trimmed.match(/(\d+)/);
          if (match) satisfactionLevel = Math.min(10, Math.max(1, parseInt(match[1])));
        }

        if (trimmed.startsWith('Meaningful insights:')) {
          // 新しいフォーマットでは meaningful insights を評価
          const hasMeaningfulInsights = trimmed.toLowerCase().includes('yes');
          // 意味ある洞察は満足度の指標であり、追加議論の必要性とは別
          // hasAdditionalPointsは別途Critical pointsで判定する
        }

        if (trimmed.startsWith('Ready to conclude:')) {
          readyToMove = trimmed.toLowerCase().includes('yes');
        }

        if (trimmed.startsWith('Critical points remaining:')) {
          // 重要な未討論ポイントがある場合、継続が必要
          const hasCriticalPoints = trimmed.toLowerCase().includes('yes');
          if (hasCriticalPoints) {
            readyToMove = false; // 重要ポイントがあれば継続
            hasAdditionalPoints = true;
          }
        }

        if (trimmed.startsWith('Reasoning:')) {
          reasoning = trimmed.replace('Reasoning:', '').trim();
        }
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
    language: Language
  ): Promise<Message[]> {
    const newMessages: Message[] = [];

    // アクションを優先度順にソート
    const sortedActions = actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const action of sortedActions.slice(0, 2)) { // 最大2つのアクションを実行
      try {
        const actionMessages = await this.executeAction(action, agents, messages, language);
        newMessages.push(...actionMessages);
      } catch (error) {
        console.error(`[DynamicRouter] Error executing action ${action.type}:`, error);
      }
    }

    return newMessages;
  }

  private async executeAction(
    action: any,
    agents: BaseAgent[],
    messages: Message[],
    language: Language
  ): Promise<Message[]> {
    const newMessages: Message[] = [];
    let success = false;
    let errorMessage: string | undefined;
    const agentResponses: string[] = [];

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
          const deepDiveResponse = await this.askForDeepDive(targetAgent, action.reason, messages, language);
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
          const clarificationResponse = await this.askForClarification(clarifyAgent, action.reason, messages, language);
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
          const perspectiveResponse = await this.askForPerspectiveShift(perspectiveAgent, action.reason, messages, language);
          newMessages.push(perspectiveResponse);
          agentResponses.push(`${perspectiveAgent.getAgent().name}: ${perspectiveResponse.content.slice(0, 100)}...`);
          this.trackAgentParticipation(perspectiveAgent.getAgent().id);
          success = true;
          break;

        case 'summarize':
          // 論理的スタイルを優先するが、発言バランスも考慮
          const summaryAgent = this.selectBalancedAgent(agents, 'logical', true);
          const summary = await this.askForSummary(summaryAgent, messages, language);
          newMessages.push(summary);
          agentResponses.push(`${summaryAgent.getAgent().name}: ${summary.content.slice(0, 100)}...`);
          this.trackAgentParticipation(summaryAgent.getAgent().id);
          success = true;
          break;

        case 'redirect':
          // 発言バランスを考慮してエージェントを選んで元のトピックに戻す
          const redirectAgent = this.selectBalancedAgent(agents, undefined, true);
          const redirect = await this.askForRedirect(redirectAgent, action.reason, messages, language);
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
    language: Language
  ): Promise<Message> {
    // Get recent context from other agents
    const recentContext = messages.slice(-3).filter(m => m.role === 'agent' && m.agentId !== agent.getAgent().id);
    const contextText = recentContext.length > 0
      ? recentContext.map(m => `${m.agentId}: "${m.content.slice(0, 150)}..."`).join('\n\n')
      : "No recent discussion context available.";

    const prompt = `
CURRENT DISCUSSION: "${this.originalQuery}"

RECENT CONTEXT FROM OTHER AGENTS:
${contextText}

FACILITATOR REQUEST: ${reason}

Based on the above context, please contribute your unique perspective to "${this.originalQuery}".

IMPORTANT GUIDELINES:
- Build directly on or respond to specific points made by other agents above
- Avoid generic openings like "皆さま" or "これまでの議論で"
- Reference specific ideas or arguments from the context when relevant
- Bring your unique ${agent.getAgent().style} perspective to advance the discussion
- Keep it conversational and engaging (150-200 words)
- End with a thought-provoking question or meaningful metaphor

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
        wordCountTarget: '150-200 words',
        endingGuidance: 'End with question or metaphor'
      }
    };
  }

  private async askForClarification(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language
  ): Promise<Message> {
    // Get recent context including this agent's previous statements
    const recentContext = messages.slice(-5);
    const contextText = recentContext.map(m =>
      `${m.agentId}: "${m.content.slice(0, 120)}..."`
    ).join('\n\n');

    const prompt = `
CURRENT DISCUSSION: "${this.originalQuery}"

RECENT CONVERSATION FLOW:
${contextText}

CLARIFICATION NEEDED: ${reason}

Based on the conversation above, please provide clarification to help advance our understanding of "${this.originalQuery}".

GUIDELINES:
- Address specific unclear points from the recent discussion
- Avoid starting with "皆さま" - respond naturally to the conversation
- Use concrete examples or analogies to clarify complex concepts
- Connect your clarification back to the main question
- Keep response focused and engaging (150-200 words)
- End with a question that deepens the inquiry

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
        reasoning: `Facilitator clarification: ${reason}`
      }
    };
  }

  private async askForPerspectiveShift(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language
  ): Promise<Message> {
    const prompt = `
We are discussing: "${this.originalQuery}"

The facilitator suggests introducing a different perspective to enrich the discussion about this topic.

Reason: ${reason}

Please consider "${this.originalQuery}" from an alternative angle, challenge existing assumptions about this topic, or introduce a viewpoint that hasn't been fully explored yet.
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
        reasoning: `Facilitator perspective shift: ${reason}`
      }
    };
  }

  private async askForSummary(
    agent: BaseAgent,
    messages: Message[],
    language: Language
  ): Promise<Message> {
    const prompt = `
We are discussing: "${this.originalQuery}"

Please provide a summary of our discussion about this topic, highlighting:
1. Key insights about "${this.originalQuery}" that have been established
2. Areas of agreement among participants regarding this topic
3. Remaining questions or disagreements about "${this.originalQuery}"
4. The overall direction of our exploration of this topic

Keep the summary focused on "${this.originalQuery}" and be both concise and comprehensive.
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
        reasoning: 'Facilitator-requested summary'
      }
    };
  }

  private async askForRedirect(
    agent: BaseAgent,
    reason: string,
    messages: Message[],
    language: Language
  ): Promise<Message> {
    // Get recent context to understand what specifically has drifted
    const recentContext = messages.slice(-4);
    const contextText = recentContext.map(m =>
      `${m.agentId}: "${m.content.slice(0, 130)}..."`
    ).join('\n\n');

    const prompt = `
ORIGINAL DISCUSSION: "${this.originalQuery}"

RECENT CONVERSATION (may have drifted):
${contextText}

REDIRECTION NEEDED: ${reason}

Looking at how the conversation has evolved, please help refocus on "${this.originalQuery}" by providing a specific new angle or insight.

GUIDELINES:
- Don't start with generic acknowledgments like "皆さま" or "これまでの議論で"
- Reference specific points from the recent conversation above
- Identify what specific aspect of the drift needs addressing
- Bring a fresh perspective that connects back to the core question
- Be direct and engaging (150-200 words)
- End with a focused question that brings us back on track

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
        reasoning: `Facilitator redirect: ${reason}`
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

        // 全ファイナライザーで協力してFinalize（最後のものを返す）
        let finalMessage: Message;
        for (const [index, finalizer] of finalizers.entries()) {
          const isFirst = index === 0;
          const isLast = index === finalizers.length - 1;

          const collaborativePrompt = `
We have been exploring: "${this.originalQuery}"

As one of ${finalizers.length} finalizers selected through democratic voting, you share the responsibility of providing the concluding synthesis with: ${finalizers.filter(f => f !== finalizer).map(f => f.getAgent().name).join(', ')}.

${isFirst ? 'As the FIRST finalizer, please begin the collaborative synthesis by' : (isLast ? 'As the FINAL finalizer, building on previous analyses, please provide the concluding synthesis that' : `As the ${index + 1}/${finalizers.length} finalizer, please build upon the previous analysis and add your perspective by`)}:

${isFirst ? `1. **Initial Analysis**: Begin the synthesis of key insights about "${this.originalQuery}" from our entire conversation
2. **Framework Setting**: Establish the analytical framework that captures different dimensions explored
3. **Foundation Building**: Lay the groundwork for integration of diverse viewpoints` :
(isLast ? `1. **Comprehensive Integration**: Complete the synthesis by weaving together all previous analyses with final insights
2. **Ultimate Convergence**: Present the culminating understanding of "${this.originalQuery}"
3. **Legacy & Future**: Articulate the lasting significance and future directions for exploration` :
`1. **Complementary Analysis**: Add your unique perspective to deepen the ongoing synthesis
2. **Bridge Building**: Connect different viewpoints and fill analytical gaps
3. **Perspective Enhancement**: Contribute specialized insights from your analytical approach`)}

RECENT DISCUSSION CONTEXT:
${contextText}

${isFirst ? 'Please provide the opening synthesis that establishes the foundation for our collaborative conclusion.' :
(isLast ? 'Please provide the final synthesis that brings together all perspectives into a unified, profound conclusion.' :
'Please provide your complementary analysis that enriches the collaborative synthesis.')}
`;

          const personality = (finalizer as any).getPersonalityPrompt(language);

          const response = await (finalizer as any).executeAIWithErrorHandling(
            collaborativePrompt,
            personality,
            finalizer.getSessionId() || 'dynamic-session',
            'finalize' as any,
            `collaborative final synthesis ${index + 1}/${finalizers.length}`
          );

          finalMessage = {
            id: this.generateMessageId(),
            agentId: finalizer.getAgent().id,
            content: response,
            timestamp: new Date(),
            role: 'agent',
            stage: 'finalize',
            metadata: {
              reasoning: `Collaborative finalizer synthesis (${index + 1}/${finalizers.length}) selected through democratic voting process`
            }
          };
        }

        return finalMessage!;

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

    const primaryAction = dialogueState.suggestedActions[0];
    const content = this.formatFacilitatorActionContent(primaryAction, dialogueState, round, language);

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
        priority: primaryAction.priority
      }
    };
  }

  // ファシリテーターアクションの内容をフォーマット
  private formatFacilitatorActionContent(
    action: FacilitatorAction,
    dialogueState: DialogueState,
    round: number,
    language: Language
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

    const actionName = actionDescriptions[language]?.[action.type] || action.type;
    const consensusLevel = Math.round(dialogueState.overallConsensus * 10) / 10;

    if (language === 'ja') {
      return `🔧 **ラウンド ${round} - ファシリテーター判断**

**アクション**: ${actionName}
**対象**: ${action.target || '全体'}
**コンセンサス**: ${consensusLevel}/10
**理由**: ${action.reason}

*この判定により対話の流れを調整します*`;
    } else {
      return `🔧 **Round ${round} - Facilitator Decision**

**Action**: ${actionName}
**Target**: ${action.target || 'Overall'}
**Consensus**: ${consensusLevel}/10
**Reason**: ${action.reason}

*This decision guides the dialogue flow*`;
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
}