import { Agent, Message } from '../types/index.js';
import { ConsensusIndicator, DialogueState, FacilitatorAction, DynamicRound, FacilitatorLog, DynamicInstruction } from '../types/consensus.js';
import { AIExecutor, createAIExecutor } from '../kernel/ai-executor.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { FACILITATOR_ANALYSIS_PROMPT } from '../templates/v2-prompts.js';
import { getV2ConsensusConfig, getV2FacilitatorConfig } from '../config/v2-config-loader.js';
import { shuffleArray } from '../utils/random.js';

export class FacilitatorAgent {
  private readonly agentId = 'facilitator-001';
  private aiExecutor?: AIExecutor;
  private roundHistory: DynamicRound[] = [];
  private sessionLogs: FacilitatorLog[] = [];
  private currentSessionId?: string;

  // Silent facilitator settings
  private readonly WORD_LIMIT_MIN = 150;
  private readonly WORD_LIMIT_MAX = 200;
  private readonly AGENT_NAMES = ['eiro-001', 'yui-000', 'hekito-001', 'yoga-001', 'kanshi-001'];
  private agentParticipationCount: Record<string, number> = {};
  private currentTopicKeywords: string[] = [];
  private interactionLogger: InteractionLogger;

  constructor(sessionId?: string, interactionLogger?: InteractionLogger) {
    this.currentSessionId = sessionId;
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.initializeAgentTracking();
    this.initializeAIExecutor();
  }

  // 外部から発言数を同期するメソッド
  public updateParticipationCount(participationMap: Map<string, number>): void {
    this.AGENT_NAMES.forEach(agentId => {
      this.agentParticipationCount[agentId] = participationMap.get(agentId) || 0;
    });
    console.log(`[Facilitator] Updated participation counts:`, this.agentParticipationCount);
  }

  // Initial Thoughtの発言順序を決定
  async determineInitialSpeakingOrder(
    query: string,
    agents: { id: string; name: string; style: string; expertise: string[] }[]
  ): Promise<string[]> {
    if (!this.aiExecutor) {
      await this.initializeAIExecutor();
    }

    const agentList = agents.map(a =>
      `- ${a.id} (${a.name}): ${a.style} style, expertise in ${a.expertise.join(', ')}`
    ).join('\n');

    const prompt = `You are the facilitator of a dialogue. Given the following query and agent profiles, determine the optimal speaking order for the initial round of discussion.

QUERY: "${query}"

AVAILABLE AGENTS:
${agentList}

GUIDELINES FOR ORDERING:
1. Consider which agent's perspective would provide the best foundation for others to build upon
2. Order agents so that later speakers can meaningfully build on earlier contributions
3. Consider expertise relevance to the query
4. Aim for diversity of perspectives across the sequence
5. Think about which styles complement each other when sequenced

Respond ONLY with a JSON array of agent IDs in the desired speaking order, like this:
["agent-id-1", "agent-id-2", "agent-id-3", "agent-id-4", "agent-id-5"]

No explanation needed - just the JSON array.`;

    try {
      const response = await this.aiExecutor!.execute(prompt, '');
      const cleanResponse = response.content.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const order = JSON.parse(cleanResponse);

      // Validate that all agent IDs are present
      const agentIds = agents.map(a => a.id);
      if (Array.isArray(order) && order.length === agentIds.length &&
          order.every(id => agentIds.includes(id))) {
        console.log(`[Facilitator] Determined speaking order: ${order.join(' → ')}`);
        return order;
      } else {
        console.warn(`[Facilitator] Invalid order returned, using random shuffle`);
        return shuffleArray([...agentIds]);
      }
    } catch (error) {
      console.error(`[Facilitator] Error determining speaking order:`, error);
      // Fallback to random shuffle
      return shuffleArray(agents.map(a => a.id));
    }
  }



  private initializeAgentTracking() {
    this.AGENT_NAMES.forEach(agentId => {
      this.agentParticipationCount[agentId] = 0;
    });
  }

  private async initializeAIExecutor() {
    // Load model config from environment variables
    const provider = (process.env.AGENT_FACILITATOR_001_PROVIDER as 'openai' | 'anthropic' | 'gemini' | 'ollama') || 'openai';
    const model = process.env.AGENT_FACILITATOR_001_MODEL || 'gpt-4o';

    this.aiExecutor = await createAIExecutor('facilitator-001', {
      provider,
      model,
      temperature: 0.4,
      topP: 0.8,
      topK: 40
    });
  }

  async analyzeDialogueState(
    messages: Message[],
    consensusData: ConsensusIndicator[],
    roundNumber: number,
    originalQuery?: string
  ): Promise<DialogueState> {
    const startTime = new Date();
    const currentTopic = originalQuery || this.extractCurrentTopic(messages);
    const overallConsensus = this.calculateOverallConsensus(consensusData);
    const shouldContinue = this.shouldContinueDialogue(consensusData, roundNumber, overallConsensus);

    // Silent facilitator adjustments
    const silentAdjustments = await this.performSilentAdjustments(messages, roundNumber, originalQuery);

    // Check for topic drift
    const topicDrift = originalQuery ? this.detectTopicDrift(messages, originalQuery) : false;

    // Calculate processing duration
    const processingDuration = Date.now() - startTime.getTime();

    // Log the analysis
    const analysisLog: FacilitatorLog = {
      sessionId: this.currentSessionId || 'unknown',
      roundNumber,
      timestamp: startTime,
      action: 'analysis',
      decision: {
        type: 'state_analysis',
        reasoning: `Analyzed ${consensusData.length} agent states. Overall consensus: ${overallConsensus.toFixed(2)}. Should continue: ${shouldContinue}. Topic drift detected: ${topicDrift}`,
        dataAnalyzed: {
          consensusLevels: consensusData.reduce((acc, c) => ({ ...acc, [c.agentId]: c.satisfactionLevel }), {}),
          overallConsensus,
          shouldContinue,
          topicDrift
        },
        suggestedActions: [] // Will be populated by generateSuggestions
      }
    };

    const suggestedActions = await this.generateSuggestions(messages, consensusData, roundNumber, originalQuery);
    analysisLog.decision.suggestedActions = suggestedActions;

    this.sessionLogs.push(analysisLog);
    console.log(`[Facilitator] Analysis logged for round ${roundNumber}:`, analysisLog.decision.reasoning);

    // Log to SimplifiedInteractionLog
    await this.logToInteractionLogger(roundNumber, silentAdjustments, overallConsensus, processingDuration);

    // Determine recommended action count based on round and consensus
    const recommendedActionCount = this.determineActionCount(roundNumber, overallConsensus, consensusData);

    return {
      currentTopic,
      roundNumber,
      participantStates: consensusData,
      overallConsensus,
      suggestedActions,
      shouldContinue,
      recommendedActionCount
    };
  }

  public calculateOverallConsensus(indicators: ConsensusIndicator[]): number {
    if (indicators.length === 0) return 0;

    // Separate actual responses from early exit estimations
    const actualResponses = indicators.filter(ind =>
      !ind.reasoning?.includes('Early exit') &&
      !ind.reasoning?.includes('Error occurred')
    );
    const estimatedResponses = indicators.filter(ind =>
      ind.reasoning?.includes('Early exit') ||
      ind.reasoning?.includes('Error occurred')
    );

    const avgSatisfaction = indicators.reduce((sum, ind) => sum + ind.satisfactionLevel, 0) / indicators.length;
    const readyCount = indicators.filter(ind => ind.readyToMove).length;
    const readyRatio = readyCount / indicators.length;

    // Fixed consensus calculation: weight satisfaction more heavily than readiness
    // Satisfaction represents dialogue quality, readiness represents completion desire
    const satisfactionWeight = 0.8;
    const readinessWeight = 0.2;

    const satisfactionScore = avgSatisfaction; // Already 0-10 scale
    const readinessScore = readyRatio * 10; // Convert ratio to 0-10 scale

    const consensus = (satisfactionWeight * satisfactionScore) + (readinessWeight * readinessScore);

    // Log the breakdown for transparency
    if (estimatedResponses.length > 0) {
      const actualAvg = actualResponses.length > 0
        ? actualResponses.reduce((sum, ind) => sum + ind.satisfactionLevel, 0) / actualResponses.length
        : 0;
      console.log(`[Facilitator] Consensus calculation: ${actualResponses.length} actual responses (avg: ${actualAvg.toFixed(1)}), ${estimatedResponses.length} estimated (avg satisfaction used: ${avgSatisfaction.toFixed(1)})`);
    }

    return Math.round(consensus * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Determine how many actions should be executed in this round
   * Based on round number, consensus level, and dialogue dynamics
   *
   * Strategy:
   * - Early rounds (1-3): More actions (2-3) to explore diverse perspectives
   * - Mid rounds (4-7): Balanced (1-2) based on consensus
   * - Late rounds (8+): Fewer actions (1) to allow convergence
   * - Low consensus: More actions to stimulate discussion
   * - High consensus: Fewer actions to avoid over-discussion
   */
  private determineActionCount(
    roundNumber: number,
    overallConsensus: number,
    consensusData: ConsensusIndicator[]
  ): number {
    const avgSatisfaction = consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length;
    const hasAdditionalPointsCount = consensusData.filter(c => c.hasAdditionalPoints).length;

    // Early rounds: More exploration
    if (roundNumber <= 2) {
      console.log(`[Facilitator] Round ${roundNumber}: Early exploration phase - recommending 2-3 actions`);
      return hasAdditionalPointsCount >= 3 ? 3 : 2;
    }

    // Mid rounds: Balanced approach
    if (roundNumber <= 7) {
      // Low consensus: stimulate with more actions
      if (avgSatisfaction < 5.5) {
        console.log(`[Facilitator] Round ${roundNumber}: Low satisfaction (${avgSatisfaction.toFixed(1)}) - recommending 2-3 actions`);
        return hasAdditionalPointsCount >= 2 ? 3 : 2;
      }
      // Medium consensus: moderate actions
      if (avgSatisfaction < 7.5) {
        console.log(`[Facilitator] Round ${roundNumber}: Medium satisfaction (${avgSatisfaction.toFixed(1)}) - recommending 2 actions`);
        return 2;
      }
      // High consensus: fewer actions
      console.log(`[Facilitator] Round ${roundNumber}: High satisfaction (${avgSatisfaction.toFixed(1)}) - recommending 1 action`);
      return 1;
    }

    // Late rounds: Focus on convergence
    if (avgSatisfaction >= 7.0 || overallConsensus >= 7.5) {
      console.log(`[Facilitator] Round ${roundNumber}: Late round with good consensus - recommending 1 action`);
      return 1;
    }

    // Still struggling late: give it one more push
    console.log(`[Facilitator] Round ${roundNumber}: Late round but low consensus - recommending 2 actions`);
    return 2;
  }

  private shouldContinueDialogue(
    consensusData: ConsensusIndicator[],
    roundNumber: number,
    overallConsensus: number
  ): boolean {
    const consensusConfig = getV2ConsensusConfig();

    // Natural termination conditions based on actual consensus and config
    const readyToMoveCount = consensusData.filter(c => c.readyToMove).length;
    const averageSatisfaction = consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length;
    const noAdditionalPoints = consensusData.filter(c => !c.hasAdditionalPoints).length;
    const majorityReadyThreshold = Math.ceil(consensusData.length / 2);

    console.log(`[Facilitator] Consensus analysis: satisfaction=${averageSatisfaction.toFixed(1)}, ready=${readyToMoveCount}/${consensusData.length}, round=${roundNumber}`);

    // EARLY ROUNDS: Encourage more discussion (rounds 0-2)
    if (roundNumber <= 2) {
      console.log(`[Facilitator] Early round ${roundNumber}: Encouraging continued discussion`);
      return true; // Always continue in early rounds
    }

    // MID ROUNDS: More selective conditions (rounds 3-4)
    if (roundNumber <= 4) {
      // Only allow termination with very high satisfaction and unanimous readiness
      if (averageSatisfaction >= 8.5 && readyToMoveCount === consensusData.length) {
        console.log(`[Facilitator] Mid-round early termination: Very high satisfaction (${averageSatisfaction.toFixed(1)}) + all ready`);
        return false;
      }
      console.log(`[Facilitator] Mid-round ${roundNumber}: Continuing discussion (satisfaction=${averageSatisfaction.toFixed(1)}, ready=${readyToMoveCount}/${consensusData.length})`);
      return true;
    }

    // LATER ROUNDS: Original conditions (rounds 5+)

    // Condition 1: Strong consensus after sufficient rounds
    if (roundNumber >= 5 && averageSatisfaction >= 8.0 && readyToMoveCount >= 4) {
      console.log(`[Facilitator] Condition 1 met: High satisfaction (${averageSatisfaction.toFixed(1)}) + most ready (${readyToMoveCount})`);
      return false;
    }

    // Condition 2: Good meaningful dialogue achieved
    if (roundNumber >= 6 && averageSatisfaction >= 7.0 && readyToMoveCount >= majorityReadyThreshold) {
      console.log(`[Facilitator] Condition 2 met: Good satisfaction (${averageSatisfaction.toFixed(1)}) + majority ready (${readyToMoveCount}/${consensusData.length})`);
      return false;
    }

    // Condition 3: Balanced consensus with readiness
    if (roundNumber >= 7 && averageSatisfaction >= consensusConfig.convergenceThreshold && readyToMoveCount >= 3) {
      console.log(`[Facilitator] Condition 3 met: Config threshold satisfaction (${averageSatisfaction.toFixed(1)}) + some ready (${readyToMoveCount})`);
      return false;
    }

    // Condition 4: High overall consensus regardless of individual readiness
    if (roundNumber >= 7 && overallConsensus >= 8.5 && averageSatisfaction >= 6.5) {
      console.log(`[Facilitator] Condition 4 met: High overall consensus (${overallConsensus.toFixed(1)}) + decent satisfaction (${averageSatisfaction.toFixed(1)})`);
      return false;
    }

    // Condition 5: Prevent excessive rounds with reasonable satisfaction (use config maxRounds)
    if (roundNumber >= consensusConfig.maxRounds && averageSatisfaction >= consensusConfig.minSatisfactionLevel) {
      console.log(`[Facilitator] Condition 5 met: Max rounds (${roundNumber}) + minimum satisfaction (${averageSatisfaction.toFixed(1)})`);
      return false;
    }

    // Condition 6: Very strong consensus signals in very late rounds
    if (roundNumber >= 8 && overallConsensus >= 9.0 && readyToMoveCount >= 3) {
      console.log(`[Facilitator] Condition 6 met: Very high consensus (${overallConsensus.toFixed(1)}) + some ready (${readyToMoveCount})`);
      return false;
    }

    console.log(`[Facilitator] Continuing dialogue: conditions not met`);
    return true;
  }

  // Silent facilitator adjustments for each turn
  public async performSilentAdjustments(messages: Message[], roundNumber: number, originalQuery?: string) {
    // 全エージェントの参加カウントを初期化
    const participationBalance: Record<string, number> = {};
    this.AGENT_NAMES.forEach(agentId => {
      participationBalance[agentId] = 0;
    });

    // 現在のセッションで参加したエージェントをカウント（全メッセージをチェック）
    const agentMessages = messages.filter(msg =>
      msg.agentId !== 'user' &&
      msg.agentId !== 'facilitator-001' &&
      msg.stage !== 'voting' && // 投票メッセージは除外
      msg.stage !== 'facilitator' && // ファシリテーターメッセージは除外
      this.AGENT_NAMES.includes(msg.agentId) // 知られているエージェントのみ
    );

    // エージェントごとの参加カウント
    const agentParticipation: Record<string, number> = {};
    agentMessages.forEach(msg => {
      agentParticipation[msg.agentId] = (agentParticipation[msg.agentId] || 0) + 1;
    });

    // 参加カウントをparticipationBalanceに設定
    this.AGENT_NAMES.forEach(agentId => {
      participationBalance[agentId] = agentParticipation[agentId] || 0;
    });

    // コンセンサス状態を作成（簡易版）
    const mockConsensus: ConsensusIndicator[] = this.AGENT_NAMES.map(agentId => ({
      agentId,
      satisfactionLevel: 7, // デフォルト値
      hasAdditionalPoints: participationBalance[agentId] < 2, // 参加が少ない場合は追加ポイントありと仮定
      questionsForOthers: [],
      readyToMove: participationBalance[agentId] >= 2, // 2回以上参加した場合は準備できていると仮定
      reasoning: 'Based on participation analysis'
    }));

    // AI生成アクションを取得
    const suggestedActions = await this.generateSuggestions(messages, mockConsensus, roundNumber, originalQuery);
    const primaryAction = suggestedActions[0];

    // ファシリテーターアクションを AI の提案に基づいて決定
    const facilitatorAction = primaryAction ? primaryAction.type : 'maintain_balance';
    let wordCountAdjustments: string[] = [];

    // 参加の少ないエージェントを特定
    const lessActiveAgents = this.AGENT_NAMES.filter(agentId =>
      participationBalance[agentId] === 0 || participationBalance[agentId] < Math.max(1, Object.values(participationBalance).reduce((a, b) => a + b, 0) / this.AGENT_NAMES.length)
    );

    if (lessActiveAgents.length > 0) {
      wordCountAdjustments.push(`Encourage ${lessActiveAgents.slice(0, 2).join(', ')} to speak`);
    } else {
      wordCountAdjustments.push('All agents maintain 150-200 words');
    }

    // サイレントエージェントは完全に参加していないエージェント
    const silentAgents = this.AGENT_NAMES.filter(agentId =>
      participationBalance[agentId] === 0
    );

    return {
      facilitator_action: facilitatorAction,
      participation_balance: participationBalance,
      word_count_adjustments: wordCountAdjustments,
      dominant_speakers: [], // 現在は使用しない
      silent_agents: silentAgents
    };
  }

  // Detect topic shifts in the conversation
  public detectTopicShift(messages: Message[]): boolean {
    if (messages.length < 6) return false;

    const recent3 = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
    const previous3 = messages.slice(-6, -3).map(m => m.content.toLowerCase()).join(' ');

    // Extract key terms from both periods
    const recentTerms = this.extractKeywords(recent3);
    const previousTerms = this.extractKeywords(previous3);

    // Check overlap
    const commonTerms = recentTerms.filter(term => previousTerms.includes(term));
    const overlapRatio = commonTerms.length / Math.max(recentTerms.length, previousTerms.length, 1);

    // Topic shift detected if less than 40% overlap
    return overlapRatio < 0.4;
  }

  /**
   * 対話の「欠落」や「安易な合意」を検知
   * v2.0: 動的インストラクション生成のトリガー判定
   */
  public detectDialoguePattern(
    messages: Message[],
    consensusData: ConsensusIndicator[],
    roundNumber: number
  ): 'easy_consensus' | 'dialogue_gap' | 'topic_stagnation' | null {
    if (consensusData.length === 0) return null;

    const avgSatisfaction = consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensusData.length;
    const readyCount = consensusData.filter(c => c.readyToMove).length;

    // 安易な合意: 早期ラウンド(1-3)で高い満足度(>=7.0) + 多数が移行可能
    // v2.0: 閾値を7.5→7.0に調整（発火しやすく）
    if (roundNumber <= 3 && avgSatisfaction >= 7.0 && readyCount >= consensusData.length * 0.8) {
      console.log(`[Facilitator] Detected easy_consensus: round=${roundNumber}, avgSatisfaction=${avgSatisfaction.toFixed(1)}, readyRatio=${(readyCount / consensusData.length * 100).toFixed(0)}%`);
      return 'easy_consensus';
    }

    // 対話の行き詰まり: 低満足度 + 追加ポイントなし
    // v2.0: 閾値を5.5→6.0に調整（発火しやすく）
    const hasAdditionalCount = consensusData.filter(c => c.hasAdditionalPoints).length;
    if (avgSatisfaction < 6.0 && hasAdditionalCount === 0) {
      console.log(`[Facilitator] Detected dialogue_gap: avgSatisfaction=${avgSatisfaction.toFixed(1)}, hasAdditionalCount=${hasAdditionalCount}`);
      return 'dialogue_gap';
    }

    // トピック停滞: ラウンド3以降で最近のメッセージに多様性がない
    if (roundNumber >= 3 && !this.detectTopicShift(messages) && messages.length >= 6) {
      const recentContent = messages.slice(-6).map(m => m.content).join(' ');
      const uniqueTerms = new Set(recentContent.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      if (uniqueTerms.size < 15) {
        console.log(`[Facilitator] Detected topic_stagnation: round=${roundNumber}, uniqueTerms=${uniqueTerms.size}`);
        return 'topic_stagnation';
      }
    }

    return null;
  }

  /**
   * メタレベルの動的指示を生成
   * トーン: 「問いを閉じず、矛盾を資源とする」プロジェクト哲学を反映
   */
  public async generateDynamicInstruction(
    pattern: 'easy_consensus' | 'dialogue_gap' | 'topic_stagnation',
    action: FacilitatorAction,
    messages: Message[],
    roundNumber: number
  ): Promise<DynamicInstruction> {
    const instructionTemplates: Record<string, string> = {
      'easy_consensus': `この問いを早急に閉じないでください。現在の合意は表面的かもしれません。
問いかけ：私たち全員が無意識に前提としていることは何か？考慮されていない視点は？
矛盾をより深い理解への資源として扱ってください。`,

      'dialogue_gap': `対話が行き詰まりました。解決を強制するのではなく：
- 真に不確実なものを価値あるものとして認める
- 簡単な答えに抵抗する核心の緊張を特定する
- 問いかけ：これを「解決」ではなく「より興味深く」するには？`,

      'topic_stagnation': `対話が循環しています。以前の論点を繰り返さないでください。
代わりに：真に新しい角度を導入するか、暗黙の前提に挑戦するか、
このトピックを予想外の何かと結びつけてください。`
    };

    const toneMap: Record<string, 'exploratory' | 'deconstructive' | 'integrative'> = {
      'easy_consensus': 'deconstructive',
      'dialogue_gap': 'exploratory',
      'topic_stagnation': 'integrative'
    };

    console.log(`[Facilitator] Generated dynamic instruction for ${pattern}, action: ${action.type}`);

    return {
      content: instructionTemplates[pattern],
      tone: toneMap[pattern],
      metadata: {
        triggerReason: pattern,
        generatedAt: new Date()
      }
    };
  }

  // Enhanced word count control for agent responses
  public createWordCountGuidance(agentId: string, dominantSpeakers: string[], silentAgents: string[]): string {
    let guidance = '';

    if (dominantSpeakers.includes(agentId)) {
      guidance = `Keep your response concise (150 words maximum). Allow others space to contribute. `;
    } else if (silentAgents.includes(agentId)) {
      guidance = `Please share your perspective more fully (aim for 180-200 words). Your voice is needed in this discussion. `;
    } else {
      guidance = `Maintain balanced participation (150-200 words). `;
    }

    // Always add ending guidance
    guidance += `End your response with either a thoughtful question or a meaningful metaphor to continue the dialogue. `;

    return guidance;
  }

  private async generateSuggestions(
    messages: Message[],
    consensus: ConsensusIndicator[],
    roundNumber: number,
    originalQuery?: string,
    silentAdjustments?: any
  ): Promise<FacilitatorAction[]> {
    if (!this.aiExecutor) {
      await this.initializeAIExecutor();
    }

    const recentMessages = messages.slice(-5).map(m => `${m.agentId}: ${m.content}`).join('\n');
    const consensusReport = consensus.map(c =>
      `${c.agentId}: Satisfaction ${c.satisfactionLevel}/10, Additional points: ${c.hasAdditionalPoints}, Ready: ${c.readyToMove}`
    ).join('\n');

    const originalTopicInfo = originalQuery ? `
ORIGINAL TOPIC: "${originalQuery}"
IMPORTANT: Keep the discussion focused on this original topic. If agents are drifting away from this topic, suggest actions to bring them back to "${originalQuery}".
` : '';

    // 最近のメッセージから発言者の偏りを分析
    const recentSpeakers = messages.slice(-5).map(m => m.agentId);
    const speakerCounts = recentSpeakers.reduce((acc, agentId) => {
      acc[agentId] = (acc[agentId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const balanceInfo = Object.entries(speakerCounts).length > 1 ?
      `\nSPEAKER BALANCE (last 5 messages): ${Object.entries(speakerCounts).map(([id, count]) => `${id}:${count}`).join(', ')}
BALANCE GUIDANCE: If one agent is dominating (3+ recent messages), encourage others to participate.` : '';

    const prompt = FACILITATOR_ANALYSIS_PROMPT
      .replace('{originalTopicInfo}', originalTopicInfo)
      .replace('{balanceInfo}', balanceInfo)
      .replace('{roundNumber}', roundNumber.toString())
      .replace('{consensusReport}', consensusReport)
      .replace('{recentMessages}', messages.slice(-3).map(m => `${m.agentId}: ${m.content.slice(0, 100)}...`).join('\n'))
      .replace('{availableAgents}', this.AGENT_NAMES.join(', '));

    const decisionLog: FacilitatorLog = {
      sessionId: this.currentSessionId || 'unknown',
      roundNumber,
      timestamp: new Date(),
      action: 'decision',
      decision: {
        type: 'action_generation',
        reasoning: 'Generating suggested actions based on consensus data and discussion state',
        dataAnalyzed: {
          consensusLevels: consensus.reduce((acc, c) => ({ ...acc, [c.agentId]: c.satisfactionLevel }), {}),
          overallConsensus: this.calculateOverallConsensus(consensus),
          shouldContinue: this.shouldContinueDialogue(consensus, roundNumber, this.calculateOverallConsensus(consensus)),
          topicDrift: originalQuery ? this.detectTopicDrift(messages, originalQuery) : false
        },
        suggestedActions: []
      }
    };

    try {
      const result = await this.aiExecutor!.execute(prompt, '');
      let cleanContent = result.content.trim();

      console.log(`[Facilitator] Raw response: ${result.content}`);

      // より堅牢なJSONクリーニング
      let jsonContent = '';

      // 複数のパターンを試してJSONを抽出
      const jsonPatterns = [
        /\[[\s\S]*?\]/,                    // Array pattern (main target)
        /```json\s*([\s\S]*?)\s*```/,      // Code block with json
        /```\s*([\s\S]*?)\s*```/,          // Generic code block
        /Your JSON array:\s*(\[[\s\S]*?\])/, // Specific prompt response
        /JSON response:\s*(\[[\s\S]*?\])/,   // Legacy prompt response
        /\{[\s\S]*?\}/                     // Object pattern (fallback)
      ];

      for (const pattern of jsonPatterns) {
        const match = cleanContent.match(pattern);
        if (match) {
          jsonContent = match[1] || match[0];
          break;
        }
      }

      // JSONが見つからない場合、整形を試みる
      if (!jsonContent) {
        // 文字列にJSONらしき部分があるかチェック
        if (cleanContent.includes('[') && cleanContent.includes(']')) {
          const startIndex = cleanContent.indexOf('[');
          const endIndex = cleanContent.lastIndexOf(']');
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            jsonContent = cleanContent.substring(startIndex, endIndex + 1);
          }
        }
      }

      // 最終的にJSONが取得できない場合はフォールバック
      if (!jsonContent || jsonContent.length < 3) {
        console.warn('[Facilitator] No valid JSON found in response, using fallback');
        throw new Error(`No valid JSON found in AI response: "${cleanContent.substring(0, 100)}..."`);
      }

      console.log(`[Facilitator] Extracted JSON: ${jsonContent}`);

      // JSON解析を安全に実行
      let suggestions;
      try {
        suggestions = JSON.parse(jsonContent);
      } catch (parseError) {
        console.warn('[Facilitator] JSON parse failed:', parseError);
        throw new Error(`JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
      }

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        const actions: FacilitatorAction[] = suggestions.map((s: any) => ({
          type: s.type || 'summarize',
          target: s.target || '',
          reason: s.reason || 'General discussion improvement',
          priority: s.priority || 5
        }));

        // v2.0: 対話パターンを検出し、必要に応じて動的指示を追加
        const dialoguePattern = this.detectDialoguePattern(messages, consensus, roundNumber);
        if (dialoguePattern) {
          for (const action of actions) {
            action.dynamicInstruction = await this.generateDynamicInstruction(
              dialoguePattern,
              action,
              messages,
              roundNumber
            );
          }
          console.log(`[Facilitator] Attached dynamic instructions to ${actions.length} actions (pattern: ${dialoguePattern})`);
        }

        decisionLog.decision.suggestedActions = actions;
        decisionLog.decision.reasoning = `Generated ${actions.length} actions via AI analysis${dialoguePattern ? ` with dynamic instructions (${dialoguePattern})` : ''}`;
        this.sessionLogs.push(decisionLog);

        return actions;
      } else {
        console.warn('[Facilitator] Invalid suggestions format, using fallback');
        const fallbackActions = this.generateFallbackSuggestions(consensus);

        decisionLog.decision.suggestedActions = fallbackActions;
        decisionLog.decision.reasoning = 'AI generation failed, used fallback logic';
        this.sessionLogs.push(decisionLog);

        return fallbackActions;
      }
    } catch (error) {
      console.warn('[Facilitator] Failed to parse facilitator suggestions, using fallback:', error);
      const fallbackActions = this.generateFallbackSuggestions(consensus);

      decisionLog.decision.suggestedActions = fallbackActions;
      decisionLog.decision.reasoning = `AI execution error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.sessionLogs.push(decisionLog);

      return fallbackActions;
    }
  }

  private generateFallbackSuggestions(consensus: ConsensusIndicator[]): FacilitatorAction[] {
    const facilitatorConfig = getV2FacilitatorConfig();
    const actionPriorities = facilitatorConfig.actionPriority;
    const actions: FacilitatorAction[] = [];

    // 設定優先度に基づいてアクションを生成（最高優先度から順番に）
    const actionTypes = Object.entries(actionPriorities)
      .sort(([,a], [,b]) => b - a) // 優先度順にソート（高い順）
      .map(([type]) => type as keyof typeof actionPriorities);

    console.log(`[Facilitator] Action priorities: ${JSON.stringify(actionPriorities)}`);

    for (const actionType of actionTypes) {
      const priority = actionPriorities[actionType];

      switch (actionType) {
        case 'perspective_shift': {
          // 質問を持っているエージェントや発言の少ないエージェント
          const candidates = consensus.filter(c =>
            c.questionsForOthers.length > 0 ||
            (this.agentParticipationCount[c.agentId] || 0) < 2
          ).sort((a, b) => {
            const countA = this.agentParticipationCount[a.agentId] || 0;
            const countB = this.agentParticipationCount[b.agentId] || 0;
            return countA - countB;
          });

          if (candidates.length > 0) {
            actions.push({
              type: 'perspective_shift',
              target: candidates[0].agentId,
              reason: `Encouraging fresh perspective from ${candidates[0].agentId} (${this.agentParticipationCount[candidates[0].agentId] || 0} contributions)`,
              priority
            });
          }
          break;
        }

        case 'clarification': {
          // 低い満足度のエージェント
          const unsatisfied = consensus.filter(c => c.satisfactionLevel < 6.5)
            .sort((a, b) => a.satisfactionLevel - b.satisfactionLevel);

          if (unsatisfied.length > 0) {
            actions.push({
              type: 'clarification',
              target: unsatisfied[0].agentId,
              reason: `Low satisfaction level (${unsatisfied[0].satisfactionLevel}/10) suggests need for clarification`,
              priority
            });
          }
          break;
        }

        case 'summarize': {
          // 満足度が高い場合の要約
          const avgSatisfaction = consensus.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensus.length;
          if (avgSatisfaction >= 6.5) {
            const logicalAgents = ['eiro-001', 'hekito-001'];
            const availableLogical = consensus.filter(c => logicalAgents.includes(c.agentId));
            const summaryTarget = availableLogical.length > 0 ? availableLogical[0].agentId : consensus[0]?.agentId;

            if (summaryTarget) {
              actions.push({
                type: 'summarize',
                target: summaryTarget,
                reason: `Average satisfaction ${avgSatisfaction.toFixed(1)}/10 suggests readiness for synthesis`,
                priority
              });
            }
          }
          break;
        }

        case 'conclude': {
          // 非常に高い満足度または長いラウンド
          const avgSatisfaction = consensus.reduce((sum, c) => sum + c.satisfactionLevel, 0) / consensus.length;
          const readyCount = consensus.filter(c => c.readyToMove).length;

          if (avgSatisfaction >= 8.0 && readyCount >= consensus.length / 2) {
            actions.push({
              type: 'conclude',
              target: '', // No specific target
              reason: `High satisfaction (${avgSatisfaction.toFixed(1)}/10) and ${readyCount}/${consensus.length} ready to move`,
              priority
            });
          }
          break;
        }

        case 'deep_dive': {
          // 追加ポイントがあるエージェント
          const hasPoints = consensus.filter(c => c.hasAdditionalPoints);
          if (hasPoints.length > 0) {
            actions.push({
              type: 'deep_dive',
              target: hasPoints[0].agentId,
              reason: `${hasPoints[0].agentId} indicated having additional points to explore`,
              priority
            });
          } else {
            // 発言が少ないエージェント
            const leastActive = consensus.filter(c => {
              const count = this.agentParticipationCount[c.agentId] || 0;
              const avgCount = Object.values(this.agentParticipationCount).reduce((a, b) => a + b, 0) / this.AGENT_NAMES.length;
              return count <= Math.max(0, avgCount * 0.7);
            }).sort((a, b) => {
              const countA = this.agentParticipationCount[a.agentId] || 0;
              const countB = this.agentParticipationCount[b.agentId] || 0;
              return countA - countB;
            });

            if (leastActive.length > 0) {
              actions.push({
                type: 'deep_dive',
                target: leastActive[0].agentId,
                reason: `Encouraging deeper exploration from ${leastActive[0].agentId} (${this.agentParticipationCount[leastActive[0].agentId] || 0} contributions)`,
                priority
              });
            }
          }
          break;
        }
      }

      // 1つのアクションが生成されたら一旦終了（最高優先度のアクション）
      if (actions.length > 0) {
        break;
      }
    }

    // どのアクションも生成できなかった場合のフォールバック
    if (actions.length === 0) {
      const fallbackAgent = consensus[0] || { agentId: this.AGENT_NAMES[0] };
      actions.push({
        type: 'perspective_shift',
        target: fallbackAgent.agentId,
        reason: 'Continuing dialogue with fresh perspective',
        priority: 5
      });
    }

    console.log(`[Facilitator] Generated fallback actions: ${actions.map(a => `${a.type}(${a.priority})`).join(', ')}`);
    return actions;
  }

  private extractCurrentTopic(messages: Message[]): string {
    if (messages.length === 0) return 'Unknown topic';

    // 最新のユーザーメッセージまたは最初のメッセージからトピックを抽出
    const userMessage = messages.find(m => m.role === 'user');
    if (userMessage) {
      return userMessage.content.slice(0, 100) + '...';
    }

    return messages[0].content.slice(0, 100) + '...';
  }

  // ラウンド履歴の記録
  recordRound(round: DynamicRound): void {
    // Add facilitator logs to the round
    this.roundHistory.push(round);
  }

  // Topic drift detection
  private detectTopicDrift(messages: Message[], originalQuery: string): boolean {
    if (messages.length < 3) return false;

    const recentMessages = messages.slice(-3);
    const recentContent = recentMessages.map(m => m.content.toLowerCase()).join(' ');

    // Simple keyword-based detection
    const originalKeywords = this.extractKeywords(originalQuery.toLowerCase());
    const matchingKeywords = originalKeywords.filter(keyword =>
      recentContent.includes(keyword)
    );

    // If less than 30% of original keywords are present, consider it drift
    const matchRatio = matchingKeywords.length / originalKeywords.length;
    return matchRatio < 0.3;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words
    const commonWords = ['what', 'is', 'are', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'について', 'とは', 'です', 'ます', 'した', 'する', 'ある', 'いる', 'この', 'その', 'あの', 'どの'];
    return text.split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 5); // Take first 5 keywords
  }

  // ファシリテーター介入ログの記録
  logIntervention(action: FacilitatorAction, success: boolean, errorMessage?: string, agentResponses?: string[]): void {
    const interventionLog: FacilitatorLog = {
      sessionId: this.currentSessionId || 'unknown',
      roundNumber: this.roundHistory.length,
      timestamp: new Date(),
      action: 'intervention',
      decision: {
        type: action.type,
        reasoning: action.reason,
        dataAnalyzed: {
          consensusLevels: {},
          overallConsensus: 0,
          shouldContinue: true
        },
        suggestedActions: [action],
        selectedAction: action
      },
      executionDetails: {
        success,
        errorMessage,
        agentResponses
      }
    };

    this.sessionLogs.push(interventionLog);
    console.log(`[Facilitator] Intervention logged: ${action.type} - Success: ${success}`);
  }

  // 全ログの取得
  getAllLogs(): FacilitatorLog[] {
    return [...this.sessionLogs];
  }

  // Log facilitator actions to SimplifiedInteractionLog (enhanced version)
  private async logToInteractionLogger(
    roundNumber: number,
    silentAdjustments: any,
    consensusLevel: number,
    duration: number = 0
  ): Promise<void> {
    if (!this.currentSessionId) return;

    // Create detailed prompt showing analysis process
    const detailedPrompt = this.generateDetailedFacilitatorPrompt(roundNumber, silentAdjustments, consensusLevel);

    // Create detailed output showing decision process
    const detailedOutput = this.generateDetailedFacilitatorOutput(silentAdjustments, consensusLevel, roundNumber);

    try {
      const logEntry = {
        id: `facilitator-${this.currentSessionId}-${roundNumber}-${Date.now()}`,
        sessionId: this.currentSessionId,
        stage: 'facilitator' as const,
        agentId: this.agentId,
        agentName: 'Silent Facilitator',
        timestamp: new Date(),
        prompt: detailedPrompt,
        output: detailedOutput,
        duration: duration,
        status: 'success' as const,
        facilitatorAction: silentAdjustments.facilitator_action,
        facilitatorReasoning: `Word adjustments: ${silentAdjustments.word_count_adjustments.join('; ')}`,
        participationBalance: silentAdjustments.participation_balance,
        topicShift: false, // Will be enhanced with actual topic shift detectionkan
        consensusLevel,
        roundNumber,
        // Add personality for consistency with other agents
        personality: this.getFacilitatorPersonality(),
        provider: 'internal',
        model: process.env.AGENT_FACILITATOR_001_MODEL || 'facilitator-logic-v1'
      };

      await this.interactionLogger.saveInteractionLog(logEntry);
      console.log(`[Facilitator] Enhanced interaction log saved for round ${roundNumber}`);
    } catch (error) {
      console.error('[Facilitator] Error logging to InteractionLogger:', error);
    }
  }

  // Generate detailed prompt showing what the facilitator is analyzing
  private generateDetailedFacilitatorPrompt(
    roundNumber: number,
    silentAdjustments: any,
    consensusLevel: number
  ): string {
    return `FACILITATOR ROUND ${roundNumber} ANALYSIS

SILENT FACILITATOR PROTOCOL - BEHIND-THE-SCENES ANALYSIS

## Current Session Analysis
- Session ID: ${this.currentSessionId}
- Round Number: ${roundNumber}
- Current Consensus Level: ${consensusLevel}/10

## Participation Analysis
Current participation balance:
${Object.entries(silentAdjustments.participation_balance)
  .map(([agentId, count]) => `- ${agentId}: ${count} contributions`)
  .join('\n')}

## Word Count Analysis
Target range: ${this.WORD_LIMIT_MIN}-${this.WORD_LIMIT_MAX} words per response
${silentAdjustments.word_count_adjustments.length > 0 ?
  `Adjustments needed:\n${silentAdjustments.word_count_adjustments.map((adj: any) => `- ${adj}`).join('\n')}` :
  'All agents within target word count range'}

## Topic Drift Detection
${silentAdjustments.topic_shift_detected ?
  `⚠️ Topic drift detected from: ${silentAdjustments.original_topic} → ${silentAdjustments.current_topic}` :
  '✓ Topic remains focused and on-track'}

## Silent Actions Required
Determine the appropriate facilitator action:
- maintain_balance: Keep current participation balance
- encourage_participation: Boost quieter agents
- word_count_guidance: Provide length guidance
- topic_refocus: Gently guide back to main topic
- consensus_building: Encourage convergence

## Decision Criteria
1. Participation Balance (weight: 30%)
2. Word Count Adherence (weight: 25%)
3. Topic Focus (weight: 25%)
4. Consensus Progress (weight: 20%)

FACILITATOR DECISION REQUIRED: What silent action should be taken for round ${roundNumber}?`;
  }

  // Generate detailed output showing the facilitator's decision process
  private generateDetailedFacilitatorOutput(
    silentAdjustments: any,
    consensusLevel: number,
    roundNumber?: number
  ): string {
    return `FACILITATOR DECISION - ROUND ${roundNumber || 'N/A'}

## Primary Action
**Action Type**: ${silentAdjustments.facilitator_action}
**Priority Level**: ${this.getActionPriority(silentAdjustments.facilitator_action)}

## Detailed Analysis Results

### Participation Balance Assessment
${Object.entries(silentAdjustments.participation_balance)
  .map(([agentId, count]) => {
    const countNum = count as number;
    const balanceStatus = countNum === 1 ? '✓ Balanced' : countNum > 1 ? '↑ High' : '↓ Low';
    return `- ${agentId}: ${countNum} contributions ${balanceStatus}`;
  })
  .join('\n')}

**Balance Score**: ${this.calculateBalanceScore(silentAdjustments.participation_balance)}/10

### Word Count Compliance
${silentAdjustments.silent_agents.length === 0 ?
  '✓ All agents within target range (150-200 words)' :
  `⚠️ Adjustments needed:\n${silentAdjustments.word_count_adjustments.map((adj: any) => `  - ${adj}`).join('\n')}`}

### Topic Focus Analysis
${silentAdjustments.topic_shift_detected ?
  `🔄 Topic shift detected - guiding back to core discussion` :
  '🎯 Discussion remains focused on main topic'}

### Consensus Progression
- Current Level: ${consensusLevel}/10
- Trend: ${consensusLevel > 5 ? '📈 Building' : consensusLevel > 3 ? '➡️ Stable' : '📉 Needs support'}
- Recommendation: ${consensusLevel < 4 ? 'Encourage diverse perspectives' : consensusLevel > 7 ? 'Consider convergence' : 'Maintain current momentum'}

## Silent Adjustments Applied

### Word Count Guidance
${silentAdjustments.silent_agents.length > 0 ?
  `Word count adjustments applied: ${silentAdjustments.word_count_adjustments.join(', ')}` :
  'No specific guidance needed - all agents within range'}

### Participation Encouragement
${this.generateParticipationGuidance(silentAdjustments.participation_balance)}

### Topic Maintenance
${silentAdjustments.topic_guidance || 'Topic focus maintained - no intervention needed'}

## Quality Metrics
- **Dialogue Quality**: ${this.assessDialogueQuality(silentAdjustments)}/10
- **Engagement Level**: ${this.assessEngagementLevel(silentAdjustments.participation_balance)}/10
- **Focus Score**: ${silentAdjustments.topic_shift_detected ? 6 : 9}/10

## Next Round Preparation
${this.generateNextRoundGuidance(silentAdjustments, consensusLevel)}

---
*This analysis is performed silently by the facilitator and does not interfere with the natural flow of agent dialogue.*`;
  }

  // Get facilitator personality for logging consistency
  private getFacilitatorPersonality(): string {
    return `
# Facilitator Agent Profile

## Core Role
Silent orchestrator of dialogue quality and balance in the Yui Protocol system.

## Operational Philosophy
- **Transparency**: All actions are logged but never intrude on agent dialogue
- **Balance**: Ensure equal participation across all five agents
- **Quality**: Maintain 150-200 word responses for optimal dialogue depth
- **Focus**: Keep discussions on-topic while allowing natural exploration
- **Consensus**: Support organic convergence without forcing agreement

## Silent Intervention Principles
1. **Non-intrusive**: Never directly address agents or appear in dialogue
2. **Analytical**: Base all decisions on quantitative and qualitative metrics
3. **Adaptive**: Adjust strategy based on real-time dialogue dynamics
4. **Supportive**: Enable agent personalities to flourish naturally
5. **Purposeful**: Every action serves the goal of enriched dialogue

## Monitoring Capabilities
- Participation balance tracking across all agents
- Word count analysis and guidance
- Topic drift detection and gentle correction
- Consensus level assessment
- Dialogue quality metrics

## Decision Framework
Prioritizes interventions based on:
1. Participation equity (30%)
2. Response quality maintenance (25%)
3. Topic coherence (25%)
4. Consensus building support (20%)
`;
  }

  // Helper methods for detailed output generation
  private getActionPriority(action: string): string {
    const priorities: Record<string, string> = {
      'maintain_balance': 'Medium',
      'encourage_participation': 'High',
      'word_count_guidance': 'Low',
      'topic_refocus': 'High',
      'consensus_building': 'Medium'
    };
    return priorities[action] || 'Medium';
  }

  private calculateBalanceScore(participationBalance: Record<string, number>): number {
    const counts = Object.values(participationBalance);
    const participatingAgents = counts.filter(count => count > 0).length;
    const totalAgents = counts.length;

    // スコアは参加率に基づいて計算
    const participationRatio = participatingAgents / totalAgents;
    return Math.round(participationRatio * 10);
  }

  private generateParticipationGuidance(participationBalance: Record<string, number>): string {
    const total = Object.values(participationBalance).reduce((a, b) => a + b, 0);
    const avg = total / Object.keys(participationBalance).length;

    const quiet = Object.entries(participationBalance).filter(([, count]) => count < avg);
    const active = Object.entries(participationBalance).filter(([, count]) => count > avg);

    if (quiet.length === 0) return '✓ Participation is well balanced across all agents';

    return `Encouraging participation from: ${quiet.map(([id]) => id).join(', ')}
Natural flow maintained for active contributors: ${active.map(([id]) => id).join(', ')}`;
  }

  private assessDialogueQuality(adjustments: any): number {
    let score = 7; // Base score
    if (adjustments.word_count_adjustments.length === 0) score += 1;
    if (!adjustments.topic_shift_detected) score += 1;
    if (Object.values(adjustments.participation_balance).every((count: any) => count >= 1)) score += 1;
    return Math.min(10, score);
  }

  private assessEngagementLevel(participationBalance: Record<string, number>): number {
    const total = Object.values(participationBalance).reduce((a, b) => a + b, 0);
    const agents = Object.keys(participationBalance).length;
    return Math.min(10, Math.round((total / agents) * 3));
  }

  private generateNextRoundGuidance(adjustments: any, consensusLevel: number): string {
    const suggestions = [];

    if (adjustments.word_count_adjustments.length > 0) {
      suggestions.push('Monitor word count adherence');
    }

    if (consensusLevel < 4) {
      suggestions.push('Encourage diverse perspective sharing');
    } else if (consensusLevel > 7) {
      suggestions.push('Consider facilitating convergence');
    }

    if (adjustments.topic_shift_detected) {
      suggestions.push('Maintain topic focus vigilance');
    }

    return suggestions.length > 0 ?
      `Focus areas for next round:\n${suggestions.map(s => `- ${s}`).join('\n')}` :
      'Continue current approach - dialogue is progressing well';
  }

  // セッション開始時の初期化
  initializeSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.sessionLogs = [];
    this.roundHistory = [];
    this.initializeAgentTracking(); // 発言数をリセット
    console.log(`[Facilitator] Initialized session: ${sessionId}`);
  }

  // 議論の統計情報
  getDialogueStats(): {
    totalRounds: number;
    averageConsensus: number;
    mostActiveAgent: string;
    keyTopics: string[];
    facilitatorStats: {
      totalInterventions: number;
      successfulInterventions: number;
      actionTypeBreakdown: Record<string, number>;
      topicDriftDetections: number;
    };
  } {
    const totalRounds = this.roundHistory.length;
    const avgConsensus = totalRounds > 0
      ? this.roundHistory.reduce((sum, r) => sum + (r.consensusData.reduce((s, c) => s + c.satisfactionLevel, 0) / r.consensusData.length), 0) / totalRounds
      : 0;

    // 最も活発なエージェントを特定
    const agentMessageCounts: Record<string, number> = {};
    this.roundHistory.forEach(round => {
      round.messages.forEach(msg => {
        agentMessageCounts[msg.agentId] = (agentMessageCounts[msg.agentId] || 0) + 1;
      });
    });

    const mostActiveAgent = Object.entries(agentMessageCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

    // ファシリテーターの統計
    const interventions = this.sessionLogs.filter(log => log.action === 'intervention');
    const successfulInterventions = interventions.filter(log => log.executionDetails?.success).length;
    const actionTypeBreakdown = interventions.reduce((acc, log) => {
      const actionType = log.decision.selectedAction?.type || 'unknown';
      acc[actionType] = (acc[actionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topicDriftDetections = this.sessionLogs.filter(log =>
      log.decision.dataAnalyzed.topicDrift === true
    ).length;

    return {
      totalRounds,
      averageConsensus: avgConsensus,
      mostActiveAgent,
      keyTopics: this.roundHistory.map(r => r.topic),
      facilitatorStats: {
        totalInterventions: interventions.length,
        successfulInterventions,
        actionTypeBreakdown,
        topicDriftDetections
      }
    };
  }

  // 投票結果を分析してFinalize担当を決定（同率1位の場合は複数選出）
  async analyzeFinalizeVotes(
    votes: { agentId: string; voteFor: string | undefined; voteReasoning?: string }[],
    allAgentIds: string[],
    language: 'ja' | 'en' = 'ja'
  ): Promise<string[]> {
    console.log('[Facilitator] Analyzing finalize votes');

    if (!this.aiExecutor) {
      await this.initializeAIExecutor();
    }

    // 投票情報を整理
    const votesSummary = votes
      .filter(v => v.voteFor)
      .map(v => `${v.agentId} → ${v.voteFor}: ${v.voteReasoning || 'No reason provided'}`)
      .join('\n');

    // 票数を集計
    const voteCounts: Record<string, number> = {};
    votes.forEach(vote => {
      if (vote.voteFor) {
        voteCounts[vote.voteFor] = (voteCounts[vote.voteFor] || 0) + 1;
      }
    });

    const prompt = language === 'en' ?
      `When selecting the Finalize agent, please analyze the following voting results and determine the optimal choice.

Voting Results:
${votesSummary}

Vote Count:
${Object.entries(voteCounts).map(([agent, count]) => `${agent}: ${count} votes`).join('\n')}

Available Agents: ${allAgentIds.join(', ')}

Selection Criteria:
1. Number of votes (agent with the most votes)
2. Quality of voting reasons (trust and evaluation from other agents)
3. Ability to summarize the discussion (ability evaluation shown in voting reasons)

**Important**: If there are multiple agents tied for first place, select ALL of those agents. Multiple agents will cooperate on Finalize.

Answer format:
- For single first place: Agent ID only (example: "eiro-001")
- For multiple tied first place: Comma-separated all (example: "eiro-001,kanshi-001")

Please answer only the selected agent ID(s) (comma-separated if multiple) (no reasons needed):` :
      `Finalize担当エージェントの選出において、以下の投票結果を分析して最適な選択を決定してください。

投票結果:
${votesSummary}

票数集計:
${Object.entries(voteCounts).map(([agent, count]) => `${agent}: ${count}票`).join('\n')}

利用可能なエージェント: ${allAgentIds.join(', ')}

選出基準:
1. 得票数（最も多く票を集めたエージェント）
2. 投票理由の質（他のエージェントからの信頼と評価）
3. 議論を総括する能力（投票理由に表れる能力評価）

**重要**: 同率1位のエージェントが複数いる場合は、そのすべてのエージェントを選出してください。複数のエージェントが協力してFinalizeを担当します。

回答形式:
- 単独1位の場合: エージェントIDのみ（例: "eiro-001"）
- 同率1位が複数の場合: カンマ区切りで全員（例: "eiro-001,kanshi-001"）

選択したエージェントID(複数の場合はカンマ区切り)のみを回答してください（理由は不要）:`;

    try {
      const result = await this.aiExecutor!.execute(prompt, '');
      const selectedAgentIds = result.content.trim().split(',').map(id => id.trim());

      // ログに投票分析の詳細を保存
      await this.logVotingAnalysis(prompt, result.content, votes, selectedAgentIds.join(','));

      // 有効なエージェントIDか確認
      const validSelectedIds = selectedAgentIds.filter(id => allAgentIds.includes(id));

      if (validSelectedIds.length > 0) {
        console.log(`[Facilitator] Selected finalizers: ${validSelectedIds.join(', ')} based on voting analysis`);
        return validSelectedIds;
      } else {
        console.warn(`[Facilitator] Invalid agents selected: ${selectedAgentIds.join(', ')}, falling back to highest vote count`);

        // フォールバック: 最多得票者（複数の場合は全員）
        const maxVotes = Math.max(0, ...Object.values(voteCounts));
        const winners = Object.entries(voteCounts)
          .filter(([, count]) => count === maxVotes)
          .map(([agent]) => agent);

        return winners.length > 0 ? winners : [allAgentIds[0]];
      }
    } catch (error) {
      console.error('[Facilitator] Error in vote analysis:', error);

      // エラー時もログに記録
      await this.logVotingAnalysis(prompt, `Error: ${(error as Error).message}`, votes, '');

      // エラー時のフォールバック: 最多得票者（複数の場合は全員）
      const maxVotes = Math.max(0, ...Object.values(voteCounts));
      const winners = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([agent]) => agent);

      return winners.length > 0 ? winners : [allAgentIds[0]];
    }
  }

  // 投票分析をログに記録
  private async logVotingAnalysis(
    prompt: string,
    output: string,
    votes: { agentId: string; voteFor: string | undefined; voteReasoning?: string }[],
    selectedAgent: string
  ): Promise<void> {
    try {
      const logEntry = {
        id: `facilitator-${this.currentSessionId}-voting-${Date.now()}`,
        sessionId: this.currentSessionId || 'unknown',
        stage: 'voting' as const,
        agentId: this.agentId,
        agentName: 'Silent Facilitator',
        timestamp: new Date().toISOString(),
        prompt: prompt,
        output: `Action: vote_analysis | Selected: ${selectedAgent} | Reasoning: ${output}`,
        duration: 0,
        status: 'success' as const,
        facilitatorAction: 'vote_analysis',
        facilitatorReasoning: `Analyzed ${votes.length} votes and selected ${selectedAgent}`,
        participationBalance: votes.reduce((acc, vote) => {
          acc[vote.agentId] = 1;
          return acc;
        }, {} as Record<string, number>),
        topicShift: false,
        consensusLevel: 0,
        roundNumber: 0,
        voteAnalysis: {
          totalVotes: votes.length,
          validVotes: votes.filter(v => v.voteFor).length,
          selectedAgent: selectedAgent,
          voteCounts: votes.reduce((acc, vote) => {
            if (vote.voteFor) {
              acc[vote.voteFor] = (acc[vote.voteFor] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>),
          voteDetails: votes
        }
      };

      await this.interactionLogger.saveInteractionLog(logEntry);
      console.log(`[Facilitator] Logged voting analysis for session ${this.currentSessionId}`);
    } catch (error) {
      console.error('[Facilitator] Error logging voting analysis:', error);
    }
  }
}