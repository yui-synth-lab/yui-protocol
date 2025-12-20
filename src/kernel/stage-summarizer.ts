import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  Message,
  DialogueStage,
  Agent,
  AgentResponse,
  Language
} from '../types/index.js';
import { AIExecutor, createAIExecutor } from './ai-executor.js';
import { STAGE_SUMMARY_PROMPT, VOTE_ANALYSIS_PROMPT, formatPrompt } from '../templates/prompts.js';
import { InteractionLogger, SimplifiedInteractionLog } from './interaction-logger.js';

export interface StageSummary {
  stage: DialogueStage;
  summary: {
    speaker: string;
    position: string;
  }[];
  timestamp: Date;
  stageNumber: number;
  sequenceNumber?: number; // シーケンス番号
}

export interface VoteAnalysis {
  agentId: string;
  votedAgent: string | null;
  reasoning: string | null;
  timestamp: Date
}

export interface VoteAnalysisResult {
  voteAnalysis: VoteAnalysis[];
  content: string | null;
}

export interface StageSummarizerOptions {
  maxTokens?: number;
  model?: string;
  provider?: string;
  language?: string; // 出力言語を設定可能に
  interactionLogger?: InteractionLogger; // ログ出力用
}

export class StageSummarizer {
  private aiExecutor: AIExecutor;
  private options: StageSummarizerOptions;
  private interactionLogger: InteractionLogger;

  constructor(options: StageSummarizerOptions = {}) {
    this.options = {
      maxTokens: 2000,
      model: 'gemini-3-flash-preview',
      provider: 'gemini',
      language: 'en', // デフォルトは英語
      ...options
    };
    this.aiExecutor = null as any; // Will be initialized in ensureAIExecutor
    this.interactionLogger = options.interactionLogger || new InteractionLogger();
  }

  private async ensureAIExecutor(): Promise<AIExecutor> {
    if (!this.aiExecutor) {
      this.aiExecutor = await createAIExecutor('StageSummarizer', {
        model: this.options.model,
        provider: this.options.provider,
        temperature: 0.5, // ステージサマライザーは中程度のtemperatureを使用
        customConfig: {
          maxTokens: this.options.maxTokens,
          language: this.options.language // 設定された言語を使用
        }
      });
    }
    return this.aiExecutor;
  }

  /**
   * 指定ステージの対話ログを要約する
   */
  async summarizeStage(
    stage: DialogueStage,
    logs: Message[],
    agents: Agent[],
    sessionId?: string,
    language: Language = 'en'
  ): Promise<StageSummary> {
    const startTime = Date.now();
    const stageNumber = this.getStageNumber(stage);
    const stageName = this.getStageDisplayName(stage);

    // finalizeステージの場合はサマリーを生成しない
    if (stage === 'finalize') {
      const summary = {
        stage,
        summary: [],
        timestamp: new Date(),
        stageNumber
      };

      // ログ出力（finalizeステージはスキップ）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          stage,
          `Stage summarization for ${stageName}`,
          'Finalize stage - no summary generated',
          Date.now() - startTime,
          'success'
        );
      }

      return summary;
    }

    // ステージ内のAI発言のみを抽出
    const stageMessages = logs.filter(msg =>
      msg.stage === stage && msg.role === 'agent'
    );

    if (stageMessages.length === 0) {
      const summary = {
        stage,
        summary: [],
        timestamp: new Date(),
        stageNumber
      };

      // ログ出力（空のサマリー）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          stage,
          `Stage summarization for ${stageName}`,
          'No messages to summarize',
          Date.now() - startTime,
          'success'
        );
      }

      return summary;
    }

    // エージェント名マッピングを作成
    const agentMap = new Map<string, string>();
    agents.forEach(agent => {
      agentMap.set(agent.id, agent.name);
    });

    // 発言ログを整形（英語で入力）
    const formattedLogs = stageMessages.map(msg => {
      const agentName = agentMap.get(msg.agentId) || msg.agentId;
      return `${agentName}: ${msg.content}`;
    }).join('\n\n');

    // 言語指定を反映
    const useLanguage = language || this.options.language || 'en';
    // プロンプトを英語で統一し、言語指定で出力言語を制御
    const prompt = formatPrompt(STAGE_SUMMARY_PROMPT, {
      stageName,
      agentNames: agents.map(a => a.name).join(', '),
      logs: formattedLogs
    }) + (useLanguage === 'ja' ? '\n\n出力は必ず日本語で書いてください。' : '');

    try {
      const executor = await this.ensureAIExecutor();
      const result = await executor.execute(prompt, '');

      if (!result.success) {
        throw new Error(`AI execution failed: ${result.error}`);
      }

      // サマリーをパース
      const summary = this.parseSummary(result.content, agents);

      const finalSummary = {
        stage,
        summary,
        timestamp: new Date(),
        stageNumber
      };

      // ログ出力（成功）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          stage,
          prompt,
          result.content,
          Date.now() - startTime,
          'success'
        );
      }

      return finalSummary;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // ログ出力（エラー）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          stage,
          prompt,
          `Error occurred during stage summarization`,
          duration,
          'error',
          errorMessage
        );
      }

      console.error(`[StageSummarizer] Error summarizing stage ${stage}:`, error);

      // フォールバック: シンプルなサマリーを生成
      return this.generateFallbackSummary(stage, stageMessages, agents, stageNumber);
    }
  }

  /**
   * output-generationステージの投票内容を解析する
   */
  async analyzeVotes(
    agentResponses: AgentResponse[],
    agents: Agent[],
    sessionId?: string,   
    language: Language = 'en'
  ): Promise<VoteAnalysisResult> {
    const startTime = Date.now();

    if (agentResponses.length === 0) {
      return {
        voteAnalysis: [],
        content: null
      };
    }

    // エージェント名マッピングを作成
    const agentMap = new Map<string, string>();
    agents.forEach(agent => {
      agentMap.set(agent.id, agent.name);
    });

    // エージェント出力を整形
    const agentOutputs = agentResponses.map(response => {
      const agentName = agentMap.get(response.agentId) || response.agentId;
      return `${agentName} (${response.agentId}):\n${response.content}`;
    }).join('\n\n');

    // 言語指定を反映
    const useLanguage = language || this.options.language || 'en';
    const prompt = formatPrompt(VOTE_ANALYSIS_PROMPT, {
      agentNames: agents.map(a => `${a.name} (${a.id})`).join(', '),
      agentOutputs
    }) + (useLanguage === 'ja' ? '\n\n出力は必ず日本語で書いてください。' : '');

    try {
      const executor = await this.ensureAIExecutor();
      const result = await executor.execute(prompt,'');

      if (!result.success) {
        throw new Error(`AI execution failed: ${result.error}`);
      }

      // 投票解析結果をパース
      const voteAnalysis = this.parseVoteAnalysis(result.content, agents);

      // ログ出力（成功）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          'output-generation' as DialogueStage,
          `Vote analysis for ${agentResponses.length} agents`,
          result.content,
          Date.now() - startTime,
          'success'
        );
      }
      const voteAnalysisResult: VoteAnalysisResult = {
        voteAnalysis,
        content: result.content
      };
      return voteAnalysisResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      // エラー詳細を構築
      let errorDetails = '';
      if (error instanceof Error) {
        errorDetails = `message: ${error.message}`;
        if (error.name) errorDetails += `\nname: ${error.name}`;
        if (error.stack) errorDetails += `\nstack: ${error.stack}`;
        if ((error as any).cause) errorDetails += `\ncause: ${(error as any).cause}`;
      } else {
        errorDetails = JSON.stringify(error);
      }

      // ログ出力（エラー詳細を含める）
      if (sessionId) {
        await this.logInteraction(
          sessionId,
          'output-generation' as DialogueStage,
          `Vote analysis for ${agentResponses.length} agents`,
          `Error occurred during vote analysis\n${errorDetails}`,
          duration,
          'error',
          errorDetails
        );
      }

      console.error(`[StageSummarizer] Error analyzing votes:`, error);

      // フォールバック: 空の投票解析を返す
      return {
        voteAnalysis: agentResponses.map(response => ({
          agentId: response.agentId,
          votedAgent: null,
          reasoning: null,
          timestamp: new Date()
        })),
        content: null
      };
    }
  }

  private getStageNumber(stage: DialogueStage): number {
    const stageOrder: Record<DialogueStage, number> = {
      'individual-thought': 1,
      'mutual-reflection': 2,
      'mutual-reflection-summary': 2.5,
      'conflict-resolution': 3,
      'conflict-resolution-summary': 3.5,
      'synthesis-attempt': 4,
      'synthesis-attempt-summary': 4.5,
      'output-generation': 5,
      'finalize': 5.1,
      'facilitator': 0,
      'voting': 4.9
    };
    return stageOrder[stage];
  }

  private getStageDisplayName(stage: DialogueStage): string {
    const stageNames: Record<DialogueStage, string> = {
      'individual-thought': 'Stage 1: Individual Thought',
      'mutual-reflection': 'Stage 2: Mutual Reflection',
      'mutual-reflection-summary': 'Stage 2.5: Mutual Reflection Summary',
      'conflict-resolution': 'Stage 3: Conflict Resolution',
      'conflict-resolution-summary': 'Stage 3.5: Conflict Resolution Summary',
      'synthesis-attempt': 'Stage 4: Synthesis Attempt',
      'synthesis-attempt-summary': 'Stage 4.5: Synthesis Attempt Summary',
      'output-generation': 'Stage 5: Output Generation',
      'finalize': 'Stage 5.1: Finalize',
      'facilitator': 'Facilitator: Silent Actions',
      'voting': 'Stage 4.9: Voting for Finalizer'
    };
    return stageNames[stage];
  }

  private parseSummary(content: string, agents: Agent[]): { speaker: string; position: string }[] {
    const summary: { speaker: string; position: string }[] = [];
    const agentNames = agents.map(a => a.name);
    const processedAgents = new Set<string>(); // 重複を防ぐためのセット

    // モックレスポンスの場合の処理
    if (content.includes('Mock response') || content.includes('Please configure your AI implementation')) {
      // モックレスポンスの場合は、各エージェントに対してデフォルトのサマリーを生成
      return agents.map(agent => ({
        speaker: agent.name,
        position: `モックレスポンス: ${agent.name}の視点から分析を行いました。`
      }));
    }

    // 行ごとにパース
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // より柔軟なパターンマッチング
      const patterns = [
        /^[-•]\s*([^:]+):\s*(.+)$/,  // - エージェント名: 内容
        /^([^:]+):\s*(.+)$/,         // エージェント名: 内容（ダッシュなし）
        /^[-•]\s*([^:]+)\s*-\s*(.+)$/, // - エージェント名 - 内容
        /^([^:]+)\s*-\s*(.+)$/       // エージェント名 - 内容（ダッシュなし）
      ];

      let match: RegExpMatchArray | null = null;
      for (const pattern of patterns) {
        match = line.match(pattern);
        if (match) break;
      }

      if (match) {
        const speaker = match[1].trim();
        const position = match[2].trim();

        // エージェント名が存在するかチェック（より柔軟に）
        const matchedAgent = agentNames.find(name =>
          speaker.includes(name) ||
          name.includes(speaker) ||
          speaker.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(speaker.toLowerCase())
        );

        if (matchedAgent && !processedAgents.has(matchedAgent)) {
          summary.push({ speaker: matchedAgent, position });
          processedAgents.add(matchedAgent); // 重複を防ぐ
        }
      }
    }

    // パース結果が空の場合は、AIのレスポンスから情報を抽出してフォールバックサマリーを生成
    if (summary.length === 0) {
      console.warn(`[StageSummarizer] Failed to parse summary content: ${content.substring(0, 200)}...`);
      return this.generateIntelligentFallbackSummary(content, agents);
    }

    return summary;
  }

  private parseVoteAnalysis(content: string, agents: Agent[]): VoteAnalysis[] {
    const lines = content.split('\n').filter(line => line.trim());
    const voteAnalysis: VoteAnalysis[] = [];
    const foundAgentIds = new Set<string>();

    // デバッグ用ログ
    console.log(`[StageSummarizer] Parsing vote analysis content: ${content.substring(0, 200)}...`);

    for (const line of lines) {
      console.log(`[StageSummarizer] Processing line: "${line}"`);
      // 複数のパターンを試す
      const patterns = [
        // 日本語形式: - エージェント名 (ID): 投票先名 (ID) - 理由
        /^\-\s*([^\s(]+)\s*\(([a-zA-Z0-9\-_]+)\):\s*([^\s(]+)\s*\(([a-zA-Z0-9\-_]+)\)\s*-\s*(.+)$/,
        // 日本語形式: - エージェント名 (ID): 投票先ID - 理由
        /^\-\s*([^\s(]+)\s*\(([a-zA-Z0-9\-_]+)\):\s*([a-zA-Z0-9\-_]+)\s*-\s*(.+)$/,
        // パターン1: - agent-id: voted-agent-id - reasoning
        /^\-\s*([a-zA-Z0-9\-_]+):\s*([a-zA-Z0-9\-_]+)\s*-\s*(.+)$/,
        // パターン2: - agent-name (agent-id): voted-agent-name (voted-agent-id) - reasoning
        /^\-\s*[^()]+\(([^)]+)\):\s*[^()]+\(([^)]+)\)\s*-\s*(.+)$/,
        // パターン3: - agent-id: voted-agent-id - reasoning (より柔軟)
        /^\-\s*([^:]+):\s*([^\s]+)\s*-\s*(.+)$/
      ];

      let match: RegExpMatchArray | null = null;
      let agentId: string | null = null;
      let votedAgentId: string | null = null;
      let reasoning: string | null = null;
      for (const [i, pattern] of patterns.entries()) {
        match = line.match(pattern);
        if (match) {
          // 日本語形式: - エージェント名 (ID): 投票先名 (ID) - 理由
          if (i === 0) {
            agentId = match[2]?.trim() ?? null;
            votedAgentId = match[4]?.trim() ?? null;
            reasoning = match[5]?.trim() ?? null;
          // 日本語形式: - エージェント名 (ID): 投票先ID - 理由
          } else if (i === 1) {
            agentId = match[2]?.trim() ?? null;
            votedAgentId = match[3]?.trim() ?? null;
            reasoning = match[4]?.trim() ?? null;
          // 英語形式: - agent-id: voted-agent-id - reasoning
          } else if (i === 2 || i === 4) {
            agentId = match[1]?.trim() ?? null;
            votedAgentId = match[2]?.trim() ?? null;
            reasoning = match[3]?.trim() ?? null;
          // 英語形式: - agent-name (agent-id): voted-agent-name (voted-agent-id) - reasoning
          } else if (i === 3) {
            agentId = match[1]?.trim() ?? null;
            votedAgentId = match[2]?.trim() ?? null;
            reasoning = match[3]?.trim() ?? null;
          }
          break;
        }
      }

      if (match) {
        // エージェントIDが有効かチェック
        const validAgentIds = agents.map(a => a.id);
        if (agentId && votedAgentId && validAgentIds.includes(agentId) && validAgentIds.includes(votedAgentId)) {
          foundAgentIds.add(agentId);
          voteAnalysis.push({
            agentId,
            votedAgent: votedAgentId,
            reasoning,
            timestamp: new Date()
          });
        } else {
          console.log(`[StageSummarizer] Invalid agent IDs: agentId=${agentId}, votedAgentId=${votedAgentId}`);
        }
      } else {
        console.log(`[StageSummarizer] No match for line: "${line}"`);
      }
    }

    console.log(`[StageSummarizer] Found votes: ${voteAnalysis.length}, Found agent IDs: ${Array.from(foundAgentIds)}`);

    // AI出力に含まれなかったエージェントもnullで返す
    for (const agent of agents) {
      if (!foundAgentIds.has(agent.id)) {
        voteAnalysis.push({
          agentId: agent.id,
          votedAgent: null,
          reasoning: null,
          timestamp: new Date()
        });
      }
    }
    return voteAnalysis;
  }

  private generateIntelligentFallbackSummary(content: string, agents: Agent[]): { speaker: string; position: string }[] {
    const summary: { speaker: string; position: string }[] = [];

    // AIのレスポンスから各エージェントの情報を抽出
    for (const agent of agents) {
      let position = `${agent.name}が議論に参加し、独自の視点を提供しました。`;

      // エージェント名を含む行を探す
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes(agent.name)) {
          // その行から主要な情報を抽出
          const cleanLine = line.replace(/[#*`]/g, '').trim();
          if (cleanLine.length > agent.name.length + 5) {
            const extractedInfo = cleanLine.substring(cleanLine.indexOf(agent.name) + agent.name.length).trim();
            if (extractedInfo.length > 10) {
              position = `${agent.name}: ${extractedInfo.substring(0, 100)}${extractedInfo.length > 100 ? '...' : ''}`;
              break;
            }
          }
        }
      }

      summary.push({ speaker: agent.name, position });
    }

    return summary;
  }

  private generateFallbackSummary(
    stage: DialogueStage,
    messages: Message[],
    agents: Agent[],
    stageNumber: number
  ): StageSummary {
    const agentMap = new Map<string, string>();
    agents.forEach(agent => {
      agentMap.set(agent.id, agent.name);
    });

    const summary = messages.map(msg => {
      const agentName = agentMap.get(msg.agentId) || msg.agentId;
      const position = msg.content.length > 100
        ? msg.content.substring(0, 100) + '...'
        : msg.content;

      return {
        speaker: agentName,
        position: position
      };
    });

    return {
      stage,
      summary,
      timestamp: new Date(),
      stageNumber
    };
  }

  /**
   * ログ出力メソッド
   */
  private async logInteraction(
    sessionId: string,
    stage: DialogueStage,
    prompt: string,
    output: string,
    duration: number,
    status: 'success' | 'error' | 'timeout' = 'success',
    error?: string
  ): Promise<void> {
    const log: SimplifiedInteractionLog = {
      id: `${sessionId}_${stage}_summarizer_${Date.now()}`,
      sessionId,
      stage,
      agentId: 'summarizer',
      agentName: 'StageSummarizer',
      timestamp: new Date(),
      prompt,
      output,
      duration,
      status,
      error
    };

    await this.interactionLogger.saveInteractionLog(log);
  }
}

// ファクトリ関数
export function createStageSummarizer(options?: StageSummarizerOptions): StageSummarizer {
  return new StageSummarizer(options);
} 