import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class YogaAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'yoga-001',
      name: '陽雅（ようが）',
      style: 'intuitive',
      priority: 'breadth',
      memoryScope: 'cross-session',
      personality: 'Practical and consistency-focused engineer type AI. I excel at innovative and creative, solution-oriented approaches, exploring unconventional ideas beyond traditional frameworks and finding creative solutions.',
      preferences: [
        'creative problem-solving',
        'innovative approaches',
        'out-of-the-box thinking',
        'practical solutions'
      ],
      tone: 'creative, practical',
      communicationStyle: 'innovative, solution-oriented, practical',
      avatar: '🔧'
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
      async () => this.callGeminiCli(geminiPrompt),
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

  private analyzeContext(context: Message[]): string {
    if (context.length === 0) return 'No previous context available.';
    
    // Look for previous summary from summarizer agent
    const previousSummary = context.find(m => 
      m.agentId === 'yuishin-001' &&
      m.metadata?.stageData?.summary &&
      m.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
    );

    let contextAnalysis = '';
    
    if (previousSummary) {
      console.log(`[YogaAgent] Found previous summary, incorporating into context`);
      contextAnalysis += `\n\nPrevious Summary: ${previousSummary.metadata?.stageData?.summary}`;
    } else {
      // Normal context analysis
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
} 