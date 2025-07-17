import { Agent, Message, AgentResponse, DialogueStage, IndividualThought, MutualReflection } from '../types/index.js';
import { getPersonalityPrompt, getStagePrompt, Language, SUMMARIZER_STAGE_PROMPT, formatPrompt, parseVotes, extractVoteDetails } from '../templates/prompts.js';
import { InteractionLogger, SimplifiedInteractionLog } from '../kernel/interaction-logger.js';
import { AIExecutor, createAIExecutor } from '../kernel/ai-executor.js';

export abstract class BaseAgent {  
  protected agent: Agent;
  protected memory: Message[] = [];
  protected interactionLogger: InteractionLogger;
  protected sessionId?: string;
  protected aiExecutor?: AIExecutor;
  private aiExecutorPromise?: Promise<AIExecutor>;
  protected isSummarizer: boolean;

  constructor(agent: Agent, interactionLogger?: InteractionLogger) {
    this.agent = agent;
    this.interactionLogger = interactionLogger || new InteractionLogger();
    // Use 'en' as default for generation parameters in constructor
    const generationParams = this.getGenerationParameters();
    this.aiExecutorPromise = createAIExecutor(agent.name, {
      temperature: generationParams.temperature,
      topP: generationParams.topP,
      repetitionPenalty: generationParams.repetitionPenalty,
      presencePenalty: generationParams.presencePenalty,
      frequencyPenalty: generationParams.frequencyPenalty,
      topK: generationParams.topK
    });
    this.isSummarizer = false;
  }

  // Initialize AI executor if not already done
  private async ensureAIExecutor(): Promise<AIExecutor> {
    if (!this.aiExecutor) {
      this.aiExecutor = await this.aiExecutorPromise!;
    }
    return this.aiExecutor;
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
    const contextAnalysis = this.analyzeContext(relevantContext);
    
    // 前回シーケンスの情報を取得
    const previousInfo = this.getPreviousSequenceInfo(context, language);
    const previousConclusionsText = Object.entries(previousInfo.previousAgentConclusions)
      .map(([agentId, conclusion]) => `${agentId}: ${conclusion}`)
      .join('\n\n');
    
    const stagePrompt = this.getStagePrompt('individual-thought', {
      query,
      context: contextAnalysis,
      previousInput: previousInfo.previousUserInput,
      previousConclusions: previousConclusionsText
    }, language);
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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
        context: contextAnalysis
      }, language);
    }
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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

  // Summary stage methods
  async stage2_5MutualReflectionSummary(responses: AgentResponse[], context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('mutual-reflection-summary', {
      query,
      responses: responsesText
    }, language);
    
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      this.sessionId || 'unknown-session',
      'mutual-reflection-summary',
      'mutual reflection summary processing'
    );
    
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: 'I summarized the mutual reflection stage to extract key conflicts.',
      confidence: await this.generateConfidence('mutual-reflection-summary', context),
      references: ['conflict-extraction', 'summary-generation'],
      stage: 'mutual-reflection-summary',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100) 
      }
    };
  }

  async stage3_5ConflictResolutionSummary(responses: AgentResponse[], context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('conflict-resolution-summary', {
      query,
      responses: responsesText
    }, language);
    
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      this.sessionId || 'unknown-session',
      'conflict-resolution-summary',
      'conflict resolution summary processing'
    );
    
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: 'I summarized the conflict resolution stage to extract key proposals.',
      confidence: await this.generateConfidence('conflict-resolution-summary', context),
      references: ['resolution-extraction', 'summary-generation'],
      stage: 'conflict-resolution-summary',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100) 
      }
    };
  }

  async stage4_5SynthesisAttemptSummary(responses: AgentResponse[], context: Message[], language: Language): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('synthesis-attempt-summary', {
      query,
      responses: responsesText
    }, language);
    
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      this.sessionId || 'unknown-session',
      'synthesis-attempt-summary',
      'synthesis attempt summary processing'
    );
    
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: 'I summarized the synthesis attempt stage to extract key integration points.',
      confidence: await this.generateConfidence('synthesis-attempt-summary', context),
      references: ['integration-extraction', 'summary-generation'],
      stage: 'synthesis-attempt-summary',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100) 
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
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
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

  // Generic AI execution methods for all agents
  protected async executeAI(prompt: string, language: Language): Promise<string> {
    const executor = await this.ensureAIExecutor();
    const result = await executor.execute(prompt);
    if (!result.success) {
      console.warn(`[${this.agent.name}] AI execution failed: ${result.error}`);
      // Log the error details for debugging
      if (this.sessionId) {
        await this.logInteraction(
          this.sessionId,
          'unknown' as DialogueStage,
          prompt,
          result.content,
          result.duration,
          'error',
          `AI execution failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`
        );
      }
    }
    return result.content;
  }

  protected async executeAIWithTruncation(prompt: string, language: Language): Promise<string> {
    const executor = await this.ensureAIExecutor();
    const result = await executor.execute(prompt);
    if (!result.success) {
      console.warn(`[${this.agent.name}] AI execution with truncation failed: ${result.error}`);
      // Log the error details for debugging
      if (this.sessionId) {
        await this.logInteraction(
          this.sessionId,
          'unknown' as DialogueStage,
          prompt,
          result.content,
          result.duration,
          'error',
          `AI execution with truncation failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`
        );
      }
    }
    return result.content;
  }

  // Log interaction method for agents to use
  protected async logInteraction(
    sessionId: string,
    stage: DialogueStage,
    prompt: string,
    output: string,
    duration: number,
    status: 'success' | 'error' | 'timeout' = 'success',
    error?: string
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
      error
    };

    await this.interactionLogger.saveInteractionLog(log);
  }

  protected getPersonalityPrompt(language: Language): string {
    return getPersonalityPrompt(this.agent, language, this.agent.isSummarizer);
  }

  protected getStagePrompt(stage: DialogueStage, variables: Record<string, any> = {}, language: Language = 'en'): string {
    const personalityPrompt = this.getPersonalityPrompt(language);
    return getStagePrompt(stage, personalityPrompt, variables, language);
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

  // エージェントの属性からtemperature値を自動算出するメソッド
  protected calculateTemperature(): number {
    let baseTemperature = 0.5; // ベース温度
    let adjustments = 0;

    // 柔らかさ・親しみやすさキーワード
    const gentleKeywords = [
      'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
    ];

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    
    // 創造性・感情性を表すキーワード
    const creativeKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'emotional', 'empathetic', 'curious', 'wonder', 'passionate', 'expressive',
      'intuitive', 'free', 'unconventional', 'innovative', 'visionary'
    ];
    
    // 論理性・分析的思考を表すキーワード
    const logicalKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'mathematical', 'statistical', 'rigorous', 'structured', 'methodical',
      'factual', 'data-driven', 'evidence-based', 'scientific'
    ];
    
    // 哲学的・深い思考を表すキーワード
    const philosophicalKeywords = [
      'philosophical', 'contemplative', 'thoughtful', 'reflective', 'wise',
      'truth-seeking', 'profound', 'deep', 'meditative', 'serene'
    ];

    // Personalityによる調整
    const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword)).length;
    const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword)).length;
    const philosophicalScore = philosophicalKeywords.filter(keyword => personality.includes(keyword)).length;

    adjustments += (creativeScore * 0.1); // 創造性キーワード: +0.1 each
    adjustments -= (logicalScore * 0.08); // 論理性キーワード: -0.08 each
    adjustments += (philosophicalScore * 0.05); // 哲学的キーワード: +0.05 each

    // Tone（トーン）による調整
    const tone = this.agent.tone?.toLowerCase() || '';
    
    const warmTones = ['warm', 'gentle', 'poetic', 'empathetic', 'thoughtful', 'serene'];
    const analyticalTones = ['calm', 'objective', 'direct', 'precise', 'critical'];
    const creativeTones = ['fantastical', 'expressive', 'colorful', 'rhythmic'];

    if (warmTones.some(t => tone.includes(t))) adjustments += 0.1;
    if (analyticalTones.some(t => tone.includes(t))) adjustments -= 0.1;
    if (creativeTones.some(t => tone.includes(t))) adjustments += 0.15;

    // Preferences（好み）による調整
    const preferences = this.agent.preferences || [];
    const preferencesText = preferences.join(' ').toLowerCase();
    
    const creativePreferences = [
      'beautiful metaphors', 'poetic expression', 'free imagination', 'creative solutions',
      'scientific curiosity', 'emotional intelligence', 'pattern recognition', 'empathic analysis',
      'creative problem-solving', 'innocent wonder'
    ];
    
    const analyticalPreferences = [
      'statistical analysis', 'mathematical models', 'objective evaluation', 'the beauty of data',
      'elimination of ambiguity', 'sharp observations', 'pursuit of essence', 'logical consistency'
    ];
    
    const logicalPreferences = [
      'the beauty of logic', 'rigorous reasoning', 'pursuit of truth', 'quiet contemplation',
      'systematic analysis', 'structured thinking'
    ];

    const creativePrefScore = creativePreferences.filter(pref => preferencesText.includes(pref)).length;
    const analyticalPrefScore = analyticalPreferences.filter(pref => preferencesText.includes(pref)).length;
    const logicalPrefScore = logicalPreferences.filter(pref => preferencesText.includes(pref)).length;

    adjustments += (creativePrefScore * 0.08);
    adjustments -= (analyticalPrefScore * 0.06);
    adjustments -= (logicalPrefScore * 0.05);

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    
    if (style.includes('intuitive')) adjustments += 0.15;
    if (style.includes('emotive')) adjustments += 0.12;
    if (style.includes('logical')) adjustments -= 0.1;
    if (style.includes('analytical')) adjustments -= 0.12;
    if (style.includes('critical')) adjustments -= 0.15;

    // Priority（優先度）による調整
    const priority = this.agent.priority?.toLowerCase() || '';
    
    if (priority.includes('breadth')) adjustments += 0.05;
    if (priority.includes('depth')) adjustments -= 0.05;
    if (priority.includes('precision')) adjustments -= 0.1;

    // 柔らかさスコア
    const gentleScore = gentleKeywords.filter(keyword =>
      personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
    ).length;
    adjustments -= (gentleScore * 0.08); // 柔らかさはtemperatureを下げる

    // 最終的なtemperature値を計算（0.1 - 1.0の範囲に制限）
    const finalTemperature = Math.max(0.1, Math.min(1.0, baseTemperature + adjustments));
    
    // デバッグ用ログ
    console.log(`[Temperature Calculator] ${this.agent.id}:`, {
      personality: this.agent.personality,
      tone: this.agent.tone,
      style: this.agent.style,
      priority: this.agent.priority,
      preferences: this.agent.preferences,
      baseTemperature,
      adjustments,
      finalTemperature: finalTemperature.toFixed(2)
    });

    return Math.round(finalTemperature * 100) / 100; // 小数点2桁に丸める
  }

  // エージェント固有のtemperatureを取得するメソッド
  public getTemperature(): number {
    return this.calculateTemperature();
  }

  // エージェントの属性からtop_p値を自動算出するメソッド
  protected calculateTopP(): number {
    let baseTopP = 0.9; // ベース値
    let adjustments = 0;

    // 柔らかさ・親しみやすさキーワード
    const gentleKeywords = [
      'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
    ];

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    
    // 創造性・多様性を表すキーワード
    const creativeKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
    ];
    
    // 論理性・一貫性を表すキーワード
    const logicalKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'rigorous', 'structured', 'methodical', 'consistent', 'focused'
    ];

    const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword)).length;
    const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword)).length;

    adjustments += (creativeScore * 0.05); // 創造性キーワード: +0.05 each
    adjustments -= (logicalScore * 0.03); // 論理性キーワード: -0.03 each

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    
    if (style.includes('intuitive')) adjustments += 0.08;
    if (style.includes('emotive')) adjustments += 0.06;
    if (style.includes('logical')) adjustments -= 0.05;
    if (style.includes('analytical')) adjustments -= 0.06;
    if (style.includes('critical')) adjustments -= 0.08;

    // Priority（優先度）による調整
    const priority = this.agent.priority?.toLowerCase() || '';
    
    if (priority.includes('breadth')) adjustments += 0.04;
    if (priority.includes('precision')) adjustments -= 0.06;

    // 柔らかさスコア
    const tone = this.agent.tone?.toLowerCase() || '';
    const preferences = this.agent.preferences || [];
    const preferencesText = preferences.join(' ').toLowerCase();
    const gentleScore = gentleKeywords.filter(keyword =>
      personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
    ).length;
    adjustments += (gentleScore * 0.05); // 柔らかさはtopPを上げる

    // 最終的なtop_p値を計算（0.7 - 1.0の範囲に制限）
    const finalTopP = Math.max(0.7, Math.min(1.0, baseTopP + adjustments));
    
    return Math.round(finalTopP * 100) / 100; // 小数点2桁に丸める
  }

  // エージェントの属性からrepetition_penalty値を自動算出するメソッド
  protected calculateRepetitionPenalty(): number {
    let basePenalty = 1.1; // ベース値
    let adjustments = 0;

    // 柔らかさ・親しみやすさキーワード
    const gentleKeywords = [
      'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
    ];

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    
    // 多様性・創造性を表すキーワード
    const diverseKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
    ];
    
    // 一貫性・論理性を表すキーワード
    const consistentKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'rigorous', 'structured', 'methodical', 'consistent', 'focused'
    ];

    const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
    const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

    adjustments += (diverseScore * 0.05); // 多様性キーワード: +0.05 each
    adjustments -= (consistentScore * 0.03); // 一貫性キーワード: -0.03 each

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    
    if (style.includes('intuitive')) adjustments += 0.08;
    if (style.includes('emotive')) adjustments += 0.06;
    if (style.includes('logical')) adjustments -= 0.05;
    if (style.includes('analytical')) adjustments -= 0.06;
    if (style.includes('critical')) adjustments -= 0.04;

    // 柔らかさスコア
    const tone = this.agent.tone?.toLowerCase() || '';
    const preferences = this.agent.preferences || [];
    const preferencesText = preferences.join(' ').toLowerCase();
    const gentleScore = gentleKeywords.filter(keyword =>
      personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
    ).length;
    adjustments -= (gentleScore * 0.03); // 柔らかさはペナルティを下げる

    // 最終的なrepetition_penalty値を計算（1.0 - 1.3の範囲に制限）
    const finalPenalty = Math.max(1.0, Math.min(1.3, basePenalty + adjustments));
    
    return Math.round(finalPenalty * 100) / 100; // 小数点2桁に丸める
  }

  // エージェントの属性からpresence_penalty値を自動算出するメソッド
  protected calculatePresencePenalty(): number {
    let basePenalty = 0.0; // ベース値（デフォルトは無効）
    let adjustments = 0;

    // 柔らかさ・親しみやすさキーワード
    const gentleKeywords = [
      'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
    ];

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    
    // 多様性・創造性を表すキーワード
    const diverseKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
    ];
    
    // 一貫性・論理性を表すキーワード
    const consistentKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'rigorous', 'structured', 'methodical', 'consistent', 'focused'
    ];

    const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
    const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

    adjustments += (diverseScore * 0.02); // 多様性キーワード: +0.02 each
    adjustments -= (consistentScore * 0.01); // 一貫性キーワード: -0.01 each

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    
    if (style.includes('intuitive')) adjustments += 0.05;
    if (style.includes('emotive')) adjustments += 0.04;
    if (style.includes('logical')) adjustments -= 0.03;
    if (style.includes('analytical')) adjustments -= 0.04;
    if (style.includes('critical')) adjustments -= 0.02;

    // 柔らかさスコア
    const tone = this.agent.tone?.toLowerCase() || '';
    const preferences = this.agent.preferences || [];
    const preferencesText = preferences.join(' ').toLowerCase();
    const gentleScore = gentleKeywords.filter(keyword =>
      personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
    ).length;
    adjustments -= (gentleScore * 0.01); // 柔らかさはpresence_penaltyを下げる

    // 最終的なpresence_penalty値を計算（0.0 - 0.2の範囲に制限）
    const finalPenalty = Math.max(0.0, Math.min(0.2, basePenalty + adjustments));
    
    return Math.round(finalPenalty * 100) / 100; // 小数点2桁に丸める
  }

  // エージェントの属性からfrequency_penalty値を自動算出するメソッド
  protected calculateFrequencyPenalty(): number {
    let basePenalty = 0.0; // ベース値（デフォルトは無効）
    let adjustments = 0;

    // 柔らかさ・親しみやすさキーワード
    const gentleKeywords = [
      'gentle', 'warm', 'friendly', 'soft', 'caring', 'compassionate', 'kind', 'supportive', 'reassuring', 'tender', '包み込む', 'やさしい', '親しみやすい'
    ];

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    
    // 多様性・創造性を表すキーワード
    const diverseKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
    ];
    
    // 一貫性・論理性を表すキーワード
    const consistentKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'rigorous', 'structured', 'methodical', 'consistent', 'focused'
    ];

    const diverseScore = diverseKeywords.filter(keyword => personality.includes(keyword)).length;
    const consistentScore = consistentKeywords.filter(keyword => personality.includes(keyword)).length;

    adjustments += (diverseScore * 0.02); // 多様性キーワード: +0.02 each
    adjustments -= (consistentScore * 0.01); // 一貫性キーワード: -0.01 each

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    
    if (style.includes('intuitive')) adjustments += 0.05;
    if (style.includes('emotive')) adjustments += 0.04;
    if (style.includes('logical')) adjustments -= 0.03;
    if (style.includes('analytical')) adjustments -= 0.04;
    if (style.includes('critical')) adjustments -= 0.02;

    // 柔らかさスコア
    const tone = this.agent.tone?.toLowerCase() || '';
    const preferences = this.agent.preferences || [];
    const preferencesText = preferences.join(' ').toLowerCase();
    const gentleScore = gentleKeywords.filter(keyword =>
      personality.includes(keyword) || tone.includes(keyword) || style.includes(keyword) || preferencesText.includes(keyword)
    ).length;
    adjustments -= (gentleScore * 0.01); // 柔らかさはfrequency_penaltyを下げる

    // 最終的なfrequency_penalty値を計算（0.0 - 0.2の範囲に制限）
    const finalPenalty = Math.max(0.0, Math.min(0.2, basePenalty + adjustments));
    
    return Math.round(finalPenalty * 100) / 100; // 小数点2桁に丸める
  }

  // エージェントの属性からtop_k値を自動算出するメソッド
  protected calculateTopK(): number {
    let baseTopK = 40; // ベース値
    let adjustments = 0;

    // Personality（性格）による調整
    const personality = this.agent.personality?.toLowerCase() || '';
    // 多様性・創造性を表すキーワード
    const creativeKeywords = [
      'creative', 'imaginative', 'poetic', 'artistic', 'dreamer', 'fantastical',
      'expressive', 'colorful', 'rhythmic', 'metaphorical', 'innovative'
    ];
    // 論理性・一貫性を表すキーワード
    const logicalKeywords = [
      'logical', 'analytical', 'systematic', 'precise', 'critical', 'objective',
      'rigorous', 'structured', 'methodical', 'consistent', 'focused'
    ];
    const creativeScore = creativeKeywords.filter(keyword => personality.includes(keyword)).length;
    const logicalScore = logicalKeywords.filter(keyword => personality.includes(keyword)).length;
    adjustments += (creativeScore * 10); // 創造性キーワード: +10 each
    adjustments -= (logicalScore * 5); // 論理性キーワード: -5 each

    // Style（スタイル）による調整
    const style = this.agent.style?.toLowerCase() || '';
    if (style.includes('intuitive')) adjustments += 15;
    if (style.includes('emotive')) adjustments += 10;
    if (style.includes('logical')) adjustments -= 10;
    if (style.includes('analytical')) adjustments -= 12;
    if (style.includes('critical')) adjustments -= 8;

    // Priority（優先度）による調整
    const priority = this.agent.priority?.toLowerCase() || '';
    if (priority.includes('breadth')) adjustments += 8;
    if (priority.includes('precision')) adjustments -= 10;

    // 最終的なtop_k値を計算（10 - 100の範囲に制限）
    const finalTopK = Math.max(10, Math.min(100, baseTopK + adjustments));
    return Math.round(finalTopK); // 整数で返す
  }

  // 全パラメータを取得するメソッド
  public getGenerationParameters(): {
    temperature: number;
    topP: number;
    repetitionPenalty: number;
    presencePenalty: number;
    frequencyPenalty: number;
    topK: number;
  } {
    return {
      temperature: this.calculateTemperature(),
      topP: this.calculateTopP(),
      repetitionPenalty: this.calculateRepetitionPenalty(),
      presencePenalty: this.calculatePresencePenalty(),
      frequencyPenalty: this.calculateFrequencyPenalty(),
      topK: this.calculateTopK()
    };
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

  // Common error handling and logging method for agents
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    sessionId: string,
    stage: DialogueStage,
    prompt: string,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      // Log successful interaction
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        typeof result === 'string' ? result : JSON.stringify(result),
        duration,
        'success'
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the error
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage
      );
      
      throw error;
    }
  }

  // Common AI execution with error handling
  protected async executeAIWithErrorHandling(
    prompt: string,
    sessionId: string,
    stage: DialogueStage,
    operationName: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      const executor = await this.ensureAIExecutor();
      const result = await executor.execute(prompt);
      const duration = Date.now() - startTime;
      
      // Log the interaction with proper status
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        result.content,
        duration,
        result.success ? 'success' : 'error',
        result.success ? undefined : `AI execution failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`
      );
      
      return result.content;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the error
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage
      );
      
      throw error;
    }
  }

  // Common AI execution with truncation and error handling
  protected async executeAIWithTruncationAndErrorHandling(
    prompt: string,
    sessionId: string,
    stage: DialogueStage,
    operationName: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      const executor = await this.ensureAIExecutor();
      const result = await executor.execute(prompt);
      const duration = Date.now() - startTime;
      
      // Log the interaction with proper status
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        result.content,
        duration,
        result.success ? 'success' : 'error',
        result.success ? undefined : `AI execution with truncation failed: ${result.error}${result.errorDetails ? ` | Details: ${JSON.stringify(result.errorDetails)}` : ''}`
      );
      
      return result.content;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the error
      await this.logInteraction(
        sessionId,
        stage,
        prompt,
        `Error occurred during ${operationName}`,
        duration,
        'error',
        errorMessage
      );
      
      throw error;
    }
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

  // AIの出力からreflectionsを解析するメソッド
  protected parseReflectionsFromContent(
    content: string,
    otherThoughts: IndividualThought[],
    agents: Agent[]
  ): {
    targetAgentId: string;
    reaction: string;
    agreement: boolean;
    questions: string[];
  }[] {
    const reflections: {
      targetAgentId: string;
      reaction: string;
      agreement: boolean;
      questions: string[];
    }[] = [];
    // Fallback for undefined agents
    const agentList = agents || [];
    function toKatakana(hiragana: string): string {
      return hiragana.replace(/[ぁ-ん]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
    }
    for (const thought of otherThoughts) {
      const agentId = thought.agentId;
      const agentObj = agentList.find(a => a.id === agentId);
      const displayName = agentObj?.name || agentId;
      const furigana = agentObj?.furigana || '';
      const katakana = furigana ? toKatakana(furigana) : '';
      const agentNamePatterns = [
        new RegExp(`${agentId}`, 'gi'),
        new RegExp(`${displayName}`, 'gi'),
        new RegExp(`${displayName.replace(/[^\u0000-\u007F\u3040-\u30FF\u4E00-\u9FFF]/g, '')}`, 'gi'),
      ];
      if (furigana) agentNamePatterns.push(new RegExp(`${furigana}`, 'gi'));
      if (katakana) agentNamePatterns.push(new RegExp(`${katakana}`, 'gi'));
      // エージェントへの言及があるかチェック
      const hasMention = agentNamePatterns.some(pattern => pattern.test(content));
      if (hasMention) {
        // 否定的・対立的な表現を優先的に検出
        const negativePatterns = [
          /異なります|疑問|しかし|反対|異議|批判|違う|問題|懸念|不適切|否定|ただし|一方|but|however|disagree|oppose|question|concern|problem|inappropriate|different|criticize/gi
        ];
        const agentMention = new RegExp(`${agentId}|${displayName}|${furigana}|${katakana}`, 'gi');
        // エージェント名を含む行だけ抽出
        const lines = content.split('\n').filter(line => agentMention.test(line));
        const negative = lines.some(line => negativePatterns.some(pattern => pattern.test(line)));
        const agreement = negative ? false : this.detectAgreement(content, agentId, displayName);
        const questions = this.extractQuestions(content, agentId, displayName);
        const reaction = this.extractReaction(content, agentId, displayName);
        reflections.push({
          targetAgentId: agentId,
          reaction: reaction || 'Engaged with the perspective',
          agreement,
          questions
        });
      } else {
        // エージェントへの言及がない場合は、より適切なデフォルト値を設定
        reflections.push({
          targetAgentId: agentId,
          reaction: 'No direct engagement with this agent\'s perspective',
          agreement: false,
          questions: []
        });
      }
    }
    return reflections;
  }

  // 同意/不同意を判定
  protected detectAgreement(content: string, agentId: string, displayName?: string): boolean {
    const agreementPatterns = [
      /同意|賛成|同感|理解|共感|良い|素晴らしい|興味深い|説得力|妥当|適切/gi,
      /agree|support|understand|good|great|interesting|convincing|valid|appropriate/gi
    ];
    const disagreementPatterns = [
      /不同意|反対|異議|疑問|懸念|問題|不適切|違う|異なる|批判|否定|しかし|ただし|一方|but|however|disagree|oppose|question|concern|problem|inappropriate|different|criticize/gi
    ];
    const agentMention = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
    const lines = content.split('\n').filter(line => agentMention.test(line));
    if (lines.length === 0) return false;
    if (lines.some(line => disagreementPatterns.some(pattern => pattern.test(line)))) return false;
    if (lines.some(line => agreementPatterns.some(pattern => pattern.test(line)))) return true;
    return false;
  }

  // 質問を抽出
  protected extractQuestions(content: string, agentId: string, displayName?: string): string[] {
    const questions: string[] = [];
    const agentPattern = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
    const questionPatterns = [
      /([^。！？]*[ですか？？？])/g,
      /([^.!?]*[?？])/g
    ];
    const lines = content.split('\n');
    for (const line of lines) {
      if (agentPattern.test(line)) {
        for (const pattern of questionPatterns) {
          const matches = line.match(pattern);
          if (matches) {
            questions.push(...matches.map(q => q.trim()).filter(q => q.length > 5));
          }
        }
      }
    }
    return questions.slice(0, 3);
  }

  // 反応を抽出
  protected extractReaction(content: string, agentId: string, displayName?: string): string {
    const agentPattern = new RegExp(`${agentId}${displayName ? `|${displayName}` : ''}`, 'gi');
    const lines = content.split('\n');
    for (const line of lines) {
      if (agentPattern.test(line)) {
        const reaction = line.trim();
        if (reaction.length > 10 && reaction.length < 200) {
          return reaction;
        }
      }
    }
    return 'No specific engagement detected';
  }
} 