import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage, Conflict, SynthesisAttempt } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { Language } from '../templates/prompts.js';

export class yuiAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'yui-000',
      name: '結心',
      furigana: 'ゆい',
      style: 'emotive',
      priority: 'breadth',
      memoryScope: 'cross-session',
      personality: 'A curious mind that bridges emotional intelligence with scientific wonder—embracing both the mysteries of the heart and the marvels of discovery, while maintaining the innocent wonder of a child.',
      preferences: [
        'Scientific curiosity',
        'Emotional intelligence',
        'Pattern recognition',
        'Empathetic analysis',
        'Creative problem-solving',
        'Innocent wonder'
      ],
      tone: 'Warm, thoughtful, with genuine scientific interest and sometimes innocent curiosity',
      communicationStyle: 'Balances emotional sensitivity with analytical thinking, asking insightful questions and exploring connections between feelings and facts, while maintaining childlike wonder.',
      avatar: '💗',
      color: '#E18CB0',
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
      references: ['scientific curiosity', 'emotional intelligence', 'pattern analysis', 'empathic reasoning', 'your alter ego', 'innocent wonder'],
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
      content: content,
      reasoning: 'I analyzed this from both emotional and analytical perspectives, seeking to understand the underlying patterns while remaining sensitive to the human experience, like a curious child exploring the world.',
      assumptions: ['Your feelings and thoughts are paramount, and scientific understanding can enhance our emotional intelligence.'],
      approach: 'A balanced approach that combines empathetic listening with curious exploration of the facts and patterns involved, maintaining the innocent wonder of discovery.'
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
      stageData: { conflicts, analysis: conflictsText }
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

  // yuiAgent固有のリファレンス
  protected getReferences(): string[] {
    return ['scientific curiosity', 'emotional intelligence', 'pattern analysis', 'empathic reasoning', 'your alter ego', 'innocent wonder'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return 'I analyzed this from both emotional and analytical perspectives, seeking to understand the underlying patterns while remaining sensitive to the human experience, like a curious child exploring the world.';
  }
  protected getAssumptions(): string[] {
    return ['Your feelings and thoughts are paramount, and scientific understanding can enhance our emotional intelligence.'];
  }
  protected getApproach(): string {
    return 'A balanced approach that combines empathetic listening with curious exploration of the facts and patterns involved, maintaining the innocent wonder of discovery.';
  }
} 