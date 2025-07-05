import { v4 as uuidv4 } from 'uuid';
import { CONFLICT_DESCRIPTION_TEMPLATES } from '../templates/prompts.js';
import { SessionStorage } from './session-storage.js';
import { OutputStorage } from './output-storage.js';
import { InteractionLogger } from './interaction-logger.js';
import { createStageSummarizer } from './stage-summarizer.js';
import {
  Agent,
  AgentInstance,
  AgentResponse,
  Conflict,
  ConflictDescriptionTemplates,
  DelayOptions,
  DialogueStage,
  FinalData,
  IndividualThought,
  Language,
  Message,
  ProgressCallback,
  Session,
  StageData,
  StageExecutionResult,
  StageHistory,
  StageSummary,
  StageSummarizerOptions,
  SynthesisAttempt,
  SynthesisData,
  VotingResults
} from '../types/index.js';

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
// --- 投票先抽出関数 ---
function extractVote(content: string, agents: Agent[]): string | null {
    // 投票セクションを優先的に抽出
    const voteSectionMatch = content.match(/(?:まとめ役|Agent Vote|agent_vote)[^\n:：]*[:：]\s*([^\n]+)/i);
    let voteTarget = voteSectionMatch ? voteSectionMatch[1] : null;
    // Also look for **agent-id** format
    const boldMatch = content.match(/\*\*([a-zA-Z0-9-]+)\*\*/);
    if (boldMatch) {
        voteTarget = boldMatch[1];
    }
    for (const agent of agents) {
        const patterns = [
            agent.id,
            agent.name,
            agent.furigana,
            agent.name.replace(/[（(].*?[)）]/g, ''), // カッコ抜き
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
// --- 投票集計関数 ---
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
    // 最多得票者を全て返す
    const maxCount = Math.max(...Object.values(votes));
    if (maxCount === 0)
        return [];
    return Object.keys(votes).filter((id: string) => votes[id] === maxCount);
}
// --- Summarizer selection logic ---
function selectSummarizer(agents: Agent[], stage: DialogueStage, messages: Message[], agentResponses: AgentResponse[]): string {
    // 投票があれば投票集計を優先
    if (agentResponses && agentResponses.length > 0) {
        const votedList = tallyVotes(agentResponses, agents);
        if (votedList.length > 0) {
            // 最多得票者が複数の場合は、エージェントリスト順で最初のものを選ぶ
            for (const agent of agents) {
                if (votedList.includes(agent.id))
                    return agent.id;
            }
        }
    }
    // output-generationやサマライズ時のみ動的選出
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
function sleep(ms: number): Promise<void> {
    return new Promise((resolve: () => void) => setTimeout(resolve, ms));
}
// 配列シャッフル関数（Fisher-Yates）
function shuffleArray<T>(array: T[]): T[] {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
export class RealtimeYuiProtocolRouter {
    sessions = new Map<string, Session>();
    agents = new Map<string, AgentInstance>();
    defaultLanguage: Language = 'en';
    sessionStorage: SessionStorage;
    outputStorage: OutputStorage;
    interactionLogger: InteractionLogger;
    stageSummarizer: ReturnType<typeof createStageSummarizer>;
    sessionsLoaded = false;
    stageSummarizerDelayMS: number;
    finalSummaryDelayMS: number;
    constructor(sessionStorage: SessionStorage, outputStorage: OutputStorage, interactionLogger: InteractionLogger, stageSummarizerOptions: StageSummarizerOptions, delayOptions: DelayOptions) {
        this.sessionStorage = sessionStorage || new SessionStorage();
        this.outputStorage = outputStorage || new OutputStorage();
        this.interactionLogger = interactionLogger || new InteractionLogger();
        this.stageSummarizer = createStageSummarizer(stageSummarizerOptions);
        this.initializeDefaultAgents();
        // Load sessions asynchronously
        this.loadExistingSessions().then(() => {
            this.sessionsLoaded = true;
            console.log('Sessions loaded successfully');
        }).catch(error => {
            console.error('Failed to load sessions:', error);
            this.sessionsLoaded = true; // Mark as loaded even if failed
        });
        this.stageSummarizerDelayMS = delayOptions?.stageSummarizerDelayMS ?? 30000; // 30秒
        this.finalSummaryDelayMS = delayOptions?.finalSummaryDelayMS ?? 60000; // 60秒
    }
    // Method to ensure sessions are loaded before accessing them
    async ensureSessionsLoaded() {
        if (!this.sessionsLoaded) {
            await this.loadExistingSessions();
            this.sessionsLoaded = true;
        }
    }
    async loadExistingSessions() {
        try {
            const sessions = await this.sessionStorage.getAllSessions();
            for (const session of sessions) {
                this.sessions.set(session.id, session);
            }
            console.log(`Loaded ${sessions.length} existing sessions from storage`);
        }
        catch (error) {
            console.error('Error loading existing sessions:', error);
        }
    }
    initializeDefaultAgents() {
        // Import and initialize default agents with shared interaction logger
        import('../agents/agent-eiro.js').then(({ EiroAgent }) => {
            const eiro = new EiroAgent(this.interactionLogger);
            this.agents.set(eiro.getAgent().id, eiro);
        });
        import('../agents/agent-kanshi.js').then(({ KanshiAgent }) => {
            const kanshi = new KanshiAgent(this.interactionLogger);
            this.agents.set(kanshi.getAgent().id, kanshi);
        });
        import('../agents/agent-yoga.js').then(({ YogaAgent }) => {
            const yoga = new YogaAgent(this.interactionLogger);
            this.agents.set(yoga.getAgent().id, yoga);
        });
        import('../agents/agent-hekito.js').then(({ HekitoAgent }) => {
            const hekito = new HekitoAgent(this.interactionLogger);
            this.agents.set(hekito.getAgent().id, hekito);
        });
        import('../agents/agent-yui.js').then(({ yuiAgent }) => {
            const yui = new yuiAgent(this.interactionLogger);
            this.agents.set(yui.getAgent().id, yui);
        });
        console.log(`Initialized ${this.agents.size} agents: ${Array.from(this.agents.keys()).join(', ')}`);
    }
    async saveSessionToStorage(session: Session): Promise<void> {
        try {
            await this.sessionStorage.saveSession(session);
        }
        catch (error) {
            console.error(`Error saving session ${session.id}:`, error);
        }
    }
    getStageSpecificInputData(stage: DialogueStage, session: Session): Record<string, unknown> | null {
        switch (stage) {
            case 'individual-thought':
                return { userPrompt: session.messages.find((m: Message) => m.role === 'user')?.content };
            case 'mutual-reflection':
                const individualThoughts = session.messages
                    .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent')
                    .map((m: Message) => m.metadata?.stageData)
                    .filter((data): data is StageData => data !== undefined);
                return { individualThoughts };
            case 'conflict-resolution':
                const conflicts = this.identifyConflicts(session, this.defaultLanguage);
                return { conflicts };
            case 'synthesis-attempt':
                const synthesisData = this.prepareSynthesisData(session);
                return { synthesisData };
            case 'output-generation':
                const finalData = this.prepareFinalData(session);
                return { finalData };
            default:
                return null;
        }
    }
    async createSession(title: string, agentIds: string[], language: Language = 'en'): Promise<Session> {
        // 既存セッションの最大IDを取得して+1する
        const existingSessions = await this.sessionStorage.getAllSessions();
        let maxId = 0;
        for (const session of existingSessions) {
            const sessionIdNum = parseInt(session.id, 10);
            if (!isNaN(sessionIdNum) && sessionIdNum > maxId) {
                maxId = sessionIdNum;
            }
        }
        const sessionId = (maxId + 1).toString();
        const agents = agentIds
            .map((id: string) => this.agents.get(id))
            .filter((agent): agent is AgentInstance => agent !== undefined)
            .map((agent: AgentInstance) => agent.getAgent());
        const session: Session = {
            id: sessionId,
            title,
            agents,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active',
            currentStage: undefined,
            stageHistory: [],
            language,
        };
        this.sessions.set(sessionId, session);
        await this.saveSessionToStorage(session);
        return session;
    }
    // --- 新規: エージェントセットアップ ---
    setupAgentsForStage(session: Session, sessionId: string, language?: Language): void {
        if (language) {
            for (const agent of session.agents) {
                const agentInstance = this.agents.get(agent.id);
                if (agentInstance) {
                    agentInstance.setLanguage(language);
                    agentInstance.setSessionId(sessionId);
                }
            }
        }
        else {
            for (const agent of session.agents) {
                const agentInstance = this.agents.get(agent.id);
                if (agentInstance) {
                    agentInstance.setSessionId(sessionId);
                }
            }
        }
    }
    // --- 新規: ユーザーメッセージ追加 ---
    addUserMessageIfNeeded(session: Session, userPrompt: string, stage: DialogueStage): void {
        // 各ステージでユーザーメッセージを追加（既に存在しない場合のみ）
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
    // --- 新規: エージェントレスポンス生成 ---
    async generateAgentResponses(session: Session, stage: DialogueStage, userPrompt: string, agentDescriptions: string, context: Message[], onProgress?: ProgressCallback): Promise<{ responses: AgentResponse[]; agentResponses: AgentResponse[] }> {
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
            const agentInstance = this.agents.get(agent.id);
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
                await this.saveSessionToStorage(session);
                agentResponses.push({ agentId: response.agentId, content: response.content });
                responses.push(response as AgentResponse);
            }
            catch (error) {
                continue;
            }
        }
        return { responses, agentResponses };
    }
    // --- 新規: サマライザー選出 ---
    selectSummarizerAgents(stage: DialogueStage, agentResponses: AgentResponse[], session: Session): string[] {
        let summarizerIds: string[] = [];
        if (stage === 'output-generation') {
            summarizerIds = tallyVotes(agentResponses, session.agents);
            if (summarizerIds.length === 0) {
                const fallbackId = selectSummarizer(session.agents, stage, session.messages, agentResponses);
                if (fallbackId)
                    summarizerIds = [fallbackId];
            }
            session.agents.forEach((agent: Agent) => {
                agent.isSummarizer = summarizerIds.includes(agent.id);
            });
        }
        else {
            session.agents.forEach((agent: Agent) => {
                agent.isSummarizer = false;
            });
        }
        return summarizerIds;
    }
    // --- 新規: サマリー生成 ---
    async generateSummaries(stage: DialogueStage, summarizerIds: string[], session: Session, context: Message[], onProgress?: ProgressCallback): Promise<AgentResponse[]> {
        let summaryList: AgentResponse[] = [];
        if (stage === 'output-generation' && summarizerIds.length > 0) {
            const finalData = this.prepareFinalData(session);
            const summaryDelayMS = 120000;
            for (let i = 0; i < summarizerIds.length; i++) {
                await sleep(summaryDelayMS);
                const summarizerId = summarizerIds[i];
                const summarizerAgentInstance = this.agents.get(summarizerId);
                if (summarizerAgentInstance && summarizerAgentInstance.stage5OutputGeneration) {
                    summarizerAgentInstance.setIsSummarizer(true);
                    const summary = await summarizerAgentInstance.stage5OutputGeneration(finalData, context);
                    if (summary) {
                        summaryList.push(summary);
                        const summaryMessage: Message = {
                            id: uuidv4(),
                            agentId: summary.agentId,
                            content: summary.content,
                            timestamp: new Date(),
                            role: 'agent' as const,
                            stage: stage,
                            sequenceNumber: session.sequenceNumber || 1,
                            metadata: {
                                reasoning: summary.reasoning,
                                confidence: summary.confidence,
                                stageData: summary.stageData
                            }
                        };
                        session.messages.push(summaryMessage);
                        session.updatedAt = new Date();
                        if (onProgress)
                            onProgress(summaryMessage);
                        await this.saveSessionToStorage(session);
                    }
                }
            }
        }
        return summaryList;
    }
    // --- 新規: ステージ履歴・セッション状態更新 ---
    async updateSessionStageHistory(session: Session, stage: DialogueStage, responses: AgentResponse[], stageStart: Date): Promise<void> {
        session.stageHistory.push({
            stage,
            startTime: stageStart,
            endTime: new Date(),
            agentResponses: responses,
            sequenceNumber: session.sequenceNumber || 1
        });
        // ステージ終了時にサマリーを生成
        await this.generateStageSummary(session, stage);
        const completedStages = session.stageHistory.filter((h: StageHistory) => h.endTime);
        const isAllStagesCompleted = completedStages.length >= 5;
        if (isAllStagesCompleted) {
            session.currentStage = undefined;
            session.complete = true;
        }
        else {
            session.currentStage = stage;
            session.complete = false;
        }
        session.updatedAt = new Date();
    }
    // --- 新規: 前のステージサマリー取得 ---
    getPreviousStageSummaries(session: Session, stage: DialogueStage): StageSummary[] {
        if (!session.stageSummaries)
            return [];
        const currentSequenceNumber = session.sequenceNumber || 1;
        const stageOrder: Record<DialogueStage, number> = {
            'individual-thought': 1,
            'mutual-reflection': 2,
            'mutual-reflection-summary': 2.5,
            'conflict-resolution': 3,
            'conflict-resolution-summary': 3.5,
            'synthesis-attempt': 4,
            'synthesis-attempt-summary': 4.5,
            'output-generation': 5,
            'finalize': 5.1
        };
        const currentStageNumber = stageOrder[stage];
        return session.stageSummaries.filter((summary: StageSummary) => summary.sequenceNumber === currentSequenceNumber &&
            stageOrder[summary.stage] < currentStageNumber);
    }
    // --- 新規: ステージサマリー生成 ---
    async generateStageSummary(session: Session, stage: DialogueStage): Promise<void> {
        try {
            console.log(`[RealtimeRouter] Generating summary for stage: ${stage}`);
            // ステージ内のメッセージを抽出
            const stageMessages = session.messages.filter((msg: Message) => msg.stage === stage && msg.role === 'agent');
            if (stageMessages.length === 0) {
                console.log(`[RealtimeRouter] No messages found for stage ${stage}, skipping summary`);
                return;
            }
            // StageSummarizerを呼ぶ前にdelayを追加
            console.log(`[RealtimeRouter] Waiting ${this.stageSummarizerDelayMS}ms before calling StageSummarizer for stage ${stage}`);
            await sleep(this.stageSummarizerDelayMS);
            // サマリーを生成
            const summary = await this.stageSummarizer.summarizeStage(stage, session.messages, session.agents, session.id, session.language);
            // シーケンス番号を設定
            summary.sequenceNumber = session.sequenceNumber || 1;
            // セッションにサマリーを保存
            if (!session.stageSummaries) {
                session.stageSummaries = [];
            }
            // 既存のサマリーを更新または新規追加
            const existingIndex = session.stageSummaries.findIndex((s: StageSummary) => s.stage === stage && s.sequenceNumber === summary.sequenceNumber);
            if (existingIndex >= 0) {
                session.stageSummaries[existingIndex] = summary;
            }
            else {
                session.stageSummaries.push(summary);
            }
            console.log(`[RealtimeRouter] Summary generated for stage ${stage}:`, summary.summary.length, 'entries');
        }
        catch (error) {
            console.error(`[RealtimeRouter] Error generating summary for stage ${stage}:`, error);
        }
    }
    // --- 新規: 最終出力保存 ---
    async saveFinalOutputIfNeeded(isAllStagesCompleted: boolean, summaryList: AgentResponse[], session: Session, sessionId: string, language: Language): Promise<void> {
        if (isAllStagesCompleted && summaryList.length > 0) {
            try {
                const userMessage = session.messages.find((m: Message) => m.role === 'user');
                const userPrompt = userMessage?.content || '';
                // 全ステージのサマリーを統合
                let finalContent = '';
                if (session.stageSummaries && session.stageSummaries.length > 0) {
                    const currentSequenceNumber = session.sequenceNumber || 1;
                    const sequenceSummaries = session.stageSummaries.filter((s: StageSummary) => s.sequenceNumber === currentSequenceNumber);
                    if (sequenceSummaries.length > 0) {
                        // 最終サマリー生成前にdelayを追加
                        console.log(`[RealtimeRouter] Waiting ${this.finalSummaryDelayMS}ms before generating final summary`);
                        await sleep(this.finalSummaryDelayMS);
                        const finalSummary = await this.stageSummarizer.generateFinalSummary(sequenceSummaries, session.agents, session.id);
                        finalContent = `# Yui Protocol Final Summary (Sequence ${currentSequenceNumber})\n\n${finalSummary}\n\n---\n\n`;
                    }
                }
                for (const summary of summaryList) {
                    const fullContent = finalContent + summary.content;
                    const savedOutput = await this.saveFinalOutput(sessionId, `Yui Protocol Output - ${new Date().toLocaleDateString()}`, fullContent, userPrompt, language || this.defaultLanguage);
                    session.outputFileName = savedOutput.id + '.md';
                    await this.saveSessionToStorage(session);
                    session.status = 'completed';
                    session.complete = true;
                    await this.saveSessionToStorage(session);
                }
            }
            catch (error) {
                console.error(`[RealtimeRouter] Error auto-saving final output:`, error);
            }
        }
    }
    // --- リファクタ済み executeStageRealtime ---
    async executeStageRealtime(sessionId: string, userPrompt: string, stage: DialogueStage, language: Language, onProgress?: ProgressCallback): Promise<StageExecutionResult> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // 新しいシーケンスが必要かチェック
        if (this.shouldStartNewSequence(session, stage)) {
            await this.startNewSequence(sessionId);
        }
        this.setupAgentsForStage(session, sessionId, language);
        const stageStart = new Date();
        session.currentStage = stage;
        this.addUserMessageIfNeeded(session, userPrompt, stage);
        // 現在のシーケンスのメッセージのみを取得
        const currentSequenceNumber = session.sequenceNumber || 1;
        const sequenceMessages = this.getMessagesForSequence(session, currentSequenceNumber);
        const context = sequenceMessages.filter((m: Message) => m.stage !== stage).slice(-20);
        const agentDescriptions = '【List of Participating Agents】\n' +
            session.agents.map((a: Agent) => `・${a.name} ${a.furigana ? `（${a.furigana}）` : ''} id: ${a.id} : ${a.personality}`).join('  ') +
            '\n※Thereafter, always use only the above names and designations, and never use other names or fictitious agent names.';
        // 5-Stage Dialectic Process with summary stages
        let responses: AgentResponse[] = [];
        let agentResponses: AgentResponse[] = [];
        let summaryList: AgentResponse[] = [];
        if (stage === 'mutual-reflection-summary') {
            // Stage 2.5: Summarize mutual reflection
            const mutualReflectionResponses = this.getStageResponses(session, 'mutual-reflection');
            responses = await this.executeSummaryStage(session, stage, mutualReflectionResponses, context, onProgress);
        }
        else if (stage === 'conflict-resolution-summary') {
            // Stage 3.5: Summarize conflict resolution
            const conflictResolutionResponses = this.getStageResponses(session, 'conflict-resolution');
            responses = await this.executeSummaryStage(session, stage, conflictResolutionResponses, context, onProgress);
        }
        else if (stage === 'synthesis-attempt-summary') {
            // Stage 4.5: Summarize synthesis attempt
            const synthesisAttemptResponses = this.getStageResponses(session, 'synthesis-attempt');
            responses = await this.executeSummaryStage(session, stage, synthesisAttemptResponses, context, onProgress);
        }
        else if (stage === 'finalize') {
            // Stage 5.1: Finalize with voting results
            const outputGenerationResponses = this.getStageResponses(session, 'output-generation');
            const votingResults = this.extractVotingResults(outputGenerationResponses, session.agents);
            const selectedAgent = this.selectFinalAgent(votingResults, session.agents);
            if (selectedAgent) {
                responses = await this.executeFinalizeStage(session, selectedAgent.getAgent(), votingResults, outputGenerationResponses, context, onProgress);
            } else {
                responses = [];
            }
        }
        else {
            // Regular stages (1, 2, 3, 4, 5)
            const result = await this.generateAgentResponses(session, stage, userPrompt, agentDescriptions, context, onProgress);
            responses = result.responses;
            agentResponses = result.agentResponses;
            // Generate summaries for regular stages
            const summarizerIds = this.selectSummarizerAgents(stage, agentResponses, session);
            summaryList = await this.generateSummaries(stage, summarizerIds, session, context, onProgress);
        }
        await this.updateSessionStageHistory(session, stage, responses, stageStart);
        // ステージサマリーを生成（要約ステージ以外）
        if (!stage.includes('-summary') && stage !== 'finalize') {
            await this.generateStageSummary(session, stage);
        }
        const completedStages = session.stageHistory.filter((h: StageHistory) => h.endTime);
        const isAllStagesCompleted = completedStages.length >= 8; // 5 main stages + 3 summary stages
        await this.saveSessionToStorage(session);
        await this.saveFinalOutputIfNeeded(isAllStagesCompleted, summaryList, session, sessionId, language);
        return {
            stage,
            agentResponses: responses,
            duration: Date.now() - stageStart.getTime()
        };
    }
    // Helper methods for conflict identification and synthesis
    identifyConflicts(session: Session, language: Language = 'en'): Conflict[] {
        const conflicts: Conflict[] = [];
        // Get individual thoughts and mutual reflections from current session only
        const individualThoughts = session.messages
            .filter((m: Message) => m.stage === 'individual-thought' && m.role === 'agent')
            .map((m: Message) => m.metadata?.stageData)
            .filter((data): data is StageData => data !== undefined);
        const mutualReflections = session.messages
            .filter((m: Message) => m.stage === 'mutual-reflection' && m.role === 'agent')
            .map((m: Message) => m.metadata?.stageData)
            .filter((data): data is StageData => data !== undefined);
        // Enhanced conflict detection based on disagreement in mutual reflections
        mutualReflections.forEach((reflection: StageData) => {
            const disagreements = reflection.reflections?.filter((r) => !r.agreement) || [];
            if (disagreements.length > 0) {
                // Create detailed conflict descriptions
                disagreements.forEach((disagreement) => {
                    const targetThought = individualThoughts.find((t: StageData) => t.agentId === disagreement.targetAgentId);
                    const conflictDescription = this.generateDetailedConflictDescription(reflection.agentId, disagreement.targetAgentId, disagreement.reaction, targetThought?.content || 'No content available', targetThought?.approach || 'Unknown approach', language);
                    conflicts.push({
                        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        agents: [reflection.agentId, disagreement.targetAgentId],
                        description: conflictDescription,
                        severity: 'medium'
                    });
                });
            }
        });
        // If no conflicts found in reflections, create a default conflict for discussion
        if (conflicts.length === 0 && individualThoughts.length > 1) {
            const agentNames = individualThoughts.map((t: StageData) => t.agentId).join(', ');
            const approaches = individualThoughts.map((t: StageData) => `${t.agentId}: ${t.approach}`).join('; ');
            // Analyze differences in approaches between agents in detail
            const approachAnalysis = this.analyzeApproachDifferences(individualThoughts, language);
            // Evaluate potential for conflicts
            const potentialConflicts = this.identifyPotentialConflicts(individualThoughts, language);
            const templates = CONFLICT_DESCRIPTION_TEMPLATES;
            conflicts.push({
                id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                agents: individualThoughts.map((t: StageData) => t.agentId),
                description: `【${templates.diversePerspectives}】
エージェント: ${agentNames}

【${templates.agentApproaches}】
${approaches}

【${templates.approachAnalysis}】
${approachAnalysis}

【${templates.potentialConflicts}】
${potentialConflicts}

【${templates.mutualUnderstanding}】
${templates.complementarySolutions}`,
                severity: 'low'
            });
        }
        return conflicts;
    }
    generateDetailedConflictDescription(agent1Id: string, agent2Id: string, reaction: string, targetContent: string, targetApproach: string, language: Language = 'en'): string {
        const contentPreview = targetContent.length > 100
            ? targetContent.substring(0, 100) + '...'
            : targetContent;
        // Analyze conflict causes based on agent characteristics
        const agent1Style = this.getAgentStyle(agent1Id);
        const agent2Style = this.getAgentStyle(agent2Id);
        // Analyze root cause of conflict
        const conflictRootCause = this.analyzeConflictRootCause(agent1Id, agent2Id, reaction, targetApproach, language);
        // Suggest direction for resolution
        const resolutionDirection = this.suggestResolutionDirection(agent1Id, agent2Id, targetApproach, language);
        const templates = CONFLICT_DESCRIPTION_TEMPLATES;
        return `【${templates.conflictDetails}】
ID: ${agent1Id} vs ${agent2Id}
内容: ${agent1Id} disagrees with ${agent2Id}'s perspective. ${agent2Id} used a ${targetApproach} approach and stated: "${contentPreview}". ${agent1Id}'s reaction: "${reaction}".

【${templates.rootCauseAnalysis}】
${conflictRootCause}

【${templates.resolutionDirection}】
${resolutionDirection}

【${templates.discussionFocus}】
${templates.understandingDifferences}`;
    }
    analyzeConflictRootCause(agent1Id: string, agent2Id: string, reaction: string, targetApproach: string, language: Language = 'en'): string {
        // Analyze conflict causes based on agent characteristics
        const agent1Style = this.getAgentStyle(agent1Id);
        const agent2Style = this.getAgentStyle(agent2Id);
        const templates = CONFLICT_DESCRIPTION_TEMPLATES;
        if (agent1Style === 'analytical' && agent2Style === 'intuitive') {
            return templates.conceptualTensions;
        }
        else if (agent1Style === 'logical' && agent2Style === 'critical') {
            return templates.valueConflicts;
        }
        else if (agent1Style === 'critical' && agent2Style === 'analytical') {
            return templates.ideaContradictions;
        }
        else {
            return templates.conceptualTensions;
        }
    }
    suggestResolutionDirection(agent1Id: string, agent2Id: string, targetApproach: string, language: Language = 'en'): string {
        const agent1Style = this.getAgentStyle(agent1Id);
        const agent2Style = this.getAgentStyle(agent2Id);
        const templates = CONFLICT_DESCRIPTION_TEMPLATES;
        if (agent1Style === 'analytical' && agent2Style === 'intuitive') {
            return templates.synthesisOpportunities;
        }
        else if (agent1Style === 'logical' && agent2Style === 'critical') {
            return templates.frameworkIntegration;
        }
        else if (agent1Style === 'critical' && agent2Style === 'analytical') {
            return templates.conceptualResolution;
        }
        else {
            return templates.ideaSynthesis;
        }
    }
    getAgentStyle(agentId: string): Agent['style'] {
        if (agentId.includes('hekito'))
            return 'analytical';
        if (agentId.includes('eiro'))
            return 'logical';
        if (agentId.includes('kanshi'))
            return 'critical';
        if (agentId.includes('yoga'))
            return 'intuitive';
        if (agentId.includes('yui'))
            return 'meta';
        return 'logical';
    }
    analyzeApproachDifferences(individualThoughts: StageData[], language: Language = 'en'): string {
        const approaches = individualThoughts.map((t: StageData) => ({
            agentId: t.agentId,
            approach: t.approach || '',
            style: this.getAgentStyle(t.agentId)
        }));
        const templates = CONFLICT_DESCRIPTION_TEMPLATES;
        let analysis = '';
        // Analyze approach diversity
        const uniqueStyles = [...new Set(approaches.map((a) => a.style))];
        if (uniqueStyles.length > 1) {
            analysis += templates.perspectiveIntegration + '\n';
        }
        // Analyze individual agent characteristics
        approaches.forEach((approach) => {
            switch (approach.style) {
                case 'analytical':
                    analysis += templates.coreInsights + '\n';
                    break;
                case 'logical':
                    analysis += templates.fundamentalQuestions + '\n';
                    break;
                case 'critical':
                    analysis += templates.emergingDirections + '\n';
                    break;
                case 'intuitive':
                    analysis += templates.unresolvedTensions + '\n';
                    break;
                default:
                    analysis += templates.synthesisPossibilities + '\n';
            }
        });
        return analysis;
    }
    identifyPotentialConflicts(individualThoughts: StageData[], language: Language = 'en'): string {
        const approaches = individualThoughts.map((t: StageData) => ({
            agentId: t.agentId,
            approach: t.approach || '',
            style: this.getAgentStyle(t.agentId)
        }));
        const templates = CONFLICT_DESCRIPTION_TEMPLATES;
        const potentialConflicts: string[] = [];
        // Analytical vs Creative conflict potential
        const hasAnalytical = approaches.some((a) => a.style === 'analytical');
        const hasIntuitive = approaches.some((a) => a.style === 'intuitive');
        if (hasAnalytical && hasIntuitive) {
            potentialConflicts.push(templates.conceptualTensions);
        }
        // Logical vs Critical conflict potential
        const hasLogical = approaches.some((a) => a.style === 'logical');
        const hasCritical = approaches.some((a) => a.style === 'critical');
        if (hasLogical && hasCritical) {
            potentialConflicts.push(templates.valueConflicts);
        }
        // Approach priority differences
        if (approaches.length > 2) {
            potentialConflicts.push(templates.multiplePerspectives);
        }
        if (potentialConflicts.length === 0) {
            return templates.noSignificantConflicts;
        }
        return potentialConflicts.join('; ') + '. ' + templates.complementarySolutions;
    }
    prepareSynthesisData(session: Session): SynthesisData {
        // Get all previous stage data from current session only
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
        // Get the original user prompt from current session
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
    generateSynthesis(responses: AgentResponse[]): SynthesisAttempt {
        // Implementation for synthesis generation
        return {
            consensus: 0.8,
            confidence: 0.7
        };
    }
    prepareFinalData(session: Session): FinalData {
        // Get all previous stage data from current session only
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
        // Get the original user prompt from current session
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
    // Standard session management methods
    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }
    async getAllSessions(): Promise<Session[]> {
        await this.ensureSessionsLoaded();
        const sessions = Array.from(this.sessions.values());
        // Sort by updatedAt in descending order (newest first)
        return sessions.sort((a: Session, b: Session) => {
            const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
            const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
            return dateB.getTime() - dateA.getTime();
        });
    }
    getAvailableAgents(): Agent[] {
        return Array.from(this.agents.values()).map((agent: AgentInstance) => agent.getAgent());
    }
    async deleteSession(sessionId: string): Promise<boolean> {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            try {
                await this.sessionStorage.deleteSession(sessionId);
            }
            catch (error) {
                console.error(`Error deleting session ${sessionId} from storage:`, error);
            }
        }
        return deleted;
    }
    setDefaultLanguage(language: Language): void {
        this.defaultLanguage = language;
    }
    getDefaultLanguage(): Language {
        return this.defaultLanguage;
    }
    // Output storage methods
    async saveFinalOutput(sessionId: string, title: string, content: string, userPrompt: string, language: Language) {
        return await this.outputStorage.saveOutput(title, content, userPrompt, language, sessionId);
    }
    async getAllSavedOutputs() {
        return await this.outputStorage.getAllOutputs();
    }
    async getSavedOutput(id: string) {
        return await this.outputStorage.getOutput(id);
    }
    async deleteSavedOutput(id: string) {
        return await this.outputStorage.deleteOutput(id);
    }
    // --- 新規: セッションリセット ---
    async resetSession(sessionId: string): Promise<Session> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // セッションをリセット
        session.messages = [];
        session.stageHistory = [];
        session.stageSummaries = [];
        session.currentStage = undefined;
        session.status = 'active';
        session.complete = false;
        session.outputFileName = undefined;
        session.updatedAt = new Date();
        // セッションを保存
        await this.saveSessionToStorage(session);
        console.log(`[RealtimeRouter] Session ${sessionId} reset successfully`);
        return session;
    }
    // --- 新規: セッションリセット確認 ---
    shouldResetSession(session: Session, stage: DialogueStage): boolean {
        // Stage 1から開始する場合で、既にメッセージやサマリーが存在する場合はリセットが必要
        if (stage === 'individual-thought') {
            return session.messages.length > 0 ||
                (session.stageSummaries && session.stageSummaries.length > 0) ||
                session.stageHistory.length > 0;
        }
        return false;
    }
    // --- 新規: 新しいシーケンス開始 ---
    async startNewSequence(sessionId: string): Promise<Session> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // シーケンス番号をインクリメント
        session.sequenceNumber = (session.sequenceNumber || 0) + 1;
        session.currentStage = undefined;
        session.status = 'active';
        session.complete = false;
        session.outputFileName = undefined;
        session.updatedAt = new Date();
        // 新しいシーケンス開始時はstageHistoryをリセット
        // 前のシーケンスの履歴は保持しつつ、新しいシーケンス用にクリア
        session.stageHistory = [];
        // セッションを保存
        await this.saveSessionToStorage(session);
        console.log(`[RealtimeRouter] Started new sequence ${session.sequenceNumber} for session ${sessionId}`);
        return session;
    }
    // --- 新規: シーケンス確認 ---
    shouldStartNewSequence(session: Session, stage: DialogueStage): boolean {
        // Stage 1から開始する場合で、既にメッセージやサマリーが存在する場合は新しいシーケンスが必要
        if (stage === 'individual-thought') {
            return session.messages.length > 0 ||
                (session.stageSummaries && session.stageSummaries.length > 0) ||
                session.stageHistory.length > 0;
        }
        return false;
    }
    // --- 新規: シーケンス別メッセージ取得 ---
    getMessagesForSequence(session: Session, sequenceNumber: number): Message[] {
        return session.messages.filter((msg: Message) => msg.sequenceNumber === sequenceNumber);
    }
    // --- 新規: シーケンス別サマリー取得 ---
    getSummariesForSequence(session: Session, sequenceNumber: number): StageSummary[] {
        if (!session.stageSummaries)
            return [];
        return session.stageSummaries.filter((summary: StageSummary) => summary.sequenceNumber === sequenceNumber);
    }
    // Helper methods for 5-Stage Dialectic Process
    getStageResponses(session: Session, stage: DialogueStage): AgentResponse[] {
        return session.stageHistory
            .find((h: StageHistory) => h.stage === stage)
            ?.agentResponses || [];
    }
    async executeSummaryStage(session: Session, stage: DialogueStage, responses: AgentResponse[], context: Message[], onProgress?: ProgressCallback): Promise<AgentResponse[]> {
        // ユーザーメッセージが含まれていることを確認
        const userMessage = context.find((m: Message) => m.role === 'user');
        if (!userMessage) {
            // ユーザーメッセージが見つからない場合は、セッションから取得
            const sessionUserMessage = session.messages.find((m: Message) => m.role === 'user');
            if (sessionUserMessage) {
                context.push(sessionUserMessage);
            }
        }
        // Use stage summarizer to create summary
        const summary = await this.stageSummarizer.summarizeStage(stage, responses.map((r: AgentResponse) => ({
            id: r.agentId,
            agentId: r.agentId,
            content: r.content,
            timestamp: new Date(),
            role: 'agent' as const,
            stage
        })), session.agents, session.id, session.language);
        // Create a summary response
        const summaryResponse: AgentResponse = {
            agentId: 'stage-summarizer',
            content: summary.summary.map((s) => `${s.speaker}: ${s.position}`).join('\n'),
            summary: summary.summary.map((s) => `${s.speaker}: ${s.position}`).join('; '),
            reasoning: 'Summarized stage responses to extract key points for next stage',
            confidence: 0.8,
            references: ['stage-summary', 'conflict-extraction'],
            stage,
            stageData: {
                agentId: 'stage-summarizer',
                content: summary.summary.map((s) => `${s.speaker}: ${s.position}`).join('\n'),
                summary: summary.summary.map((s) => `${s.speaker}: ${s.position}`).join('; ')
            }
        };
        // Create system message for UI
        const systemMessage: Message = {
            id: `summary-${Date.now()}`,
            agentId: 'system',
            content: summaryResponse.content,
            timestamp: new Date(),
            role: 'system' as const,
            stage
        };
        // Send progress update as system message
        if (onProgress) {
            onProgress(systemMessage);
        }
        // Also save the system message to session for persistence
        session.messages.push(systemMessage);
        return [summaryResponse];
    }
    async executeFinalizeStage(session: Session, selectedAgent: Agent, votingResults: VotingResults, responses: AgentResponse[], context: Message[], onProgress?: ProgressCallback): Promise<AgentResponse[]> {
        // ユーザーメッセージが含まれていることを確認
        const userMessage = context.find((m: Message) => m.role === 'user');
        if (!userMessage) {
            // ユーザーメッセージが見つからない場合は、セッションから取得
            const sessionUserMessage = session.messages.find((m: Message) => m.role === 'user');
            if (sessionUserMessage) {
                context.push(sessionUserMessage);
            }
        }
        // Get the selected agent instance
        const agentInstance = this.agents.get(selectedAgent.id);
        if (!agentInstance) {
            throw new Error(`Selected agent ${selectedAgent.id} not found`);
        }
        // Set up the agent for finalize stage (but NOT as summarizer)
        // The agent should maintain its own personality and style
        agentInstance.setIsSummarizer(false);
        agentInstance.setSessionId(session.id);
        agentInstance.setLanguage(session.language);
        console.log(`[FinalizeStage] Executing finalize stage with selected agent: ${selectedAgent.id} (${selectedAgent.name})`);
        // Execute finalize stage
        const finalizeResponse = await agentInstance.stage5_1Finalize(votingResults, responses, context);
        // Create finalize message for UI
        const finalizeMessage: Message = {
            id: `finalize-${Date.now()}`,
            agentId: selectedAgent.id,
            content: finalizeResponse.content,
            timestamp: new Date(),
            role: 'agent' as const,
            stage: 'finalize'
        };
        // Send progress update with the selected agent's identity
        if (onProgress) {
            onProgress(finalizeMessage);
        }
        // Also save the finalize message to session for persistence
        session.messages.push(finalizeMessage);
        console.log(`[FinalizeStage] Finalize stage completed by ${selectedAgent.id} (${selectedAgent.name})`);
        return [finalizeResponse];
    }
    extractVotingResults(responses: AgentResponse[], agents: Agent[]): VotingResults {
        const votingResults: VotingResults = {};
        responses.forEach((response: AgentResponse) => {
            // First try to get vote from metadata if it exists
            if (response.metadata?.voteFor) {
                votingResults[response.agentId] = response.metadata.voteFor;
                console.log(`[Voting] ${response.agentId} voted for ${response.metadata.voteFor} (from metadata)`);
            }
            else {
                // If no metadata, extract vote from content text using the extractVote function
                const vote = extractVote(response.content, agents);
                if (vote) {
                    votingResults[response.agentId] = vote;
                    console.log(`[Voting] ${response.agentId} voted for ${vote} (from content)`);
                }
                else {
                    console.log(`[Voting] ${response.agentId} - no vote found`);
                }
            }
        });
        console.log(`[Voting] Final voting results:`, votingResults);
        return votingResults;
    }
    selectFinalAgent(votingResults: VotingResults, agents: Agent[]): AgentInstance | undefined {
        console.log(`[SelectFinalAgent] Input voting results:`, votingResults);
        // Count votes
        const voteCounts: any = {};
        agents.forEach((agent: any) => {
            voteCounts[agent.id] = 0;
        });
        Object.values(votingResults).forEach((votedAgent: unknown) => {
            if (typeof votedAgent === 'string' && voteCounts.hasOwnProperty(votedAgent)) {
                voteCounts[votedAgent]++;
            }
        });
        console.log(`[SelectFinalAgent] voteCounts:`, voteCounts);
        // Find the agent with the highest vote count
        let selectedAgent: AgentInstance | undefined = undefined;
        let maxVotes = -1;
        for (const agentId in voteCounts) {
            if (voteCounts[agentId] > maxVotes) {
                maxVotes = voteCounts[agentId];
                selectedAgent = this.agents.get(agentId);
            }
        }
        if (selectedAgent) {
            const agent = selectedAgent.getAgent();
            console.log(`[SelectFinalAgent] Selected agent: ${agent.id} (${agent.name})`);
        }
        else {
            console.log(`[SelectFinalAgent] No valid agent selected`);
        }
        return selectedAgent;
    }
}