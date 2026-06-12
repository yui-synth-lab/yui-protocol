import { FacilitatorAgent } from '../agents/facilitator-agent.js';
import type { DialogueAgent, DialogueEventSink, FacilitatorPort } from '../dialogue/contracts.js';
import { Message, Session, Agent, AgentResponse, SessionConsensusSnapshot, AgentConsensusData, DialogueStage } from '../types/index.js';
import { ConsensusIndicator, DialogueState, DynamicRound, FacilitatorAction, DynamicInstruction } from '../types/consensus.js';
import { RAGRetriever } from './rag/rag-retriever.js';
import { SessionStorage } from './session-storage.js';
import { Language } from '../templates/prompts.js';
import { createFacilitatorMessage, createConsensusMessage } from '../utils/message-converters.js';
import { createConvergenceMessage } from '../utils/convergence-messages.js';
import { getV2ConsensusConfig } from '../config/v2-config-loader.js';
import { ConvergenceJudge } from '../dialogue/convergence-judge.js';
import { ConsensusCollector } from '../orchestration/v2/consensus-collector.js';
import { FinalizationService } from '../orchestration/v2/finalization-service.js';
import { FacilitatorActionExecutor } from '../orchestration/v2/action-executor.js';

export class DynamicDialogueRouter {
  private facilitator: FacilitatorPort;
  private maxRounds: number;
  private convergenceJudge: ConvergenceJudge;
  private llmCallEstimate: number = 0; // M7: セッション内のLLM呼び出し概数（バジェット判定用）
  private sessionStorage: SessionStorage;
  private consensusCollector = new ConsensusCollector();
  private finalizationService: FinalizationService;
  private actionExecutor: FacilitatorActionExecutor;
  private wsEmitter?: (event: string, data: any) => void; // WebSocket emitter
  private originalQuery: string = ''; // 初期クエリを保持
  private recentSpeakers: string[] = []; // 最近発言したエージェントを追跡
  private agentParticipationCount: Map<string, number> = new Map(); // エージェントの発言回数
  private agentNamesById: Map<string, string> = new Map(); // 参加エージェントの ID→表示名
  private initialThoughts: Message[] = []; // Individual Thoughtの結果を保持
  private currentRound: number = 0; // 現在のラウンド番号
  private ragRetriever?: RAGRetriever; // v2.0: RAG不協和音検出用

  constructor(
    sessionStorage: SessionStorage,
    wsEmitter?: DialogueEventSink,
    ragRetriever?: RAGRetriever, // v2.0: RAG不協和音検出用（オプショナル）
    facilitator?: FacilitatorPort // 通常は bootstrap から注入される（未指定時は既定のファシリテーター）
  ) {
    this.facilitator = facilitator ?? new FacilitatorAgent();
    this.sessionStorage = sessionStorage;
    this.wsEmitter = wsEmitter;
    this.ragRetriever = ragRetriever;

    // Load configuration
    const consensusConfig = getV2ConsensusConfig();
    this.maxRounds = consensusConfig.maxRounds;
    // 収束判定を config に接続（従来は 7.0/8.0 等がハードコードされ convergenceThreshold は未使用だった）
    this.convergenceJudge = new ConvergenceJudge({
      convergenceThreshold: consensusConfig.convergenceThreshold,
      minRoundsForConvergence: consensusConfig.minRoundsForConvergence,
      highSatisfactionThreshold: consensusConfig.highSatisfactionThreshold,
      minRoundsForSatisfactionConvergence: consensusConfig.minRoundsForSatisfactionConvergence,
      maxLlmCallsPerSession: consensusConfig.maxLlmCallsPerSession
    });

    // ファイナライズ（投票・協調finalize）は FinalizationService に抽出済み（Phase 3）
    this.finalizationService = new FinalizationService({
      getOriginalQuery: () => this.originalQuery,
      getFacilitator: () => this.facilitator,
      emitEvent: (event, data) => this.emitWebSocketEvent(event, data),
      generateMessageId: () => this.generateMessageId(),
      countLlmCall: () => { this.llmCallEstimate++; }
    });

    // ファシリテーターアクション実行は FacilitatorActionExecutor に抽出済み（Phase 3）
    this.actionExecutor = new FacilitatorActionExecutor({
      getOriginalQuery: () => this.originalQuery,
      getFacilitator: () => this.facilitator,
      getRagRetriever: () => this.ragRetriever,
      generateMessageId: () => this.generateMessageId(),
      buildFullContext: (recent, exclude) => this.buildFullContext(recent, exclude),
      selectBalancedAgent: (agents, style, excludeRecent) => this.selectBalancedAgent(agents, style, excludeRecent),
      trackAgentParticipation: (id) => this.trackAgentParticipation(id),
      getParticipationCount: (id) => this.agentParticipationCount.get(id),
      getCurrentRound: () => this.currentRound
    });
  }

  async conductDynamicDialogue(
    initialQuery: string,
    agents: Record<string, DialogueAgent>,
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
    this.llmCallEstimate = 0; // LLM呼び出しカウンタをリセット（M7）
    this.agentNamesById.clear();
    agentList.forEach(agent => {
      this.agentParticipationCount.set(agent.getAgent().id, 0);
      this.agentNamesById.set(agent.getAgent().id, agent.getAgent().name);
    });

    // ファシリテーターへ実参加エージェントを通知（ハードコードIDの排除）
    this.facilitator.setKnownAgents(agentList.map(a => a.getAgent().id));

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

      // 収束判定（ConvergenceJudge に抽出。config 接続済み・バジェット超過時は強制収束: M7）
      const decision = this.convergenceJudge.judge(consensusData, dialogueState, round, this.llmCallEstimate);
      if (decision.converged) {
        console.log(`[DynamicRouter] Convergence reached. Consensus: ${dialogueState.overallConsensus}, Satisfaction: ${decision.averageSatisfaction}, Ready: ${decision.readyToMoveCount}/${decision.totalAgentsChecked}, Round: ${round}${decision.budgetExceeded ? ' (LLM call budget exceeded)' : ''}`);

        // 収束説明メッセージを追加
        const convergenceMessage = createConvergenceMessage(
          decision.reason!,
          round,
          dialogueState.overallConsensus,
          decision.readyToMoveCount,
          consensusData.length,
          sessionId,
          language,
          `平均満足度: ${decision.averageSatisfaction.toFixed(1)}/10${decision.budgetExceeded ? ' ※LLM呼び出しバジェット上限（M7）到達による収束' : ''}`
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
      // ファシリテーター分析(1) + 実行アクション数を呼び出し概数に計上（M7）
      this.llmCallEstimate += 1 + nextActions.length;

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
    agents: DialogueAgent[],
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
    agents: DialogueAgent[],
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
        this.llmCallEstimate++;

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

  // コンセンサス収集・解析は orchestration/v2/consensus-collector.ts に抽出済み（Phase 3）。
  // askForConsensus はテストからスタブされるため、コールバックとして注入する。
  private async gatherConsensus(
    agents: DialogueAgent[],
    messages: Message[],
    language: Language,
    currentRound: number = 0
  ): Promise<ConsensusIndicator[]> {
    return this.consensusCollector.gather(
      agents,
      messages,
      language,
      currentRound,
      (agent, msgs, lang, round) => this.askForConsensus(agent, msgs, lang, round),
      () => { this.llmCallEstimate++; }
    );
  }

  private async askForConsensus(
    agent: DialogueAgent,
    messages: Message[],
    language: Language,
    currentRound: number = 0
  ): Promise<ConsensusIndicator> {
    const prompt = this.consensusCollector.buildConsensusPrompt(this.originalQuery, messages, language, currentRound);

    // コンセンサス確認は様式化タスクのため mechanical tier で実行可能（M2、config オプトイン）
    const response = await agent.executeWithPersonality(
      prompt,
      'consensus-check' as DialogueStage,
      'consensus gathering',
      language,
      'dynamic-session',
      'mechanical'
    );

    return this.parseConsensusResponse(response, agent.getAgent().id);
  }

  private parseConsensusResponse(response: string, agentId: string): ConsensusIndicator {
    return this.consensusCollector.parseConsensusResponse(response, agentId);
  }


  // ファシリテーターアクション実行（dispatch・5種プロンプト）は
  // orchestration/v2/action-executor.ts に抽出済み（Phase 3）。
  // conductDynamicDialogue から呼ばれるため薄い委譲を残す。
  private async executeActions(
    actions: any[],
    agents: DialogueAgent[],
    messages: Message[],
    language: Language,
    recommendedActionCount?: number
  ): Promise<Message[]> {
    return this.actionExecutor.executeActions(actions, agents, messages, language, recommendedActionCount);
  }

  // RAG不協和音検出は FacilitatorActionExecutor に抽出済み（Phase 3）。
  // tests/rag-dissonance.test.ts がルーター経由でアクセスするため委譲を残す。
  private async detectRAGDissonance(
    currentTopic: string,
    messages: Message[],
    minSimilarityThreshold: number = 0.75
  ): Promise<DynamicInstruction['ragDissonance'] | null> {
    return this.actionExecutor.detectRAGDissonance(currentTopic, messages, minSimilarityThreshold);
  }

  // ファイナライズ（投票選出・単独/協調finalize）は orchestration/v2/finalization-service.ts に抽出済み（Phase 3）
  private async generateFinalOutput(
    messages: Message[],
    agents: DialogueAgent[],
    language: Language,
    sessionId: string,
    round: number
  ): Promise<Message | null> {
    return this.finalizationService.generateFinalOutput(
      messages, agents, language, sessionId, round,
      (agent, msgs, lang, all) => this.askForVote(agent, msgs, lang, all)
    );
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

    // セッション参加エージェントを初期化（0で開始、conductDynamicDialogue で登録済み）
    for (const agentId of this.agentParticipationCount.keys()) {
      balance[agentId] = 0;
    }

    // participantStatesから実際の参加カウントを設定
    dialogueState.participantStates.forEach(state => {
      balance[state.agentId] = 1; // 参加している場合は1
    });

    return balance;
  }

  // v1の投票システムを踏襲してFinalize担当を選出
  // v1の投票システムを踏襲してFinalize担当を選出（実体は FinalizationService）
  private async selectFinalizerByVoting(
    messages: Message[],
    agents: DialogueAgent[],
    language: Language,
    sessionId: string,
    round: number
  ): Promise<DialogueAgent[]> {
    return this.finalizationService.selectFinalizerByVoting(
      messages, agents, language, sessionId, round,
      (agent, msgs, lang, all) => this.askForVote(agent, msgs, lang, all)
    );
  }

  // 各エージェントから投票を取得
  private async askForVote(
    agent: DialogueAgent,
    messages: Message[],
    language: Language,
    allAgents: DialogueAgent[]
  ): Promise<{ agentId: string; voteFor: string | undefined; voteReasoning?: string }> {
    const prompt = this.finalizationService.buildVotePrompt(agent, messages, language, allAgents);
    const validAgents = allAgents
      .filter(a => a.getAgent().id !== agent.getAgent().id)
      .map(a => a.getAgent().id);

    // 投票は様式化タスクのため mechanical tier で実行可能（M2、config オプトイン）
    const response = await agent.executeWithPersonality(
      prompt,
      'voting',
      'finalizer voting',
      language,
      'dynamic-vote',
      'mechanical'
    );
    this.llmCallEstimate++;

    return this.parseVoteResponse(response, agent.getAgent().id, validAgents, allAgents);
  }

  // 投票レスポンスを解析（実体は FinalizationService）
  private parseVoteResponse(
    response: string,
    voterId: string,
    validAgents: string[],
    allAgents?: DialogueAgent[]
  ): { agentId: string; voteFor: string | undefined; voteReasoning?: string } {
    return this.finalizationService.parseVoteResponse(response, voterId, validAgents, allAgents);
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
  private selectBalancedAgent(agents: DialogueAgent[], preferredStyle?: string, excludeRecent: boolean = true): DialogueAgent {
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

  // Helper to get agent name（conductDynamicDialogue で参加エージェントから登録）
  private getAgentName(agentId: string): string {
    return this.agentNamesById.get(agentId) || agentId;
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
