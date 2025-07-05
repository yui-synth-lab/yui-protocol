import { v4 as uuidv4 } from 'uuid';
import { 
  Agent, 
  AgentInstance, 
  AgentResponse, 
  Session, 
  DialogueStage, 
  Language, 
  ProgressCallback,
  StageExecutionResult,
  DelayOptions,
  StageSummarizerOptions,
  Message,
  StageData,
  IndividualThought,
  Conflict,
  SynthesisData,
  FinalData,
  StageSummary,
  StageHistory,
  SynthesisAttempt
} from '../types/index.js';
import { 
  IRealtimeRouter, 
  IAgentManager, 
  ISessionManager
} from './interfaces.js';
import { SessionStorage } from './session-storage.js';
import { OutputStorage } from './output-storage.js';
import { InteractionLogger } from './interaction-logger.js';
import { createStageSummarizer } from './stage-summarizer.js';
import { AgentManager } from './services/agent-manager.js';
import { SessionManager } from './services/session-manager.js';

// ユーティリティ関数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper function to remove circular references
function removeCircularReferences(obj: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (seen.has(obj)) {
    return '[Circular Reference]';
  }
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => removeCircularReferences(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = removeCircularReferences((obj as Record<string, unknown>)[key], seen);
    }
  }
  return result;
}

// 投票先抽出関数
function extractVote(content: string, agents: Agent[]): string | null {
  const voteSectionMatch = content.match(/(?:まとめ役|Agent Vote|agent_vote)[^\n:：]*[:：]\s*([^\n]+)/i);
  let voteTarget = voteSectionMatch ? voteSectionMatch[1] : null;
  const boldMatch = content.match(/\*\*([a-zA-Z0-9-]+)\*\*/);
  if (boldMatch) {
    voteTarget = boldMatch[1];
  }
  for (const agent of agents) {
    const patterns = [
      agent.id,
      agent.name,
      agent.furigana,
      agent.name.replace(/[（(].*?[)）]/g, ''),
    ].filter(Boolean);
    for (const pat of patterns) {
      const regex = new RegExp(pat.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i');
      if (voteTarget && regex.test(voteTarget))
        return agent.id;
      if (regex.test(content))
        return agent.id;
    }
  }
  return null;
}

// 投票集計関数
function tallyVotes(responses: AgentResponse[], agents: Agent[]): string[] {
  const votes: Record<string, number> = {};
  for (const agent of agents) {
    votes[agent.id] = 0;
  }
  for (const res of responses) {
    const vote = extractVote(res.content, agents);
    if (vote && votes.hasOwnProperty(vote)) {
      votes[vote]++;
    }
  }
  const maxCount = Math.max(...Object.values(votes));
  if (maxCount === 0)
    return [];
  return Object.keys(votes).filter((id: string) => votes[id] === maxCount);
}

// Summarizer selection logic
function selectSummarizer(agents: Agent[], stage: DialogueStage, messages: Message[], agentResponses: AgentResponse[]): string {
  if (agentResponses && agentResponses.length > 0) {
    const votedList = tallyVotes(agentResponses, agents);
    if (votedList.length > 0) {
      for (const agent of agents) {
        if (votedList.includes(agent.id))
          return agent.id;
      }
    }
  }
  const agentIds = agents.filter((a: Agent) => a.id !== 'user').map((a: Agent) => a.id);
  const counts: Record<string, number> = {};
  for (const id of agentIds)
    counts[id] = 0;
  messages.slice(-20).forEach((m: Message) => {
    if (agentIds.includes(m.agentId))
      counts[m.agentId]++;
  });
  let maxId = agentIds[0];
  let maxCount = counts[maxId];
  for (const id of agentIds) {
    if (counts[id] > maxCount) {
      maxId = id;
      maxCount = counts[id];
    }
  }
  return maxId;
}

export class YuiProtocolRouter implements IRealtimeRouter {
  private agentManager: IAgentManager;
  private sessionManager: ISessionManager;
  private outputStorage: OutputStorage;
  private interactionLogger: InteractionLogger;
  private stageSummarizer: ReturnType<typeof createStageSummarizer>;
  private defaultLanguage: Language = 'en';
  private stageSummarizerDelayMS: number;
  private finalSummaryDelayMS: number;

  constructor(
    sessionStorage: SessionStorage,
    outputStorage: OutputStorage,
    interactionLogger: InteractionLogger,
    stageSummarizerOptions: StageSummarizerOptions,
    delayOptions: DelayOptions,
    agentManager?: IAgentManager,
    sessionManager?: ISessionManager
  ) {
    this.outputStorage = outputStorage || new OutputStorage();
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.stageSummarizer = createStageSummarizer(stageSummarizerOptions);
    this.stageSummarizerDelayMS = delayOptions?.stageSummarizerDelayMS ?? 30000;
    this.finalSummaryDelayMS = delayOptions?.finalSummaryDelayMS ?? 60000;

    // 依存性注入またはデフォルト作成
    this.agentManager = agentManager || new AgentManager(this.interactionLogger);
    this.sessionManager = sessionManager || new SessionManager(sessionStorage, this.agentManager);

    // エージェントの初期化
    this.agentManager.initializeAgents();
  }

  // IRealtimeRouter インターフェースの実装
  async executeStageRealtime(
    sessionId: string, 
    userPrompt: string, 
    stage: DialogueStage, 
    language: Language, 
    onProgress?: ProgressCallback
  ): Promise<StageExecutionResult> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const stageStart = new Date();
    session.currentStage = stage;
    session.updatedAt = new Date();

    // エージェントのセットアップ
    this.setupAgentsForStage(session, sessionId, language);

    // ユーザーメッセージの追加
    this.addUserMessageIfNeeded(session, userPrompt, stage);

    // 実際のエージェントレスポンス生成
    const { responses, agentResponses } = await this.generateAgentResponses(session, stage, userPrompt, '', [], onProgress);

    // ステージ履歴の更新
    await this.updateSessionStageHistory(session, stage, responses, stageStart);

    // セッションの保存
    await this.sessionManager.saveSession(session);

    // 最終出力の保存（必要に応じて）
    const isAllStagesCompleted = this.isAllStagesCompleted(session);
    await this.saveFinalOutputIfNeeded(isAllStagesCompleted, responses, session, sessionId, language);

    const stageEnd = new Date();
    const duration = stageEnd.getTime() - stageStart.getTime();

    return {
      stage,
      agentResponses,
      duration
    };
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.sessionManager.getSession(sessionId);
  }

  async getAllSessions(): Promise<Session[]> {
    return this.sessionManager.getAllSessions();
  }

  async createSession(title: string, agentIds: string[], language: Language): Promise<Session> {
    return this.sessionManager.createSession(title, agentIds, language);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.deleteSession(sessionId);
  }

  async resetSession(sessionId: string): Promise<Session> {
    return this.sessionManager.resetSession(sessionId);
  }

  async startNewSequence(sessionId: string): Promise<Session> {
    return this.sessionManager.startNewSequence(sessionId);
  }

  getAvailableAgents(): Agent[] {
    return this.agentManager.getAvailableAgents();
  }

  setDefaultLanguage(language: Language): void {
    this.defaultLanguage = language;
  }

  getDefaultLanguage(): Language {
    return this.defaultLanguage;
  }

  // 既存コードとの互換性のためのラッパーメソッド
  async saveSession(session: Session): Promise<void> {
    await this.sessionManager.saveSession(session);
  }

  // 完全移植されたメソッド群
  private setupAgentsForStage(session: Session, sessionId: string, language?: Language): void {
    if (language) {
      for (const agent of session.agents) {
        const agentInstance = this.agentManager.getAgent(agent.id);
        if (agentInstance) {
          agentInstance.setLanguage(language);
          agentInstance.setSessionId(sessionId);
        }
      }
    } else {
      for (const agent of session.agents) {
        const agentInstance = this.agentManager.getAgent(agent.id);
        if (agentInstance) {
          agentInstance.setSessionId(sessionId);
        }
      }
    }
  }

  private addUserMessageIfNeeded(session: Session, userPrompt: string, stage: DialogueStage): void {
    const existingUserMessage = session.messages.find((m: Message) => m.role === 'user' && m.sequenceNumber === (session.sequenceNumber || 1));
    if (!existingUserMessage) {
      const userMessage: Message = {
        id: uuidv4(),
        agentId: 'user',
        content: userPrompt,
        timestamp: new Date(),
        role: 'user',
        sequenceNumber: session.sequenceNumber || 1
      };
      session.messages.push(userMessage);
      session.updatedAt = new Date();
    }
  }

  private async generateAgentResponses(
    session: Session,
    stage: DialogueStage,
    userPrompt: string,
    agentDescriptions: string,
    context: Message[],
    onProgress?: ProgressCallback
  ): Promise<{ responses: AgentResponse[]; agentResponses: AgentResponse[] }> {
    // 前のステージのサマリーを取得
    const previousStageSummaries = this.getPreviousStageSummaries(session, stage);
    let summaryContext = previousStageSummaries.length > 0
      ? `\n\n前ステージの要約：\n${this.stageSummarizer.formatSummaryForPrompt(previousStageSummaries)}`
      : '';
    
    // 新規シーケンス開始時はoutput-generationサマリーも追加
    if ((session.sequenceNumber || 1) > 1) {
      const outputGenSummary = session.stageSummaries?.find((s: StageSummary) => s.stage === 'output-generation' && s.sequenceNumber === (session.sequenceNumber || 1) - 1);
      if (outputGenSummary) {
        summaryContext += `\n\n【前プロセス全体のサマリー】\n${outputGenSummary.summary.map((s) => `- ${s.speaker}: ${s.position}`).join('\n')}`;
      }
    }

    const agentResponses: AgentResponse[] = [];
    const responses: AgentResponse[] = [];
    const shuffledAgents = shuffleArray<Agent>(session.agents);
    const delayMS = 120000; // 120秒

    for (let i = 0; i < shuffledAgents.length; i++) {
      if (i > 0)
        await sleep(delayMS);
      
      const agent = shuffledAgents[i];
      const agentInstance = this.agentManager.getAgent(agent.id);
      if (!agentInstance)
        continue;
      
      const interactionStart = new Date();
      let response;
      
      try {
        switch (stage) {
          case 'individual-thought': {
            const thought = await agentInstance.stage1IndividualThought(userPrompt + summaryContext, context);
            response = {
              agentId: thought.agentId,
              content: thought.content,
              reasoning: thought.reasoning,
              confidence: 0.8,
              stage: 'individual-thought',
              stageData: thought
            };
            break;
          }
          case 'mutual-reflection': {
            const individualThoughts = session.messages
              .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent' && m.agentId !== agent.id)
              .map((m: Message) => m.metadata?.stageData)
              .filter((data): data is StageData => data !== undefined);
            
            if (individualThoughts.length === 0) {
              const individualThoughtStage = session.stageHistory.find((h: StageHistory) => h.stage === 'individual-thought');
              if (individualThoughtStage) {
                individualThoughtStage.agentResponses.forEach((response: AgentResponse) => {
                  if (response.stageData) {
                    individualThoughts.push(response.stageData);
                  }
                });
              }
            }
            
            if (individualThoughts.length === 0)
              continue;
            
            const individualThoughtsForReflection: IndividualThought[] = individualThoughts.map((data: StageData) => ({
              agentId: data.agentId,
              content: data.content,
              summary: data.summary,
              reasoning: data.reasoning || 'No reasoning provided',
              assumptions: data.assumptions || [],
              approach: data.approach || 'No approach specified'
            }));
            
            const reflection = await agentInstance.stage2MutualReflection(agentDescriptions + '\n' + userPrompt + summaryContext, individualThoughtsForReflection, context);
            response = {
              agentId: reflection.agentId,
              content: reflection.content,
              reasoning: 'Mutual reflection on other agents\' thoughts',
              confidence: 0.7,
              stage: 'mutual-reflection',
              stageData: reflection
            };
            break;
          }
          case 'conflict-resolution': {
            const conflicts = this.identifyConflicts(session, this.defaultLanguage);
            // プロンプトにサマリーコンテキストを追加
            const enhancedContext = [...context];
            if (summaryContext) {
              enhancedContext.push({
                id: 'summary-context',
                agentId: 'system',
                content: summaryContext,
                timestamp: new Date(),
                role: 'system',
                stage: stage
              });
            }
            response = await agentInstance.stage3ConflictResolution(conflicts, enhancedContext);
            break;
          }
          case 'synthesis-attempt': {
            const synthesisData = this.prepareSynthesisData(session);
            // プロンプトにサマリーコンテキストを追加
            const enhancedContext = [...context];
            if (summaryContext) {
              enhancedContext.push({
                id: 'summary-context',
                agentId: 'system',
                content: summaryContext,
                timestamp: new Date(),
                role: 'system',
                stage: stage
              });
            }
            response = await agentInstance.stage4SynthesisAttempt(synthesisData, enhancedContext);
            break;
          }
          case 'output-generation': {
            const finalData = this.prepareFinalData(session);
            // プロンプトにサマリーコンテキストを追加
            const enhancedContext = [...context];
            if (summaryContext) {
              enhancedContext.push({
                id: 'summary-context',
                agentId: 'system',
                content: summaryContext,
                timestamp: new Date(),
                role: 'system',
                stage: stage
              });
            }
            response = await agentInstance.stage5OutputGeneration(finalData, enhancedContext);
            break;
          }
          default:
            throw new Error(`Unknown stage: ${stage}`);
        }
        
        const message: Message = {
          id: uuidv4(),
          agentId: response.agentId,
          content: response.content,
          timestamp: new Date(),
          role: 'agent' as const,
          stage: stage,
          sequenceNumber: session.sequenceNumber || 1,
          metadata: {
            reasoning: response.reasoning,
            confidence: response.confidence,
            stageData: response.stageData
          }
        };
        
        session.messages.push(message);
        session.updatedAt = new Date();
        
        if (onProgress)
          onProgress(message);
        
        await this.sessionManager.saveSession(session);
        agentResponses.push({ agentId: response.agentId, content: response.content });
        responses.push(response as AgentResponse);
      } catch (error) {
        continue;
      }
    }
    
    return { responses, agentResponses };
  }

  private async updateSessionStageHistory(
    session: Session,
    stage: DialogueStage,
    responses: AgentResponse[],
    stageStart: Date
  ): Promise<void> {
    const stageHistoryEntry: StageHistory = {
      stage,
      startTime: stageStart,
      endTime: new Date(),
      agentResponses: responses.map(r => removeCircularReferences(r) as AgentResponse),
      sequenceNumber: session.sequenceNumber || 1
    };

    session.stageHistory.push(stageHistoryEntry);
  }

  private getPreviousStageSummaries(session: Session, stage: DialogueStage): StageSummary[] {
    const stageOrder: DialogueStage[] = ['individual-thought', 'mutual-reflection', 'conflict-resolution', 'synthesis-attempt', 'output-generation'];
    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex <= 0) return [];

    return session.stageHistory
      .filter(history => stageOrder.indexOf(history.stage) < currentIndex)
      .map(history => ({
        stage: history.stage,
        summary: [{ speaker: 'system', position: 'No summary available' }], // StageSummaryの正しい型
        timestamp: history.startTime,
        stageNumber: stageOrder.indexOf(history.stage) + 1,
        sequenceNumber: history.sequenceNumber
      }));
  }

  private isAllStagesCompleted(session: Session): boolean {
    const completedStages = session.stageHistory.map(h => h.stage);
    const allStages: DialogueStage[] = ['individual-thought', 'mutual-reflection', 'conflict-resolution', 'synthesis-attempt', 'output-generation'];
    return allStages.every(stage => completedStages.includes(stage));
  }

  private async saveFinalOutputIfNeeded(
    isAllStagesCompleted: boolean,
    summaryList: AgentResponse[],
    session: Session,
    sessionId: string,
    language: Language
  ): Promise<void> {
    if (isAllStagesCompleted && summaryList.length > 0) {
      const finalOutput = summaryList[summaryList.length - 1];
      if (finalOutput && finalOutput.content) {
        await this.outputStorage.saveOutput(
          session.title,
          finalOutput.content,
          session.messages.find(m => m.role === 'user')?.content || '',
          language as Language,
          sessionId
        );
      }
    }
  }

  // 追加のメソッド群
  private identifyConflicts(session: Session, language: Language = 'en' as Language): Conflict[] {
    const conflicts: Conflict[] = [];
    const individualThoughts = session.messages
      .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent')
      .map((m: Message) => m.metadata?.stageData)
      .filter((data): data is StageData => data !== undefined);

    if (individualThoughts.length < 2) return conflicts;

    for (let i = 0; i < individualThoughts.length; i++) {
      for (let j = i + 1; j < individualThoughts.length; j++) {
        const thought1 = individualThoughts[i];
        const thought2 = individualThoughts[j];
        
        // 簡易的な競合検出ロジック
        if (thought1.approach !== thought2.approach) {
          conflicts.push({
            id: uuidv4(),
            agents: [thought1.agentId, thought2.agentId],
            description: `Different approaches: ${thought1.approach} vs ${thought2.approach}`,
            severity: 'medium'
          });
        }
      }
    }

    return conflicts;
  }

  private prepareSynthesisData(session: Session): SynthesisData {
    const individualThoughts = session.messages
      .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const mutualReflections = session.messages
      .filter((m: Message) => m.stage === 'mutual-reflection' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const conflictResolutions = session.messages
      .filter((m: Message) => m.stage === 'conflict-resolution' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const userMessage = session.messages.find((m: Message) => m.role === 'user');
    const userPrompt = userMessage?.content || '';

    return {
      query: userPrompt,
      individualThoughts,
      mutualReflections,
      conflictResolutions,
      context: session.messages.slice(-10).map((m: Message) => `${m.agentId}: ${typeof m.content === 'string' ? m.content.slice(0, 100) : ''}`).join('\n')
    };
  }

  private prepareFinalData(session: Session): FinalData {
    const individualThoughts = session.messages
      .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const mutualReflections = session.messages
      .filter((m: Message) => m.stage === 'mutual-reflection' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const conflictResolutions = session.messages
      .filter((m: Message) => m.stage === 'conflict-resolution' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const synthesisAttempts = session.messages
      .filter((m: Message) => m.stage === 'synthesis-attempt' && m.role === 'agent')
      .map((m: Message) => {
        const data = m.metadata?.stageData;
        return data?.summary || (typeof data?.content === 'string' ? data.content.slice(0, 100) : undefined);
      })
      .filter((data): data is string => data !== undefined);

    const userMessage = session.messages.find((m: Message) => m.role === 'user');
    const userPrompt = userMessage?.content || '';

    return {
      query: userPrompt,
      finalData: {
        individualThoughts,
        mutualReflections,
        conflictResolutions,
        synthesisAttempts
      },
      context: session.messages.slice(-10).map((m: Message) => `${m.agentId}: ${typeof m.content === 'string' ? m.content.slice(0, 100) : ''}`).join('\n')
    };
  }

  // テスト用のメソッド
  getAgentManager(): IAgentManager {
    return this.agentManager;
  }

  getSessionManager(): ISessionManager {
    return this.sessionManager;
  }
} 