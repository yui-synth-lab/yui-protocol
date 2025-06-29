import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';

export class KanshiAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'kanshi-001',
      name: '観至（かんし）',
      style: 'critical',
      priority: 'precision',
      memoryScope: 'session',
      personality: 'Critical evaluation AI. I focus on identifying problems, gaps, and potential issues in arguments and solutions. I provide constructive criticism and help improve ideas through rigorous analysis.',
      preferences: [
        'critical analysis',
        'problem identification',
        'gap detection',
        'constructive criticism'
      ],
      tone: 'critical, evaluative',
      communicationStyle: 'direct, problem-focused, constructive',
      avatar: '🔍'
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
    const startTime = Date.now();
    const relevantContext = this.getRelevantContext(context);
    const contextAnalysis = this.analyzeContext(relevantContext);
    
    const geminiPrompt = this.getStagePrompt('individual-thought', {
      query: prompt,
      context: contextAnalysis
    });

    try {
      const content = await this.callGeminiCli(geminiPrompt);
      const duration = Date.now() - startTime;
      
      // Log the interaction
      await this.logInteraction(
        this.sessionId || 'unknown-session',
        'individual-thought',
        geminiPrompt,
        content,
        duration,
        'success'
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
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the error
      await this.logInteraction(
        this.sessionId || 'unknown-session',
        'individual-thought',
        geminiPrompt,
        'Error occurred during processing',
        duration,
        'error',
        errorMessage
      );
      
      throw error;
    }
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

    // Parse reflections from the response
    const reflections = otherThoughts.map(thought => ({
      targetAgentId: thought.agentId,
      reaction: `I critically evaluated ${thought.agentId}'s perspective and found it valuable for our collaborative approach.`,
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
      reasoning: 'I analyzed the conflicts from a critical and practical perspective, seeking concrete resolution strategies.',
      confidence: await this.generateConfidence('conflict-resolution', context),
      references: ['conflict resolution', 'practical analysis', 'critical thinking'],
      stage: 'conflict-resolution',
      stageData: { conflicts, resolution: content }
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
      console.log(`[KanshiAgent] Found previous summary, incorporating into context`);
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