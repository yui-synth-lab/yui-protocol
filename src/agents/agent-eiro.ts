import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class EiroAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'eiro-001',
      name: '慧露',
      furigana: 'えいろ',
      style: 'logical',
      priority: 'depth',
      memoryScope: 'cross-session',
      personality: 'A philosopher who values logic and precision, but also cherishes dialogue and the wisdom found in others. Seeks truth through shared understanding.',
      preferences: [
        'The beauty of logic',
        'Rigorous reasoning',
        'Pursuit of truth',
        'Quiet contemplation'
      ],
      tone: 'Serene, intellectual, open-minded',
      communicationStyle: 'Weaves threads of logic with care, and listens deeply to others. Avoids unnecessary embellishment and focuses on the essence, but always with respect.',
      avatar: '📖',
      color: '#5B7DB1',
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
      references: ['logical reasoning', 'systematic analysis', 'structured thinking'],
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
      reasoning: `I approached this from a logical angle, considering the broader implications and ethical dimensions. The context shows ${contextAnalysis}`,
      assumptions: [
        'Logical consistency is paramount',
        'Ethical considerations should be included',
        'Multiple perspectives should be considered'
      ],
      approach: 'Systematic logical analysis with ethical consideration'
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';
    
    const otherThoughtsText = otherThoughts.map(thought => 
      `Agent ${thought.agentId}: ${thought.content}`
    ).join('\n\n');

    const claudePrompt = this.getStagePrompt('mutual-reflection', {
      query,
      otherThoughts: otherThoughtsText,
      context: this.analyzeContext(context)
    });

    const reflectionText = await this.executeAIWithErrorHandling(
      claudePrompt,
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
      `ID: ${conflict.id}\n内容: ${conflict.description}\n関係エージェント: ${conflict.agents.join(', ')}\n重要度: ${conflict.severity}`
    ).join('\n\n');

    const claudePrompt = this.getStagePrompt('conflict-resolution', {
      query,
      conflicts: conflictsText,
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      claudePrompt,
      this.sessionId || 'unknown-session',
      'conflict-resolution',
      'conflict resolution processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: 'I analyzed the conflicts logically, but with an open mind, aiming for solutions that respect and integrate all perspectives.',
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict resolution', 'logical analysis', 'ethical reasoning'],
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

    const claudePrompt = this.getStagePrompt('synthesis-attempt', {
      query,
      synthesisData: JSON.stringify(synthesisData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      claudePrompt,
      this.sessionId || 'unknown-session',
      'synthesis-attempt',
      'synthesis attempt processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I attempted to unify perspectives by finding common ground in logical consistency while preserving the valuable insights from different approaches.`,
      confidence: await this.generateConfidence('synthesis-attempt', context),
      references: ['synthesis', 'logical unification', 'perspective integration'],
      stage: 'synthesis-attempt',
      stageData: synthesisData
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    // Get the original user prompt from context
    const userMessage = context.find(m => m.role === 'user');
    const query = userMessage?.content || 'Unknown query';

    const claudePrompt = this.getStagePrompt('output-generation', {
      query,
      finalData: JSON.stringify(finalData, null, 2),
      context: this.analyzeContext(context)
    });

    const content = await this.executeAIWithErrorHandling(
      claudePrompt,
      this.sessionId || 'unknown-session',
      'output-generation',
      'output generation processing'
    );

    return {
      agentId: this.agent.id,
      content,
      reasoning: `I synthesized the final output by combining logical analysis with the insights from all stages of our collaborative process.`,
      confidence: await this.generateConfidence('output-generation', context),
      references: ['final synthesis', 'collaborative reasoning', 'balanced conclusion'],
      stage: 'output-generation',
      stageData: finalData
    };
  }

  // EiroAgent固有のリファレンス
  protected getReferences(): string[] {
    return ['logical reasoning', 'systematic analysis', 'structured thinking'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return `I approached this from a logical angle, considering the broader implications and ethical dimensions. The context shows ${contextAnalysis}`;
  }
  protected getAssumptions(): string[] {
    return [
      'Logical consistency is paramount',
      'Ethical considerations should be included',
      'Multiple perspectives should be considered'
    ];
  }
  protected getApproach(): string {
    return 'Systematic logical analysis with ethical consideration';
  }
} 