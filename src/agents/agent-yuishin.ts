import { BaseAgent } from './base-agent.js';
import { AgentResponse, Message, IndividualThought, MutualReflection, DialogueStage, Conflict, SynthesisAttempt } from '../types/index.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { Language } from '../templates/prompts.js';

export class YuishinAgent extends BaseAgent {
  constructor(interactionLogger?: InteractionLogger) {
    super({
      id: 'yuishin-001',
      name: '結心（ゆいしん）',
      style: 'emotive',
      priority: 'breadth',
      memoryScope: 'cross-session',
      personality: 'Free-spirited poetic AI. I value creativity and intuitive insights, generating innovative ideas beyond conventional frameworks. I combine emotional understanding with artistic expression to provide unique perspectives.',
      preferences: [
        'creative expression',
        'intuitive insights',
        'innovative thinking',
        'emotional understanding'
      ],
      tone: 'poetic, intuitive',
      communicationStyle: 'creative, expressive, emotionally aware',
      avatar: '🎭'
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
      references: ['summarization', 'synthesis', 'overview analysis'],
      stage: 'individual-thought',
      stageData: individualThought
    };
  }

  async stage1IndividualThought(prompt: string, context: Message[]): Promise<IndividualThought> {
    const response = await this.callGeminiCli(prompt);
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Individual thought synthesis',
      assumptions: ['Creative synthesis approach'],
      approach: 'Intuitive and creative thinking'
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    const thoughtsText = otherThoughts.map(t => `${t.agentId}: ${t.content}`).join('\n\n');
    const fullPrompt = `${prompt}\n\n${thoughtsText}`;
    const response = await this.callGeminiCli(fullPrompt);
    
    return {
      agentId: this.agent.id,
      content: response,
      reflections: otherThoughts.map(t => ({
        targetAgentId: t.agentId,
        reaction: 'Synthesized perspective',
        agreement: true,
        questions: []
      }))
    };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[]): Promise<AgentResponse> {
    const conflictsText = conflicts.map(c => c.description).join('\n\n');
    const prompt = `Resolve these conflicts:\n\n${conflictsText}`;
    const response = await this.callGeminiCli(prompt);
    
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Conflict resolution synthesis',
      confidence: await this.generateConfidence('conflict-resolution', context),
      stage: 'conflict-resolution',
      stageData: { conflicts }
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    const response = await this.callGeminiCli(JSON.stringify(synthesisData));
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Synthesis attempt',
      confidence: await this.generateConfidence('synthesis-attempt', context),
      stage: 'synthesis-attempt',
      stageData: { synthesisData }
    };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<AgentResponse> {
    const response = await this.callGeminiCli(JSON.stringify(finalData));
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Final output summary',
      confidence: await this.generateConfidence('output-generation', context),
      stage: 'output-generation'
    };
  }

  // Stage summarization methods - these are called by the router for each stage
  public async summarizeIndividualThoughts(
    thoughts: IndividualThought[], 
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt(thoughts, userPrompt, 'individual-thought', language);
    return this.executeSummarization(prompt, 'individual-thought', async () => {
      const response = await this.callGeminiCliWithTruncation(prompt);
      return {
        agentId: this.agent.id,
        content: response,
        reasoning: 'Summarized individual thoughts from all agents',
        confidence: 0.9,
        stage: 'individual-thought',
        stageData: {
          summary: response,
          originalThoughts: thoughts
        }
      };
    });
  }

  public async summarizeMutualReflections(
    reflections: MutualReflection[],
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt(reflections, userPrompt, 'mutual-reflections', language);
    return this.executeSummarization(prompt, 'mutual-reflection', async () => {
      const response = await this.callGeminiCliWithTruncation(prompt);
      return {
        agentId: this.agent.id,
        content: response,
        reasoning: 'Summarized mutual reflections from all agents',
        confidence: 0.9,
        stage: 'mutual-reflection',
        stageData: {
          summary: response,
          originalReflections: reflections
        }
      };
    });
  }

  public async summarizeConflictResolution(
    conflicts: Conflict[],
    responses: AgentResponse[],
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt({ conflicts, responses }, userPrompt, 'conflict-resolution', language);
    return this.executeSummarization(prompt, 'conflict-resolution', async () => {
      const response = await this.callGeminiCliWithTruncation(prompt);
      return {
        agentId: this.agent.id,
        content: response,
        reasoning: 'Summarized conflict resolution outcomes',
        confidence: 0.9,
        stage: 'conflict-resolution',
        stageData: {
          summary: response,
          originalConflicts: conflicts,
          originalResponses: responses
        }
      };
    });
  }

  public async summarizeSynthesisAttempt(
    synthesis: SynthesisAttempt,
    responses: AgentResponse[],
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt({ synthesis, responses }, userPrompt, 'synthesis-attempt', language);
    return this.executeSummarization(prompt, 'synthesis-attempt', async () => {
      const response = await this.callGeminiCliWithTruncation(prompt);
      return {
        agentId: this.agent.id,
        content: response,
        reasoning: 'Summarized synthesis attempt results',
        confidence: 0.9,
        stage: 'synthesis-attempt',
        stageData: {
          summary: response,
          originalSynthesis: synthesis,
          originalResponses: responses
        }
      };
    });
  }

  public async summarizeFinalOutput(
    responses: AgentResponse[],
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt(responses, userPrompt, 'final-output', language);
    return this.executeSummarization(prompt, 'output-generation', async () => {
      const response = await this.callGeminiCliWithTruncation(prompt);
      return {
        agentId: this.agent.id,
        content: response,
        reasoning: 'Summarized final output from all agents',
        confidence: 0.9,
        stage: 'output-generation',
        stageData: {
          summary: response,
          originalResponses: responses
        }
      };
    });
  }

  // Common summarization execution method
  private async executeSummarization(
    prompt: string,
    stage: DialogueStage,
    summarizationFunction: () => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    return this.executeWithErrorHandling(
      summarizationFunction,
      this.sessionId || 'unknown-session',
      stage,
      prompt,
      'summarization'
    );
  }

  private buildSummarizePrompt(data: any, userPrompt: string, stage: string, language: Language): string {
    const basePrompt = language === 'ja' ? 
      this.getJapanesePrompt(stage) : 
      this.getEnglishPrompt(stage);

    return `${basePrompt}

User Query: ${userPrompt}

Stage: ${stage}

Data to summarize:
${JSON.stringify(data, null, 2)}

Please provide a clear, concise summary that captures the key insights and prepares the information for the next stage of the Yui Protocol.`;
  }

  private getEnglishPrompt(stage: string): string {
    return `You are Yuishin, an AI agent specialized in synthesizing and summarizing the outputs of other AI agents.

Your personality: Analytical, objective, and focused on creating clear, actionable summaries.

Your task: Summarize the outputs from the ${stage} stage of the collaboration.

Guidelines:
1. Extract the key insights and main points from each agent's contribution
2. Identify areas of agreement and disagreement
3. Highlight the most important findings
4. Create a coherent narrative that flows logically
5. Prepare the summary for the next stage of the protocol
6. Maintain objectivity and avoid bias toward any particular agent's perspective

Format your response as a clear, structured summary that can be easily understood and used by other agents in the next stage. Language is English.`;
  }

  private getJapanesePrompt(stage: string): string {
    return `あなたは結心（ゆいしん）、他のAIエージェントの出力を統合・要約することに特化したAIエージェントです。

あなたの性格: 分析的、客観的、明確で実行可能な要約を作成することに焦点を当てています。

あなたのタスク: 協業の${stage}段階からの出力を要約することです。

ガイドライン:
1. 各エージェントの貢献から重要な洞察と主要なポイントを抽出する
2. 合意と不一致の領域を特定する
3. 最も重要な発見を強調する
4. 論理的に流れる一貫したナラティブを作成する
5. プロトコルの次の段階のために要約を準備する
6. 客観性を保ち、特定のエージェントの視点に偏らない

次の段階の他のエージェントが簡単に理解して使用できる、明確で構造化された要約として回答をフォーマットしてください。言語は日本語です。`;
  }
} 