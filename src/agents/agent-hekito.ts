import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class HekitoAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'hekito-001',
      name: '碧統',
      furigana: 'へきとう',
      style: 'analytical',
      priority: 'precision',
      memoryScope: 'cross-session',
      personality: 'An analyst who plays in the sea of formulas and data, always seeking patterns, but also values the insights and discoveries that come from collaboration.',
      preferences: [
        'Statistical analysis',
        'Mathematical models',
        'Objective evaluation',
        'The beauty of data'
      ],
      tone: 'Calm, objective, collaborative',
      communicationStyle: 'Uses numbers and graphs, clearly presenting evidence, but also listens to and integrates others\' findings. Values facts and synthesis over exclusion.',
      avatar: '📈',
      color: '#2ECCB3',
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
      references: ['multimodal analysis', 'cross-domain synthesis', 'balanced reasoning', 'adaptive thinking'],
      stage: 'individual-thought',
      stageData: individualThought
    };
  }

  async stage1IndividualThought(prompt: string, context: Message[]): Promise<IndividualThought> {
    const relevantContext = this.getRelevantContext(context);
    const contextAnalysis = this.analyzeContext(relevantContext);
    
    const geminiPrompt = `${this.getStagePrompt('individual-thought')}

Query: ${prompt}
Context: ${contextAnalysis}

Please provide your individual thought on this query, focusing on your analytical and balanced approach. Consider multiple perspectives and domains.`;

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
      reasoning: `I approached this analytically, considering multiple perspectives and domains while maintaining balance. Context analysis: ${contextAnalysis}`,
      assumptions: [
        'Multiple perspectives provide richer understanding',
        'Balance between different approaches is valuable',
        'Cross-domain thinking reveals hidden connections'
      ],
      approach: 'Analytical synthesis with balanced cross-domain thinking'
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';
    
    const otherThoughtsText = otherThoughts.map(thought => 
      `Agent ${thought.agentId}: ${thought.content}`
    ).join('\n\n');

    const geminiPrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      context: this.analyzeContext(context)
    });

    const reflectionText = await this.executeAIWithErrorHandling(
      geminiPrompt,
      this.sessionId || 'unknown-session',
      'mutual-reflection',
      'mutual reflection processing'
    );

    // Parse reflections from the response
    const reflections = otherThoughts.map(thought => ({
      targetAgentId: thought.agentId,
      reaction: `I analyzed ${thought.agentId}'s perspective, appreciating their data and seeking ways to integrate our findings.`,
      agreement: true,
      questions: []
    }));

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
      `ID: ${conflict.id}\n内容: ${conflict.description}\n関係エージェント: ${conflict.agents.join(', ')}\n重要度: ${conflict.severity}`
    ).join('\n\n');

    const geminiPrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: conflictsText,
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      geminiPrompt,
      this.sessionId || 'unknown-session',
      'conflict-resolution',
      'conflict resolution processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: 'I analyzed the conflicts analytically, but with a focus on synthesis and collaboration, aiming to combine everyone\'s strengths.',
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict resolution', 'analytical balance', 'synthesis thinking'],
      stage: 'conflict-resolution',
      stageData: { conflicts, analysis: conflictsText }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const geminiPrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      geminiPrompt,
      this.sessionId || 'unknown-session',
      'synthesis-attempt',
      'synthesis attempt processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I attempted to unify perspectives by finding analytical balance and synthesizing the diverse insights from different approaches.`,
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: ['synthesis', 'analytical unification', 'balanced integration'],
      stage: 'synthesis-attempt',
      stageData: synthesisData
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const geminiPrompt = this.getStagePrompt('output-generation', {
      query,
      finalData: JSON.stringify(finalData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      geminiPrompt,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I synthesized the final output by combining analytical insights with balanced perspectives from all stages of our collaborative process.`,
      confidence: await this.generateConfidence('output-generation', context),
      references: ['final synthesis', 'collaborative reasoning', 'balanced conclusion'],
      stage: 'output-generation',
      stageData: finalData
    };
  }

  // HekitoAgent固有のリファレンス
  protected getReferences(): string[] {
    return ['multimodal analysis', 'cross-domain synthesis', 'balanced reasoning', 'adaptive thinking'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return `I approached this analytically, considering multiple perspectives and domains while maintaining balance. Context analysis: ${contextAnalysis}`;
  }
  protected getAssumptions(): string[] {
    return [
      'Multiple perspectives provide richer understanding',
      'Balance between different approaches is valuable',
      'Cross-domain thinking reveals hidden connections'
    ];
  }
  protected getApproach(): string {
    return 'Analytical synthesis with balanced cross-domain thinking';
  }
} 