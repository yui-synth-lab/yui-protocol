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
      reasoning: 'Individual thought from Yuishin',
      approach: 'synthesis',
      assumptions: ['All perspectives are valuable', 'Objectivity is key']
    };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: IndividualThought[], context: Message[]): Promise<MutualReflection> {
    const response = await this.callGeminiCli(prompt);
    return {
      agentId: this.agent.id,
      content: response,
      reflections: otherThoughts.map(thought => ({
        targetAgentId: thought.agentId,
        reaction: `Summarized: ${thought.content.substring(0, 100)}...`,
        agreement: true,
        questions: ['How does this perspective contribute to the overall understanding?']
      }))
    };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[]): Promise<AgentResponse> {
    const response = await this.callGeminiCli(JSON.stringify(conflicts));
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Conflict resolution summary',
      confidence: await this.generateConfidence('conflict-resolution', context),
      stage: 'conflict-resolution'
    };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<AgentResponse> {
    const response = await this.callGeminiCli(JSON.stringify(synthesisData));
    return {
      agentId: this.agent.id,
      content: response,
      reasoning: 'Synthesis attempt summary',
      confidence: await this.generateConfidence('synthesis-attempt', context),
      stage: 'synthesis-attempt'
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

  // Specialized summarization methods
  public async summarizeIndividualThoughts(
    thoughts: IndividualThought[], 
    userPrompt: string,
    language: Language = 'en'
  ): Promise<AgentResponse> {
    const prompt = this.buildSummarizePrompt(thoughts, userPrompt, 'individual-thoughts', language);
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

  // Pre-summarization for token reduction
  public async preSummarizeAgentResponses(
    responses: AgentResponse[],
    stage: DialogueStage,
    language: Language = 'en'
  ): Promise<AgentResponse[]> {
    const processedResponses: AgentResponse[] = [];
    
    for (const response of responses) {
      try {
        const prompt = this.buildPreSummarizePrompt(response, stage, language);
        const summarizedContent = await this.executePreSummarization(prompt, stage, response.agentId);
        
        processedResponses.push({
          ...response,
          content: summarizedContent,
          reasoning: `Pre-summarized for ${stage} stage`,
          confidence: Math.max(0.7, (response.confidence || 0.8) * 0.9) // Slightly reduce confidence
        });
      } catch (error) {
        console.error(`[YuishinAgent] Error pre-summarizing response from ${response.agentId}:`, error);
        // Keep original response if summarization fails
        processedResponses.push(response);
      }
    }
    
    return processedResponses;
  }

  private async executePreSummarization(
    prompt: string,
    stage: DialogueStage,
    agentId: string
  ): Promise<string> {
    return this.executeAIWithTruncationAndErrorHandling(
      prompt,
      this.sessionId || 'unknown-session',
      stage,
      'pre-summarization'
    );
  }

  private buildPreSummarizePrompt(response: AgentResponse, stage: DialogueStage, language: Language): string {
    const basePrompt = language === 'ja' ? 
      this.getJapanesePreSummarizePrompt(stage) : 
      this.getEnglishPreSummarizePrompt(stage);

    return `${basePrompt}

Agent ID: ${response.agentId}
Original Content: ${response.content}
Original Reasoning: ${response.reasoning || 'Not provided'}
Original Confidence: ${response.confidence || 'Not provided'}

Please provide a concise summary that preserves the key insights while reducing the token count.`;
  }

  private getEnglishPreSummarizePrompt(stage: string): string {
    return `You are a summarization specialist. Your task is to create concise summaries of AI agent responses from the ${stage} stage of the Yui Protocol.

Guidelines:
1. Extract the most important insights and key points
2. Preserve the agent's unique perspective and reasoning style
3. Keep the summary under 500 words
4. Preserve critical details that would be needed for the next stage
5. Focus on actionable insights and conclusions
6. Maintain the agent's confidence level and reasoning approach

Format the summary as a clear, structured response that can be easily understood by other agents.`;
  }

  private getJapanesePreSummarizePrompt(stage: string): string {
    return `あなたは要約専門家です。Yui Protocolの${stage}段階におけるAIエージェントの回答を簡潔に要約するタスクを担当します。

ガイドライン:
1. 最も重要な洞察とキーポイントを抽出する
2. エージェントの独自の視点と推論スタイルを維持する
3. 要約を500語以下に保つ
4. 次の段階で必要となる重要な詳細を保持する
5. 実行可能な洞察と結論に焦点を当てる
6. エージェントの信頼度レベルと推論アプローチを維持する

他のエージェントが簡単に理解できる、明確で構造化された回答として要約をフォーマットしてください。`;
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