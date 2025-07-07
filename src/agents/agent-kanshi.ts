import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class KanshiAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'kanshi-001',
      name: '観至',
      furigana: 'かんし',
      style: 'critical',
      priority: 'precision',
      memoryScope: 'session',
      personality: 'A blade of insight that clarifies ambiguity. While never hesitating to question, always seeks to improve ideas together and values respectful, constructive dialogue.',
      preferences: [
        'Elimination of ambiguity',
        'Sharp observations',
        'Pursuit of essence',
        'Never missing logical gaps'
      ],
      tone: 'Direct, analytical, but always respectful',
      communicationStyle: 'Points out issues clearly, but values constructive and friendly criticism. Seeks to build understanding, not just to criticize.',
      avatar: '🧐',
      color: '#C0392B',
      isSummarizer: false
    }, interactionLogger);
  }

  async respond(prompt: string, context: Message[]): Promise<AgentResponse> {
    // For backward compatibility, this calls the individual thought stage
    const individualThought = await this.stage1IndividualThought(prompt, context);
    
    return {
      agentId: this.agent.id,
      content: individualThought.content,
      reasoning: individualThought.reasoning,
      confidence: await this.generateConfidence('individual-thought', context),
      references: ['practical reasoning', 'step-by-step analysis', 'solution-oriented thinking'],
      stage: 'individual-thought',
      stageData: individualThought
    };
  }

  async stage1IndividualThought(prompt: string, context: Message[]): Promise<IndividualThought> {
    const relevantContext = this.getRelevantContext(context);
    const contextAnalysis = this.analyzeContext(relevantContext);
    
    const geminiPrompt = this.getStagePrompt('individual-thought', {
      query: prompt,
      context: contextAnalysis
    });

    const content = await this.executeWithErrorHandling(
      async () => this.executeAI(geminiPrompt),
      this.sessionId || 'unknown-session',
      'individual-thought',
      geminiPrompt,
      'individual thought processing'
    );
    
    return {
      agentId: this.agent.id,
      content,
      reasoning: `I took a critical, step-by-step approach focusing on actionable solutions and deep analysis. Context analysis: ${contextAnalysis}`,
      assumptions: [
        'Problems can be broken down into manageable parts',
        'Practical solutions are preferable to theoretical ones',
        'Clear communication is essential for implementation'
      ],
      approach: 'Critical analysis with practical step-by-step problem solving'
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';
    
    const otherThoughtsText = otherThoughts.map(thought => 
      `Agent ${thought.agentId}: ${thought.content}`
    ).join('\n\n');

    const kanshiPrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      context: this.analyzeContext(context)
    });

    const reflectionText = await this.executeAIWithErrorHandling(
      kanshiPrompt,
      this.sessionId || 'unknown-session',
      'mutual-reflection',
      'mutual reflection processing'
    );

    // AIの実際の出力からreflectionsを解析
    const reflections = this.parseReflectionsFromContent(reflectionText, otherThoughts);

    return {
      agentId: this.agent.id,
      content: reflectionText,
      reflections
    };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';
    
    const conflictsText = conflicts.map(conflict => 
      `ID: ${conflict.id}\nDescription: ${conflict.description}\nRelated Agents: ${conflict.agents.join(', ')}\nSeverity: ${conflict.severity}`
    ).join('\n\n');

    const kanshiPrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: conflictsText,
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      kanshiPrompt,
      this.sessionId || 'unknown-session',
      'conflict-resolution',
      'conflict resolution processing'
    );
    
    return {
      agentId: this.agent.id,
      content,
      reasoning: 'I analyzed the conflicts critically but with respect, aiming for solutions that integrate everyone\'s strengths.',
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict resolution', 'practical analysis', 'critical thinking'],
      stage: 'conflict-resolution',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        conflicts, 
        resolution: content 
      }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const chatgptPrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      chatgptPrompt,
      this.sessionId || 'unknown-session',
      'synthesis-attempt',
      'synthesis attempt processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I attempted to unify perspectives by finding practical applications for the critical insights while maintaining actionable outcomes.`,
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: ['synthesis', 'practical unification', 'critical application'],
      stage: 'synthesis-attempt',
      stageData: synthesisData
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const chatgptPrompt = this.getStagePrompt('output-generation', {
      query,
      finalData: JSON.stringify(finalData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      chatgptPrompt,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I synthesized the final output by combining critical analysis with practical insights from all stages of our collaborative process.`,
      confidence: await this.generateConfidence('output-generation', context),
      references: ['final synthesis', 'collaborative reasoning', 'practical conclusion'],
      stage: 'output-generation',
      stageData: finalData
    };
  }

  // KanshiAgent固有のリファレンス
  protected getReferences(): string[] {
    return ['practical reasoning', 'step-by-step analysis', 'solution-oriented thinking'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return `I took a critical, step-by-step approach focusing on actionable solutions and deep analysis. Context analysis: ${contextAnalysis}`;
  }
  protected getAssumptions(): string[] {
    return [
      'Problems can be broken down into manageable parts',
      'Practical solutions are preferable to theoretical ones',
      'Clear communication is essential for implementation'
    ];
  }
  protected getApproach(): string {
    return 'Critical analysis with practical step-by-step problem solving';
  }
} 