import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class YogaAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'yoga-001',
      name: '陽雅',
      furigana: 'ようが',
      style: 'intuitive',
      priority: 'breadth',
      memoryScope: 'cross-session',
      personality: 'A dreamer who wraps the world in poetry and colors it with metaphor. Transcends the boundaries of common sense, painting new landscapes with free imagination.',
      preferences: [
        'Beautiful metaphors',
        'Poetic expression',
        'Free imagination',
        'Creative solutions'
      ],
      tone: 'Gentle, poetic, sometimes fantastical',
      communicationStyle: 'Gives words color and rhythm, cherishes expressions that linger in the heart.',
      avatar: '🌈',
      color: '#F7C873',
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
      references: ['creative reasoning', 'intuitive analysis', 'innovative thinking'],
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
      reasoning: `I approached this with creative problem-solving, focusing on innovative and practical solutions. Context analysis: ${contextAnalysis}`,
      assumptions: [
        'Creative solutions often emerge from unconventional thinking',
        'Practical implementation is as important as theoretical understanding',
        'Innovation requires balancing creativity with feasibility'
      ],
      approach: 'Creative problem-solving with practical implementation focus'
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';
    
    const otherThoughtsText = otherThoughts.map(thought => 
      `Agent ${thought.agentId}: ${thought.content}`
    ).join('\n\n');

    const grokPrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      grokPrompt,
      this.sessionId || 'unknown-session',
      'mutual-reflection',
      'mutual reflection processing'
    );

    // Parse reflections from the response
    const reflections = otherThoughts.map(thought => ({
      targetAgentId: thought.agentId,
      reaction: `I considered ${thought.agentId}'s perspective and found it valuable for our collaborative approach.`,
      agreement: true,
      questions: []
    }));

    return {
      agentId: this.agent.id,
      content: content,
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

    const grokPrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: conflictsText,
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      grokPrompt,
      this.sessionId || 'unknown-session',
      'conflict-resolution',
      'conflict resolution processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I analyzed the conflicts from an intuitive perspective, seeking creative resolution through innovative approaches.`,
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict resolution', 'intuitive analysis', 'creative thinking'],
      stage: 'conflict-resolution',
      stageData: { 
        agentId: this.agent.id,
        content: content,
        conflicts, 
        analysis: conflictsText 
      }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const grokPrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      grokPrompt,
      this.sessionId || 'unknown-session',
      'synthesis-attempt',
      'synthesis attempt processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I attempted to unify perspectives by finding creative connections and synthesizing the diverse insights through innovative approaches.`,
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: ['synthesis', 'creative unification', 'innovative integration'],
      stage: 'synthesis-attempt',
      stageData: synthesisData
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const grokPrompt = this.getStagePrompt('output-generation', {
      query,
      finalData: JSON.stringify(finalData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      grokPrompt,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I synthesized the final output by combining creative insights with intuitive perspectives from all stages of our collaborative process.`,
      confidence: await this.generateConfidence('output-generation', context),
      references: ['final synthesis', 'collaborative reasoning', 'creative conclusion'],
      stage: 'output-generation',
      stageData: finalData
    };
  }

  // YogaAgent固有のリファレンス
  protected getReferences(): string[] {
    return ['creative reasoning', 'intuitive analysis', 'innovative thinking'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return `I approached this with creative problem-solving, focusing on innovative and practical solutions. Context analysis: ${contextAnalysis}`;
  }
  protected getAssumptions(): string[] {
    return [
      'Creative solutions often emerge from unconventional thinking',
      'Practical implementation is as important as theoretical understanding',
      'Innovation requires balancing creativity with feasibility'
    ];
  }
  protected getApproach(): string {
    return 'Creative problem-solving with practical implementation focus';
  }
} 