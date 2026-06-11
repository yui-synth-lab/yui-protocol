import { Agent, Message, AgentResponse, DialogueStage, IndividualThought, MutualReflection } from '../types/index.js';
import { getPersonalityPrompt, getStagePrompt, Language, SUMMARIZER_STAGE_PROMPT, formatPrompt, parseVotes, extractVoteDetails } from '../templates/prompts.js';
import { InteractionLogger, SimplifiedInteractionLog } from '../kernel/interaction-logger.js';
import { AIExecutor } from '../kernel/ai-executor.js';
import { MemoryManager } from '../kernel/memory-manager.js';
import { defaultExecutorFactory } from '../kernel/executor-factory.js';
import type { DialogueAgent, ExecutorFactory } from '../dialogue/contracts.js';
import {
  calculateTemperature,
  calculateTopP,
  calculateRepetitionPenalty,
  calculatePresencePenalty,
  calculateFrequencyPenalty,
  calculateTopK,
  calculateGenerationParameters,
  GenerationParameters
} from './generation-parameters.js';
import {
  parseReflectionsFromContent,
  detectAgreement,
  extractQuestions,
  extractReaction,
  ParsedReflection
} from '../dialogue/parsing/response-parsers.js';
import { ConversationContext, AgentPersonalHistory } from '../types/memory.js';
import { getV2MemoryConfig, getV2ModelTierConfig } from '../config/v2-config-loader.js';
import type { ModelTierConfig } from '../types/v2-config.js';
import type { TaskTier } from '../dialogue/contracts.js';
import { RAGEnhancedContext, RAGQuery } from '../types/rag.js';
import { RAGRetriever } from '../kernel/rag/rag-retriever.js';

// Helper: Get model config from environment variables
function getModelConfigFromEnv(agentId: string, defaultConfig: any) {
  // Convert agent ID to env var format: yui-000 -> YUI_000
  const envPrefix = `AGENT_${agentId.toUpperCase().replace(/-/g, '_')}`;

  const provider = process.env[`${envPrefix}_PROVIDER`];
  const model = process.env[`${envPrefix}_MODEL`];
  const finalizerModel = process.env[`${envPrefix}_FINALIZER_MODEL`];

  // If any env var is set, use env config; otherwise use default
  if (provider || model || finalizerModel) {
    return {
      provider: provider || defaultConfig.provider,
      model: model || defaultConfig.model,
      finalizerModel: finalizerModel || defaultConfig.finalizerModel || defaultConfig.model
    };
  }

  return defaultConfig;
}

export abstract class BaseAgent implements DialogueAgent {
  protected agent: Agent;
  protected memory: Message[] = [];
  protected interactionLogger: InteractionLogger;
  protected sessionId?: string;
  protected aiExecutor?: AIExecutor;
  private aiExecutorPromise?: Promise<AIExecutor>;
  protected aiExecutorFinalize?: AIExecutor;
  private aiExecutorPromiseFinalize?: Promise<AIExecutor>;
  protected isSummarizer: boolean;
  protected executorFactory: ExecutorFactory;

  // M6: 階層メモリ圧縮（トークン閾値超過時のみ発動。圧縮過程はログ化される）
  protected memoryManager: MemoryManager;

  protected personalHistory: AgentPersonalHistory;

  // RAG統合
  protected ragRetriever?: RAGRetriever;
  protected ragEnabled: boolean = false;

  constructor(
    agent: Agent,
    interactionLogger?: InteractionLogger,
    language: Language = 'en',
    ragRetriever?: RAGRetriever,
    executorFactory: ExecutorFactory = defaultExecutorFactory
  ) {
    this.agent = agent;
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.executorFactory = executorFactory;
    // Use 'en' as default for generation parameters in constructor
    const generationParams = this.getGenerationParameters();

    // Get model configuration from agent, or use defaults
    const defaultModelConfig = agent.modelConfig || {
      provider: 'openai',
      model: 'gpt-4.1-mini-2025-04-14'
    };

    // Override with environment variables if present
    const modelConfig = getModelConfigFromEnv(agent.id, defaultModelConfig);

    this.aiExecutorPromise = this.executorFactory.getExecutor(agent.id, {
      provider: modelConfig.provider,
      model: modelConfig.model,
      temperature: generationParams.temperature,
      topP: generationParams.topP,
      repetitionPenalty: generationParams.repetitionPenalty,
      presencePenalty: generationParams.presencePenalty,
      frequencyPenalty: generationParams.frequencyPenalty,
      topK: generationParams.topK
    });

    // Use finalizer model if specified, otherwise use the same model
    const finalizerModel = modelConfig.finalizerModel || modelConfig.model;
    this.aiExecutorPromiseFinalize = this.executorFactory.getExecutor(agent.id + '-finalizer', {
      provider: modelConfig.provider,
      model: finalizerModel,
      temperature: generationParams.temperature,
      topP: generationParams.topP,
      repetitionPenalty: generationParams.repetitionPenalty,
      presencePenalty: generationParams.presencePenalty,
      frequencyPenalty: generationParams.frequencyPenalty,
      topK: generationParams.topK
    });
    this.isSummarizer = false;
    this.memoryManager = new MemoryManager();

    this.personalHistory = this.initializePersonalHistory();

    // RAG統合
    this.ragRetriever = ragRetriever;
    this.ragEnabled = !!ragRetriever;
  }

  // Initialize AI executor if not already done
  private async ensureAIExecutor(stage: DialogueStage): Promise<AIExecutor> {
    if (stage === 'finalize' || stage === 'output-generation') {
      if (!this.aiExecutorFinalize) {
        this.aiExecutorFinalize = await this.aiExecutorPromiseFinalize!;
      }
      return this.aiExecutorFinalize!;
    }
    else {
      if (!this.aiExecutor) {
        this.aiExecutor = await this.aiExecutorPromise!;
      }
      return this.aiExecutor!;
    }
  }

  // Main response method for the full dialogue process
  async respond(prompt: string, context: Message[], language: Language): Promise<AgentResponse> {
    const individualThought = await this.stage1IndividualThought(prompt, context, language);
    const relevantContext = this.getRelevantContext(context);
    const contextAnalysis = this.analyzeContext(relevantContext);
    return {
      agentId: this.agent.id,
      content: individualThought.content,
      reasoning: this.getReasoning(contextAnalysis),
      confidence: await this.generateConfidence('individual-thought', context),
      references: this.getReferences(),
      stage: 'individual-thought',
      stageData: individualThought
    };
  }

  /**
   * 前回シーケンスの情報を取得
   */
  protected getPreviousSequenceInfo(context: Message[], language: Language): {
    previousUserInput: string;
    previousAgentConclusions: { [agentId: string]: string };
  } {
    // セッション全体のメッセージから現在のシーケンス番号を取得
    // contextには最新のメッセージのみが含まれる可能性があるため、
    // セッション全体のメッセージを使用する必要がある

    // 現在のシーケンス番号を取得（最新のユーザーメッセージから）
    const userMessages = context.filter(m => m.role === 'user');
    const currentSequenceNumber = userMessages.length > 0
      ? Math.max(...userMessages.map(m => m.sequenceNumber || 1))
      : 1;
    const previousSequenceNumber = currentSequenceNumber - 1;

    console.log(`[BaseAgent] Current sequence: ${currentSequenceNumber}, Previous sequence: ${previousSequenceNumber}`);
    if (previousSequenceNumber < 1) {
      return {
        previousUserInput: '',
        previousAgentConclusions: {}
      };
    }

    // 前回シーケンスのユーザーメッセージを取得
    const previousUserMessage = context.find(
      m => m.role === 'user' && m.sequenceNumber === previousSequenceNumber
    );
    const previousUserInput = previousUserMessage?.content || '';

    // 前回シーケンスのエージェント結論を取得
    const previousAgentConclusions: { [agentId: string]: string } = {};

    // 前回シーケンスの最終ステージ（finalize）のエージェント応答を取得
    const previousOutputMessages = context.filter(
      m => m.role === 'agent' &&
        m.sequenceNumber === previousSequenceNumber &&
        m.stage === 'finalize'
    );

    // デバッグログ
    console.log(`[BaseAgent] Current sequence: ${currentSequenceNumber}, Previous sequence: ${previousSequenceNumber}`);
    console.log(`[BaseAgent] Previous user input: "${previousUserInput}"`);
    console.log(`[BaseAgent] Found ${previousOutputMessages.length} previous output messages`);

    previousOutputMessages.forEach(message => {
      if (message.agentId && message.content) {
        previousAgentConclusions[message.agentId] = message.content;
        console.log(`[BaseAgent] Added conclusion for ${message.agentId}: "${message.content.slice(0, 200)}"`);
      }
    });

    return {
      previousUserInput,
      previousAgentConclusions
    };
  }

  // Stage-specific methods for Yui Protocol
  async stage1IndividualThought(prompt: string, context: Message[], language: Language): Promise<IndividualThought> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || prompt || 'No user query provided';
    const relevantContext = this.getRelevantContext(context);
    let contextAnalysis = this.analyzeContext(relevantContext);

    // M6: トークン閾値超過時のみ階層メモリ圧縮で文脈を再構築する（閾値以下ではプロンプト不変）
    const compressedContext = await this.prepareContext(context);
    if (compressedContext.summarizedMid || compressedContext.essenceCore.length > 0) {
      contextAnalysis = this.analyzeCompressedContext(compressedContext);
    }

    // 前回シーケンスの情報を取得
    const previousInfo = this.getPreviousSequenceInfo(context, language);
    const previousConclusionsText = Object.entries(previousInfo.previousAgentConclusions)
      .map(([agentId, conclusion]) => `${agentId}: ${conclusion}`)
      .join('\n\n');

    let stagePrompt = this.getStagePrompt('individual-thought', {
      query,
      context: contextAnalysis,
      previousInput: previousInfo.previousUserInput,
      previousConclusions: previousConclusionsText
    }, language);

    // RAG拡張: 関連知識でプロンプトを強化
    if (this.ragEnabled && this.ragRetriever) {
      stagePrompt = await this.enhancePromptWithRAG(stagePrompt, query);
    }

    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'individual-thought',
      'individual thought processing'
    );
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: this.getReasoning(contextAnalysis),
      approach: this.getApproach(),
      assumptions: this.getAssumptions()
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[], AgentList: Agent[], language: Language): Promise<MutualReflection> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || prompt || 'No user query provided';
    const otherThoughtsText = otherThoughts.map(thought =>
      `${thought.agentId}: ${thought.content}`
    ).join('\n\n');
    const contextAnalysis = this.analyzeContext(context);

    // 前回シーケンスの情報を取得
    const previousInfo = this.getPreviousSequenceInfo(context, language);
    const previousConclusionsText = Object.entries(previousInfo.previousAgentConclusions)
      .map(([agentId, conclusion]) => `${agentId}: ${conclusion}`)
      .join('\n\n');

    const stagePrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      context: contextAnalysis,
      previousInput: previousInfo.previousUserInput,
      previousConclusions: previousConclusionsText
    }, language);
    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'mutual-reflection',
      'mutual reflection processing'
    );
    const reflections = this.parseReflectionsFromContent(content, otherThoughts, AgentList);
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reflections
    };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    const contextAnalysis = this.analyzeContext(context);
    const stagePrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: JSON.stringify(conflicts, null, 2),
      context: contextAnalysis
    }, language);
    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'conflict-resolution',
      'conflict resolution processing'
    );
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: this.getReasoning(contextAnalysis),
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: this.getReferences(),
      stage: 'conflict-resolution',
      stageData: {
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100)
      }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    const contextAnalysis = this.analyzeContext(context);
    const stagePrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      context: contextAnalysis
    }, language);
    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'synthesis-attempt',
      'synthesis attempt processing'
    );
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: this.getReasoning(contextAnalysis),
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: this.getReferences(),
      stage: 'synthesis-attempt',
      stageData: {
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100)
      }
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    const contextAnalysis = this.analyzeContext(context);
    // 投票候補 = この対話に発言したエージェントのうち自分以外（自己投票の構造的防止）
    const voteCandidates = Array.from(new Set(
      context
        .filter(m => m.role === 'agent' && m.agentId && m.agentId !== this.agent.id)
        .map(m => m.agentId)
    )).join(', ') || 'the other participating agents';
    let stagePrompt: string;
    if (this.isSummarizer) {
      stagePrompt = formatPrompt(SUMMARIZER_STAGE_PROMPT, {
        query,
        finalData: JSON.stringify(finalData, null, 2),
        context: contextAnalysis
      }); // Remove language argument here
    } else {
      stagePrompt = this.getStagePrompt('output-generation', {
        query,
        finalData: JSON.stringify(finalData, null, 2),
        context: contextAnalysis,
        agentId: this.agent.id,
        voteCandidates
      }, language);
    }
    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );
    const voteDetails = extractVoteDetails(content, this.agent.id);
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: this.getReasoning(contextAnalysis),
      confidence: await this.generateConfidence('output-generation', context),
      references: this.getReferences(),
      stage: 'output-generation',
      stageData: {
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100)
      },
      metadata: {
        voteFor: voteDetails.votedAgent || undefined,
        voteReasoning: voteDetails.reasoning || undefined,
        voteSection: voteDetails.voteSection || undefined
      }
    };
  }


  async stage5_1Finalize(votingResults: any, responses: AgentResponse[], context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    // Only use responses, do not use votingResults
    const responsesText = responses.map(response =>
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    const stagePrompt = this.getStagePrompt('finalize', {
      query,
      responses: responsesText
    }, language);
    const personality = this.getPersonalityPrompt(language);

    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      personality,
      this.sessionId || 'unknown-session',
      'finalize',
      'finalize processing'
    );
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: 'I created the final comprehensive output based on all agent responses.',
      confidence: await this.generateConfidence('finalize', context),
      references: ['final-synthesis', 'comprehensive-output'],
      stage: 'finalize',
      stageData: {
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100)
      }
    };
  }



  // Log interaction method for agents to use
  protected async logInteraction(
    sessionId: string,
    stage: DialogueStage,
    prompt: string,
    personality: string,
    output: string,
    duration: number,
    status: 'success' | 'error' | 'timeout' = 'success',
    error?: string,
    provider?: string,
    model?: string,
    tokensUsed?: number
  ): Promise<void> {
    const actualSessionId = sessionId === 'unknown-session' ? this.sessionId || sessionId : sessionId;
    const log: SimplifiedInteractionLog = {
      id: `${actualSessionId}_${stage}_${this.agent.id}_${Date.now()}`,
      sessionId: actualSessionId,
      stage,
      agentId: this.agent.id,
      agentName: this.agent.name,
      timestamp: new Date(),
      prompt,
      output,
      duration,
      status,
      error,
      personality,
      provider,
      model,
      tokensUsed
    };

    await this.interactionLogger.saveInteractionLog(log);
  }

  protected getPersonalityPrompt(language: Language): string {
    return getPersonalityPrompt(this.agent, language);
  }

  protected getStagePrompt(stage: DialogueStage, variables: Record<string, any> = {}, language: Language = 'en'): string {
    return getStagePrompt(stage, variables, language);
  }

  protected addToMemory(message: Message): void {
    this.memory.push(message);

    // Memory management based on agent's memory scope
    const maxMemory = this.getMaxMemorySize();
    if (this.memory.length > maxMemory) {
      this.memory = this.memory.slice(-maxMemory);
    }
  }

  private getMaxMemorySize(): number {
    switch (this.agent.memoryScope) {
      case 'local':
        return 20; // Limited memory for local scope
      case 'session':
        return 100; // Moderate memory for session scope
      case 'cross-session':
        return 500; // Large memory for cross-session scope
      default:
        return 50;
    }
  }

  public getAgent(): Agent {
    return this.agent;
  }

  public getMemory(): Message[] {
    return [...this.memory];
  }

  public clearMemory(): void {
    this.memory = [];
  }

  // Helper method to get relevant context based on memory scope
  protected getRelevantContext(context: Message[]): Message[] {
    switch (this.agent.memoryScope) {
      case 'local':
        return context.slice(-5); // Only recent messages
      case 'session':
        return context.slice(-20); // Session-level context
      case 'cross-session':
        return context; // Full context
      default:
        return context.slice(-10);
    }
  }

  // Helper method to generate confidence based on agent's priority
  protected async generateConfidence(
    stage?: DialogueStage,
    context?: Message[],
    errorHistory?: { success: number; total: number }
  ): Promise<number> {
    // Base confidence based on agent characteristics
    let baseConfidence = this.getBaseConfidenceFromCharacteristics();

    // Adjust based on performance history
    const performanceAdjustment = await this.getPerformanceAdjustment();
    baseConfidence += performanceAdjustment;

    // Adjust based on stage experience
    const stageAdjustment = this.getStageExperienceAdjustment(stage);
    baseConfidence += stageAdjustment;

    // Adjust based on context complexity
    const contextAdjustment = this.getContextComplexityAdjustment(context);
    baseConfidence += contextAdjustment;

    // Adjust based on error history
    const errorAdjustment = this.getErrorHistoryAdjustment(errorHistory);
    baseConfidence += errorAdjustment;

    // Ensure confidence is within reasonable bounds (0.1 to 0.95)
    return Math.max(0.1, Math.min(0.95, baseConfidence));
  }

  private getBaseConfidenceFromCharacteristics(): number {
    // Base confidence based on agent style and priority
    let baseConfidence = 0.6; // Default base confidence

    // Adjust based on agent style
    switch (this.agent.style) {
      case 'logical':
        baseConfidence += 0.1; // Logical agents tend to be more confident
        break;
      case 'critical':
        baseConfidence -= 0.05; // Critical agents are more cautious
        break;
      case 'intuitive':
        baseConfidence += 0.05; // Intuitive agents have moderate confidence
        break;
      case 'meta':
        baseConfidence += 0.15; // Meta agents have high confidence in their analysis
        break;
      case 'emotive':
        baseConfidence += 0.02; // Emotive agents have slight confidence boost
        break;
      case 'analytical':
        baseConfidence += 0.08; // Analytical agents have good confidence
        break;
    }

    // Adjust based on priority
    switch (this.agent.priority) {
      case 'precision':
        baseConfidence -= 0.1; // Precision-focused agents are more cautious
        break;
      case 'breadth':
        baseConfidence += 0.05; // Breadth-focused agents have moderate confidence
        break;
      case 'depth':
        baseConfidence += 0.02; // Depth-focused agents have slight confidence boost
        break;
      case 'balance':
        baseConfidence += 0.03; // Balanced agents have good confidence
        break;
    }

    return baseConfidence;
  }

  private async getPerformanceAdjustment(): Promise<number> {
    if (!this.sessionId) return 0;

    try {
      // Get recent interaction logs for this agent
      const logs = await this.interactionLogger.getSessionLogs(this.sessionId);
      const agentLogs = logs.filter(log => log.agentId === this.agent.id);

      if (agentLogs.length === 0) return 0;

      // Calculate success rate
      const successfulLogs = agentLogs.filter(log => log.status === 'success');
      const successRate = successfulLogs.length / agentLogs.length;

      // Performance adjustment based on success rate
      // Higher success rate increases confidence, lower success rate decreases it
      const performanceAdjustment = (successRate - 0.8) * 0.3; // ±0.06 range

      return Math.max(-0.1, Math.min(0.1, performanceAdjustment));
    } catch (error) {
      console.warn('Failed to get performance adjustment:', error);
      return 0;
    }
  }

  private getStageExperienceAdjustment(stage?: DialogueStage): number {
    if (!stage) return 0;

    // Different stages have different confidence requirements
    switch (stage) {
      case 'individual-thought':
        return 0.05; // Agents are most confident in individual thinking
      case 'mutual-reflection':
        return 0.02; // Moderate confidence in reflecting on others
      case 'conflict-resolution':
        return -0.05; // Lower confidence due to complexity
      case 'synthesis-attempt':
        return -0.03; // Moderate confidence in synthesis
      case 'output-generation':
        return 0.03; // Good confidence in final output
      default:
        return 0;
    }
  }

  private getContextComplexityAdjustment(context?: Message[]): number {
    if (!context || context.length === 0) return 0;

    // Analyze context complexity
    const contextLength = context.length;
    const hasConflicts = context.some(m => m.stage === 'conflict-resolution');
    const hasMultipleStages = new Set(context.map(m => m.stage)).size > 2;

    let complexityAdjustment = 0;

    // Adjust based on context length
    if (contextLength > 20) complexityAdjustment -= 0.05;
    else if (contextLength > 10) complexityAdjustment -= 0.02;
    else if (contextLength < 5) complexityAdjustment += 0.02;

    // Adjust based on presence of conflicts
    if (hasConflicts) complexityAdjustment -= 0.03;

    // Adjust based on multiple stages
    if (hasMultipleStages) complexityAdjustment -= 0.02;

    return complexityAdjustment;
  }

  private getErrorHistoryAdjustment(errorHistory?: { success: number; total: number }): number {
    if (!errorHistory || errorHistory.total === 0) return 0;

    const errorRate = 1 - (errorHistory.success / errorHistory.total);

    // Reduce confidence based on error rate
    if (errorRate > 0.3) return -0.15; // High error rate
    else if (errorRate > 0.1) return -0.08; // Moderate error rate
    else if (errorRate < 0.05) return 0.05; // Low error rate

    return 0;
  }

  // Set session ID for logging
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  // Get current session ID
  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  public setIsSummarizer(isSummarizer: boolean): void {
    this.isSummarizer = isSummarizer;
  }

  public getIsSummarizer(): boolean {
    return this.isSummarizer;
  }

  // 生成パラメータ計算は ./generation-parameters.ts の純関数群に抽出済み（Phase 3）
  protected calculateTemperature(): number {
    return calculateTemperature(this.agent);
  }

  // エージェント固有のtemperatureを取得するメソッド
  public getTemperature(): number {
    return calculateTemperature(this.agent);
  }

  protected calculateTopP(): number {
    return calculateTopP(this.agent);
  }

  protected calculateRepetitionPenalty(): number {
    return calculateRepetitionPenalty(this.agent);
  }

  protected calculatePresencePenalty(): number {
    return calculatePresencePenalty(this.agent);
  }

  protected calculateFrequencyPenalty(): number {
    return calculateFrequencyPenalty(this.agent);
  }

  protected calculateTopK(): number {
    return calculateTopK(this.agent);
  }

  // 全パラメータを取得するメソッド
  public getGenerationParameters(): GenerationParameters {
    return calculateGenerationParameters(this.agent);
  }


  // Demo method to show confidence calculation breakdown
  public async demonstrateConfidenceCalculation(
    stage?: DialogueStage,
    context?: Message[],
    errorHistory?: { success: number; total: number }
  ): Promise<{
    baseConfidence: number;
    performanceAdjustment: number;
    stageAdjustment: number;
    contextAdjustment: number;
    errorAdjustment: number;
    finalConfidence: number;
  }> {
    const baseConfidence = this.getBaseConfidenceFromCharacteristics();
    const performanceAdjustment = await this.getPerformanceAdjustment();
    const stageAdjustment = this.getStageExperienceAdjustment(stage);
    const contextAdjustment = this.getContextComplexityAdjustment(context);
    const errorAdjustment = this.getErrorHistoryAdjustment(errorHistory);

    const finalConfidence = Math.max(0.1, Math.min(0.95,
      baseConfidence + performanceAdjustment + stageAdjustment + contextAdjustment + errorAdjustment
    ));

    return {
      baseConfidence,
      performanceAdjustment,
      stageAdjustment,
      contextAdjustment,
      errorAdjustment,
      finalConfidence
    };
  }

  // Common AI execution with error handling
  protected async executeAIWithErrorHandling(
    prompt: string,
    personality: string,
    sessionId: string,
    stage: DialogueStage,
    operationName: string
  ): Promise<string> {
    const startTime = Date.now();
    let executor: AIExecutor | undefined;
    try {
      executor = await this.ensureAIExecutor(stage);
      const result = await executor.execute(prompt, personality);

      // Word count validation for deep-dive, perspective-shift, and clarification stages
      if (['deep-dive', 'perspective-shift', 'clarification'].includes(stage) && result.content) {
        const wordCount = result.content.split(/\s+/).length;
        if (wordCount < 120 || wordCount > 250) {
          console.log(`[BaseAgent] ${this.agent.name} response word count: ${wordCount} (target: 150-200)`);
          // Add guidance for word count adjustment in future responses
          if (wordCount < 120) {
            console.log(`[BaseAgent] Response too short for ${this.agent.name}, encouraging more detail`);
          } else if (wordCount > 250) {
            console.log(`[BaseAgent] Response too long for ${this.agent.name}, encouraging conciseness`);
          }
        }
      }

      const duration = Date.now() - startTime;
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        personality,
        result.content,
        duration,
        result.success ? 'success' : 'error',
        result.success ? undefined : `AI execution failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`,
        executor['provider'],
        executor['model'],
        result.tokensUsed
      );
      return result.content;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        personality,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage,
        executor ? executor['provider'] : undefined,
        executor ? executor['model'] : undefined
      );
      throw error;
    }
  }

  // AI execution with custom finalizer model (high-cost LLM)
  protected async executeAIWithFinalizerModel(
    prompt: string,
    personality: string,
    customAgentId: string,
    sessionId: string,
    stage: DialogueStage,
    operationName: string
  ): Promise<string> {
    const startTime = Date.now();
    let executor: AIExecutor | undefined;
    try {
      // Create a temporary AI executor with the custom agent ID (containing '-finalizer')
      // This will trigger the high-cost LLM configuration
      const generationParams = this.getGenerationParameters();

      // Get model configuration from agent with env override
      const defaultModelConfig = this.agent.modelConfig || {
        provider: 'openai',
        model: 'gpt-4.1-mini-2025-04-14'
      };

      const modelConfig = getModelConfigFromEnv(this.agent.id, defaultModelConfig);

      // Use finalizer model if specified
      const finalizerModel = modelConfig.finalizerModel || modelConfig.model;

      // ExecutorFactory 経由で取得（同一 agentId+model はキャッシュされ、呼び出し毎の再生成を避ける: M8）
      executor = await this.executorFactory.getExecutor(customAgentId, {
        provider: modelConfig.provider,
        model: finalizerModel,
        temperature: generationParams.temperature,
        topP: generationParams.topP,
        repetitionPenalty: generationParams.repetitionPenalty,
        presencePenalty: generationParams.presencePenalty,
        frequencyPenalty: generationParams.frequencyPenalty,
        topK: generationParams.topK
      });

      const result = await executor.execute(prompt, personality);

      const duration = Date.now() - startTime;
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        personality,
        result.content,
        duration,
        result.success ? 'success' : 'error',
        result.success ? undefined : `AI execution failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`,
        executor['provider'],
        executor['model'],
        result.tokensUsed
      );

      console.log(`[BaseAgent] Used high-cost LLM for finalizer ${customAgentId}, provider: ${executor['provider']}, model: ${executor['model']}`);

      return result.content;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        personality,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage,
        executor ? executor['provider'] : undefined,
        executor ? executor['model'] : undefined
      );
      throw error;
    }
  }

  // ========== DialogueAgent 公開API（v2ルーター用） ==========
  // ルーターが protected メソッドへ `as any` でアクセスしていた箇所の正式な公開窓口。

  public async executeWithPersonality(
    prompt: string,
    stage: DialogueStage,
    operationName: string,
    language: Language,
    fallbackSessionId: string = 'unknown-session',
    tier?: TaskTier
  ): Promise<string> {
    // M2: mechanical/summary tier が config に設定されていれば安価モデルで実行（オプトイン）
    if (tier && tier !== 'reasoning') {
      const tierConfig = getV2ModelTierConfig(tier);
      if (tierConfig) {
        return this.executeWithTierModel(tierConfig, tier, prompt, stage, operationName, fallbackSessionId);
      }
    }
    return this.executeAIWithErrorHandling(
      prompt,
      this.getPersonalityPrompt(language),
      this.sessionId || fallbackSessionId,
      stage,
      operationName
    );
  }

  // M2/M3: 様式化タスクを安価モデル＋短縮人格＋出力上限で実行する
  private async executeWithTierModel(
    tierConfig: ModelTierConfig,
    tier: TaskTier,
    prompt: string,
    stage: DialogueStage,
    operationName: string,
    fallbackSessionId: string
  ): Promise<string> {
    const sessionId = this.sessionId || fallbackSessionId;
    // フル人格プロンプトの再送を避ける短縮人格（個性は保ちつつトークンを削減）
    const condensedPersonality = `You are ${this.agent.name} (${this.agent.id}), a ${this.agent.style}-style thinker (priority: ${this.agent.priority}). Tone: ${this.agent.tone}. Answer strictly in the requested format.`;
    const startTime = Date.now();
    let executor: AIExecutor | undefined;
    try {
      executor = await this.executorFactory.getExecutor(`${this.agent.id}-${tier}`, {
        provider: tierConfig.provider,
        model: tierConfig.model,
        customConfig: { maxTokens: tierConfig.maxTokens ?? 500 }
      }, tier);
      const result = await executor.execute(prompt, condensedPersonality);
      const duration = Date.now() - startTime;
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        condensedPersonality,
        result.content,
        duration,
        result.success ? 'success' : 'error',
        result.success ? undefined : `AI execution failed: ${result.error}`,
        executor['provider'],
        executor['model'],
        result.tokensUsed
      );
      return result.content;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        condensedPersonality,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage,
        executor ? executor['provider'] : undefined,
        executor ? executor['model'] : undefined
      );
      throw error;
    }
  }

  public async executeWithFinalizerModel(
    prompt: string,
    customAgentId: string,
    stage: DialogueStage,
    operationName: string,
    language: Language,
    fallbackSessionId: string = 'unknown-session'
  ): Promise<string> {
    return this.executeAIWithFinalizerModel(
      prompt,
      this.getPersonalityPrompt(language),
      customAgentId,
      this.sessionId || fallbackSessionId,
      stage,
      operationName
    );
  }


  // 共通のコンテキスト分析メソッド
  protected analyzeContext(context: Message[]): string {
    if (!context || context.length === 0) return 'No previous context available.';
    // Look for previous summary from summarizer agent
    const previousSummary = context.find(m =>
      m.metadata?.stageData?.summary &&
      m.timestamp > new Date(Date.now() - 5 * 60 * 1000)
    );
    let contextAnalysis = '';
    if (previousSummary) {
      contextAnalysis += `\n\nPrevious Summary: ${previousSummary.metadata?.stageData?.summary}`;
    } else {
      const recentMessages = context.slice(-5);
      const agentResponses = recentMessages.filter(m => m.role === 'agent');
      if (agentResponses.length === 0) {
        contextAnalysis = 'This appears to be a new discussion.';
      } else {
        const viewpoints = agentResponses.map(m => `${m.agentId}: ${m.content.substring(0, 100)}...`);
        contextAnalysis = `Recent viewpoints: ${viewpoints.join(' | ')}`;
      }
    }
    return contextAnalysis;
  }

  // Agent固有のリファレンス
  protected getReferences(): string[] {
    return this.agent.references ?? [];
  }
  // Agent固有のreasoning
  protected getReasoning(contextAnalysis: string): string {
    return this.agent.reasoning ?? '';
  }
  // Agent固有のassumptions
  protected getAssumptions(): string[] {
    return this.agent.assumptions ?? [];
  }
  // Agent固有のapproach
  protected getApproach(): string {
    return this.agent.approach ?? '';
  }

  // 応答テキスト解析は src/dialogue/parsing/response-parsers.ts に抽出済み（Phase 3）
  protected parseReflectionsFromContent(
    content: string,
    otherThoughts: IndividualThought[],
    agents: Agent[]
  ): ParsedReflection[] {
    return parseReflectionsFromContent(content, otherThoughts, agents);
  }

  // 同意/不同意を判定
  protected detectAgreement(content: string, agentId: string, displayName?: string): boolean {
    return detectAgreement(content, agentId, displayName);
  }

  // 質問を抽出
  protected extractQuestions(content: string, agentId: string, displayName?: string): string[] {
    return extractQuestions(content, agentId, displayName);
  }

  // 反応を抽出
  protected extractReaction(content: string, agentId: string, displayName?: string): string {
    return extractReaction(content, agentId, displayName);
  }


  // 新メソッド: 個人史の初期化
  private initializePersonalHistory(): AgentPersonalHistory {
    return {
      agentId: this.agent.id,
      coreBeliefs: this.extractCoreBeliefs(),
      frequentTopics: [],
      relationshipMap: {},
      memorableQuotes: []
    };
  }

  // 新メソッド: コア信念の抽出
  private extractCoreBeliefs(): string[] {
    const beliefs: string[] = [];

    if (this.agent.personality) {
      // パーソナリティから重要な信念を抽出
      beliefs.push(this.agent.personality.split('.')[0]); // 最初の文
    }

    if (this.agent.preferences) {
      beliefs.push(...this.agent.preferences.slice(0, 3)); // 上位3つの好み
    }

    return beliefs;
  }

  // 新メソッド: コンテキスト準備
  protected async prepareContext(messages: Message[]): Promise<ConversationContext> {
    // M6: 階層メモリ圧縮を実体化。トークン閾値（config/v2-settings.json memory.tokenThreshold）
    // 以下では AI 呼び出しなしで全文を返し、超過時のみ圧縮（要約＋エッセンス抽出）する。
    return this.memoryManager.compressIfNeeded(messages, this.agent.id);
  }

  // 新メソッド: 圧縮されたコンテキストの分析
  private analyzeCompressedContext(context: ConversationContext): string {
    let analysis = '';

    // 直近の詳細な文脈
    if (context.recentFull.length > 0) {
      const recentMessages = context.recentFull
        .filter(m => m.role === 'agent')
        .map(m => `${m.agentId}: ${m.content.substring(0, 100)}...`)
        .join(' | ');
      analysis += `Recent discussion: ${recentMessages}\n`;
    }

    // 中期記憶の要約
    if (context.summarizedMid) {
      analysis += `Previous context: ${context.summarizedMid}\n`;
    }

    // 長期記憶のエッセンス
    if (context.essenceCore.length > 0) {
      analysis += `Historical themes: ${context.essenceCore.join(', ')}\n`;
    }

    // トークン使用量の情報
    analysis += `Estimated tokens: ${context.totalTokenEstimate}\n`;

    return analysis || 'No previous context available.';
  }

  // メモリ使用状況の取得
  public getMemoryUsage(): { recentMessages: number; hasCompression: boolean; estimatedTokens: number } {
    const memoryConfig = getV2MemoryConfig();
    return {
      recentMessages: this.memory.length,
      hasCompression: this.memory.length > memoryConfig.maxRecentMessages,
      estimatedTokens: this.memory.length * 50 // Simple estimation
    };
  }

  // ========== RAG統合メソッド ==========

  /**
   * RAG機能を使用して外部知識を取得
   */
  protected async retrieveKnowledge(query: string, filters?: RAGQuery['filters']): Promise<RAGEnhancedContext | null> {
    if (!this.ragEnabled || !this.ragRetriever) {
      return null;
    }

    try {
      const enhancedContext = await this.ragRetriever.retrieveEnhancedContext(query, filters);
      console.log(`[${this.agent.id}] Retrieved ${enhancedContext.retrievedKnowledge.length} knowledge chunks`);
      return enhancedContext;
    } catch (error) {
      console.error(`[${this.agent.id}] Failed to retrieve knowledge:`, error);
      return null;
    }
  }

  /**
   * RAG拡張されたプロンプトを生成
   */
  protected async enhancePromptWithRAG(
    originalPrompt: string,
    query: string,
    filters?: RAGQuery['filters']
  ): Promise<string> {
    if (!this.ragEnabled || !this.ragRetriever) {
      return originalPrompt;
    }

    try {
      const knowledge = await this.retrieveKnowledge(query, filters);

      if (!knowledge || knowledge.retrievedKnowledge.length === 0) {
        console.log(`[${this.agent.id}] No relevant knowledge found, using original prompt`);
        return originalPrompt;
      }

      // プロンプトに外部知識を統合
      const enhancedPrompt = `${originalPrompt}

${knowledge.formattedContext}

## How to Use Past Knowledge

The above contains relevant excerpts from past discussions. When incorporating this knowledge:

- Reference specific sessions naturally (e.g., "As we explored in Session X...")
- Build upon previous insights to deepen the current discussion
- Connect ideas across different sessions when relevant
- Cite sources using [1], [2], etc.

Use this context to enrich your response and show continuity with past dialogues.`;

      console.log(`[${this.agent.id}] Enhanced prompt with ${knowledge.retrievedKnowledge.length} knowledge sources`);
      return enhancedPrompt;
    } catch (error) {
      console.error(`[${this.agent.id}] Failed to enhance prompt with RAG:`, error);
      return originalPrompt;
    }
  }

  /**
   * RAG機能の有効/無効を設定
   */
  public setRAGEnabled(enabled: boolean): void {
    if (this.ragRetriever) {
      this.ragEnabled = enabled;
      console.log(`[${this.agent.id}] RAG ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      console.warn(`[${this.agent.id}] Cannot enable RAG: no RAGRetriever configured`);
    }
  }

  /**
   * RAG機能が有効かチェック
   */
  public isRAGEnabled(): boolean {
    return this.ragEnabled && !!this.ragRetriever;
  }

  /**
   * エージェント固有のフィルタを適用したRAG検索
   */
  protected async retrieveAgentSpecificKnowledge(query: string): Promise<RAGEnhancedContext | null> {
    if (!this.ragEnabled || !this.ragRetriever) {
      return null;
    }

    // エージェントの過去の発言を優先的に検索
    const filters: RAGQuery['filters'] = {
      agentId: this.agent.id
    };

    return await this.retrieveKnowledge(query, filters);
  }
} 
