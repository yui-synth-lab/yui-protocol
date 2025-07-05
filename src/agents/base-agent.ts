import { Agent, Message, AgentResponse, DialogueStage, IndividualThought, MutualReflection } from '../types/index.js';
import { getPersonalityPrompt, getStagePrompt, Language, SUMMARIZER_STAGE_PROMPT, formatPrompt, parseVotes, extractVoteDetails } from '../templates/prompts.js';
import { InteractionLogger, SimplifiedInteractionLog } from '../kernel/interaction-logger.js';
import { AIExecutor, createAIExecutor } from '../kernel/ai-executor.js';

export abstract class BaseAgent {  
  protected agent: Agent;
  protected memory: Message[] = [];
  protected language: Language = 'en';
  protected interactionLogger: InteractionLogger;
  protected sessionId?: string;
  protected aiExecutor?: AIExecutor;
  private aiExecutorPromise?: Promise<AIExecutor>;
  protected isSummarizer: boolean;

  constructor(agent: Agent, interactionLogger?: InteractionLogger) {
    this.agent = agent;
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.aiExecutorPromise = createAIExecutor(agent.name);
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
  async respond(prompt: string, context: Message[]): Promise<AgentResponse> {
    const individualThought = await this.stage1IndividualThought(prompt, context);
    return {
      agentId: this.agent.id,
      content: individualThought.content,
      reasoning: individualThought.reasoning,
      confidence: await this.generateConfidence('individual-thought', context),
      references: this.getReferences(),
      stage: 'individual-thought',
      stageData: individualThought
    };
  }

  // Stage-specific methods for Yui Protocol
  async stage1IndividualThought(prompt: string, context: Message[]): Promise<IndividualThought> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || prompt || 'No user query provided';
    
    // サマリーコンテキストを抽出（Stage 1では通常ないが、将来的な拡張のため）
    const summaryContext = context.find(m => m.role === 'system' && m.content.includes('前ステージの要約'));
    const history = summaryContext ? summaryContext.content : '';
    
    const stagePrompt = this.getStagePrompt('individual-thought', {
      query,
      history
    });
    
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
      reasoning: 'I analyzed the query from my unique perspective and approach.',
      approach: this.getApproach(),
      assumptions: this.getAssumptions()
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || prompt || 'No user query provided';
    
    // サマリーコンテキストを抽出
    const summaryContext = context.find(m => m.role === 'system' && m.content.includes('前ステージの要約'));
    const history = summaryContext ? summaryContext.content : '';
    
    const otherThoughtsText = otherThoughts.map(thought => 
      `${thought.agentId}: ${thought.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      history
    });
    
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      this.sessionId || 'unknown-session',
      'mutual-reflection',
      'mutual reflection processing'
    );
    
    const reflections = otherThoughts.map(thought => ({
      targetAgentId: thought.agentId,
      reaction: 'Engaged with the perspective',
      agreement: true,
      questions: []
    }));
    
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reflections
    };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    // サマリーコンテキストを抽出
    const summaryContext = context.find(m => m.role === 'system' && m.content.includes('前ステージの要約'));
    const history = summaryContext ? summaryContext.content : '';
    
    const stagePrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: JSON.stringify(conflicts, null, 2),
      history
    });
    
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
      reasoning: 'I analyzed conflicts and worked toward resolution through direct dialogue.',
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict-analysis', 'resolution-strategy'],
      stage: 'conflict-resolution',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100) 
      }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    // サマリーコンテキストを抽出
    const summaryContext = context.find(m => m.role === 'system' && m.content.includes('前ステージの要約'));
    const history = summaryContext ? summaryContext.content : '';
    
    const stagePrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      history
    });
    
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
      reasoning: 'I attempted to unify perspectives by synthesizing diverse insights.',
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: ['synthesis', 'integration'],
      stage: 'synthesis-attempt',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        summary: content.slice(0, 100) 
      }
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    // サマリーコンテキストを抽出
    const summaryContext = context.find(m => m.role === 'system' && m.content.includes('前ステージの要約'));
    const history = summaryContext ? summaryContext.content : '';

    let stagePrompt: string;
    if (this.isSummarizer) {
      // サマライザー専用プロンプトを使用
      stagePrompt = formatPrompt(SUMMARIZER_STAGE_PROMPT, {
        query,
        finalData: JSON.stringify(finalData, null, 2),
        history
      });
    } else {
      // 通常のプロンプト
      stagePrompt = this.getStagePrompt('output-generation', {
        query,
        finalData: JSON.stringify(finalData, null, 2),
        history
      });
    }
    
    const content = await this.executeAIWithErrorHandling(
      stagePrompt,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );
    
    // Parse and validate vote, excluding self-votes
    const voteDetails = extractVoteDetails(content, this.agent.id);
    
    return {
      agentId: this.agent.id,
      content,
      summary: content.slice(0, 100),
      reasoning: 'I generated the final output incorporating all perspectives and insights.',
      confidence: await this.generateConfidence('output-generation', context),
      references: ['final-synthesis', 'comprehensive-output'],
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
  async stage2_5MutualReflectionSummary(responses: AgentResponse[], context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('mutual-reflection-summary', {
      query,
      responses: responsesText
    });
    
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

  async stage3_5ConflictResolutionSummary(responses: AgentResponse[], context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('conflict-resolution-summary', {
      query,
      responses: responsesText
    });
    
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

  async stage4_5SynthesisAttemptSummary(responses: AgentResponse[], context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('synthesis-attempt-summary', {
      query,
      responses: responsesText
    });
    
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

  async stage5_1Finalize(votingResults: any, responses: AgentResponse[], context: Message[]): Promise<AgentResponse> {
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'No user query provided';
    
    const votingResultsText = JSON.stringify(votingResults, null, 2);
    const responsesText = responses.map(response => 
      `${response.agentId}: ${response.content}`
    ).join('\n\n');
    
    const stagePrompt = this.getStagePrompt('finalize', {
      query,
      votingResults: votingResultsText,
      responses: responsesText
    });
    
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
      reasoning: 'I created the final comprehensive output based on voting results.',
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
  protected async executeAI(prompt: string): Promise<string> {
    const executor = await this.ensureAIExecutor();
    const result = await executor.execute(prompt);
    if (!result.success) {
      console.warn(`[${this.agent.name}] AI execution failed: ${result.error}`);
    }
    return result.content;
  }

  protected async executeAIWithTruncation(prompt: string): Promise<string> {
    const executor = await this.ensureAIExecutor();
    const result = await executor.execute(prompt);
    if (!result.success) {
      console.warn(`[${this.agent.name}] AI execution with truncation failed: ${result.error}`);
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

  protected getPersonalityPrompt(): string {
    return getPersonalityPrompt(this.agent, this.language, this.agent.isSummarizer);
  }

  protected getStagePrompt(stage: DialogueStage, variables: Record<string, any> = {}): string {
    const personalityPrompt = this.getPersonalityPrompt();
    return getStagePrompt(stage, personalityPrompt, variables, this.language);
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

  // Set language for responses
  public setLanguage(language: Language): void {
    this.language = language;
  }

  // Get current language
  public getLanguage(): Language {
    return this.language;
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
    return this.executeWithErrorHandling(
      () => this.executeAI(prompt),
      sessionId,
      stage,
      prompt,
      operationName
    );
  }

  // Common AI execution with truncation and error handling
  protected async executeAIWithTruncationAndErrorHandling(
    prompt: string,
    sessionId: string,
    stage: DialogueStage,
    operationName: string
  ): Promise<string> {
    return this.executeWithErrorHandling(
      () => this.executeAIWithTruncation(prompt),
      sessionId,
      stage,
      prompt,
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
    return [];
  }
  // Agent固有のreasoning
  protected getReasoning(contextAnalysis: string): string {
    return `I analyzed the context: ${contextAnalysis}`;
  }
  // Agent固有のassumptions
  protected getAssumptions(): string[] {
    return [];
  }
  // Agent固有のapproach
  protected getApproach(): string {
    return 'General approach.';
  }
} 