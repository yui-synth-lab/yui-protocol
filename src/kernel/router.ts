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
  StageSummarizerOptions,
  Message,
  StageData,
  IndividualThought,
  Conflict,
  SynthesisData,
  FinalData,
  StageSummary,
  StageHistory,
  SynthesisAttempt,
  VotingResults
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
import { extractVoteDetails, getStagePrompt } from '../templates/prompts.js';
import { DynamicDialogueRouter } from './dynamic-router.js';

// ユーティリティ関数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Extract the voted agentId from content, using strict patterns and excluding self-votes.
 * Returns the voted agent's id if found and valid, otherwise null.
 */
export function extractVote(content: string, agents: Agent[], selfAgentId?: string): string | null {
  // Use the improved extractVoteDetails from prompts.ts
  // Pass agents information for better name-to-id mapping
  const details = extractVoteDetails(content, selfAgentId || '', agents);
  if (!details.votedAgent) return null;
  // Only allow exact match to an agent's id (case-insensitive)
  const voted = agents.find(a => a.id.toLowerCase() === details.votedAgent!.toLowerCase());
  if (!voted) return null;
  // Exclude self-votes
  if (selfAgentId && voted.id.toLowerCase() === selfAgentId.toLowerCase()) return null;
  return voted.id;
}

// 投票集計関数
function tallyVotes(responses: AgentResponse[], agents: Agent[]): string[] {
  const votes: Record<string, number> = {};
  for (const agent of agents) {
    votes[agent.id] = 0;
  }
  for (const res of responses) {
    const vote = extractVote(res.content, agents, res.agentId);
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
  private delay: number;

  // Phase 4: v2.0 Dynamic Dialogue Support
  private dynamicRouter: DynamicDialogueRouter;
  private sessionStorage: SessionStorage;

  constructor(
    sessionStorage: SessionStorage,
    outputStorage: OutputStorage,
    interactionLogger: InteractionLogger,
    stageSummarizerOptions: StageSummarizerOptions,
    delay: number,
    agentManager?: IAgentManager,
    sessionManager?: ISessionManager
  ) {
    this.outputStorage = outputStorage || new OutputStorage();
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.stageSummarizer = createStageSummarizer(stageSummarizerOptions);
    this.sessionStorage = sessionStorage;

    // delay設定の初期化（デフォルト値とマージ）
    this.delay = delay;

    // 依存性注入またはデフォルト作成
    this.agentManager = agentManager || new AgentManager(this.interactionLogger);
    this.sessionManager = sessionManager || new SessionManager(sessionStorage, this.agentManager);

    // エージェントの初期化（非同期、バックグラウンドで実行）
    this.agentManager.initializeAgents().catch((error) => {
      console.error('[YuiProtocolRouter] Failed to initialize agents:', error);
    });

    // 新しいダイナミックルーターを初期化
    this.dynamicRouter = new DynamicDialogueRouter(sessionStorage);
  }

  // IRealtimeRouter インターフェースの実装
  async executeStageRealtime(
    sessionId: string,
    userPrompt: string,
    stage: DialogueStage,
    language?: Language, // ← optionalにする
    onProgress?: ProgressCallback
  ): Promise<StageExecutionResult> {
    console.log(`[Router] executeStageRealtime called for session ${sessionId}, stage ${stage}, userPrompt: ${userPrompt}`);
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (stage === 'individual-thought' && session.status === 'completed') {
      session.sequenceNumber = (session.sequenceNumber || 0) + 1;
    }
    const stageStart = new Date();
    session.currentStage = stage;
    session.updatedAt = new Date();

    // 言語を決定（引数優先、なければセッション、なければ'en'）
    const effectiveLanguage = language || session.language || 'en';

    // エージェントのセットアップ
    this.setupAgentsForStage(session, sessionId, effectiveLanguage);

    // ユーザーメッセージの追加
    this.addUserMessageIfNeeded(session, userPrompt, stage);

    // 実際のエージェントレスポンス生成
    const { responses, agentResponses } = await this.generateAgentResponses(session, stage, userPrompt, '', session.messages, onProgress);

    // ステージ履歴の更新
    await this.updateSessionStageHistory(session, stage, responses, stageStart);

    // Generate stage summary (delayed execution) - skip for 'finalize' and 'output-generation' stages
    if (stage !== 'finalize' && stage !== 'output-generation') {
      console.log(`[Router] Setting up stage summary generation for ${stage} in session ${sessionId} with delay ${this.delay}ms`);
      await sleep(this.delay);

      console.log(`[Router] Starting stage summary generation for ${stage} in session ${sessionId}`);
      try {
        const stageMessages = session.messages.filter(msg => msg.stage === stage && msg.role === 'agent' && msg.sequenceNumber === session.sequenceNumber);
        console.log(`[Router] Found ${stageMessages.length} agent messages for stage ${stage}`);
        if (stageMessages.length > 0) {
          console.log(`[Router] Calling stageSummarizer.summarizeStage for ${stage}`);
          const stageSummary = await this.stageSummarizer.summarizeStage(
            stage,
            stageMessages,
            session.agents,
            sessionId,
            effectiveLanguage
          );

          console.log(`[Router] Stage summary generated successfully for ${stage}`);

          // サマリーをセッションに保存
          if (!session.stageSummaries) {
            session.stageSummaries = [];
          }
          stageSummary.sequenceNumber = session.sequenceNumber || 1;
          session.stageSummaries.push(stageSummary);

          // システムメッセージとしてmessagesにも追加
          const summaryMessage: Message = {
            id: uuidv4(),
            agentId: 'system',
            content: `${stage} summary:\n${this.formatStageSummary(stageSummary.summary)}`,
            timestamp: new Date(),
            role: 'system',
            stage: stage,
            sequenceNumber: session.sequenceNumber || 1
          };
          
          session.messages.push(summaryMessage);
          await this.sessionManager.saveSession(session);

          // UIに通知
          if (onProgress) {
            onProgress({ message: summaryMessage });
          }

          console.log(`[Router] Generated stage summary for ${stage} in session ${sessionId}`);
        } else {
          console.log(`[Router] No agent messages found for stage ${stage}, skipping summary generation`);
        }
      } catch (error) {
        console.error(`[Router] Error generating stage summary for ${stage}:`, error);
      }
    } else {
      console.log(`[Router] Skipping stage summary generation for finalize stage`);
    }

    // output-generationステージが完了した場合、AIベースの投票解析を最初に実行
    if (stage === 'output-generation' && responses.length > 0) {
      // ★ 修正: voteAnalysisをtry-catchの外で宣言
      let voteAnalysis: any = undefined;
      try {
        await sleep(this.delay);
        console.log(`[Router] AI-based vote analysis delay: ${this.delay}ms`);
        console.log(`[Router] Starting AI-based vote analysis for ${responses.length} agents`);
        voteAnalysis = await this.stageSummarizer.analyzeVotes(
          responses,
          session.agents,
          sessionId,
          effectiveLanguage
        );
        // 投票解析結果をメッセージのメタデータに反映
        for (const analysis of voteAnalysis.voteAnalysis) {
          const message = session.messages.find(m => 
            m.agentId === analysis.agentId && 
            m.sequenceNumber === (session.sequenceNumber || 1) &&
            (m.stage === 'output-generation' || !m.stage) // stageフィールドが存在しない場合も含める
          );
          if (message) {
            if (!message.metadata) message.metadata = {};
            message.metadata.voteFor = analysis.votedAgent ?? undefined;
            message.metadata.voteReasoning = analysis.reasoning || undefined;
            console.log(`[Router] Updated vote for ${analysis.agentId}: ${analysis.votedAgent}`);
          } else {
            console.log(`[Router] Could not find message for ${analysis.agentId} in output-generation stage`);
          }
        }
        // システムメッセージとしてmessagesにも追加
        const summaryMessage: Message = {
          id: uuidv4(),
          agentId: 'system',
          content: `${stage} summary:\n${voteAnalysis.content}`,
          timestamp: new Date(),
          role: 'system',
          stage: stage,
          sequenceNumber: session.sequenceNumber || 1
        };
        session.messages.push(summaryMessage);
        await this.sessionManager.saveSession(session);
        // UIに通知
        if (onProgress) {
          onProgress({ message: summaryMessage });
        }
        console.log(`[Router] AI-based vote analysis completed for ${voteAnalysis.voteAnalysis.length} agents`);
      } catch (error) {
        console.error(`[Router] Error in AI-based vote analysis:`, error);
        // エラーが発生しても処理を継続
        voteAnalysis = { voteAnalysis: [] };
      }

      // --- ここから下はAI解析済みの投票情報で集計・summarizer選出・finalize ---
      const currentSequenceNumber = session.sequenceNumber || 1;
      console.log(`[Router] Processing voting results for final output generation (sequence ${currentSequenceNumber})`);
      // voteAnalysis.voteAnalysis を直接使って集計
      let voteCounts: Record<string, number> = {};
      let votes: { agentId: string, voteFor: string | undefined, voteReasoning?: string }[] = [];
      if (voteAnalysis && Array.isArray(voteAnalysis.voteAnalysis)) {
        for (const analysis of voteAnalysis.voteAnalysis) {
          if (analysis.votedAgent) {
            voteCounts[analysis.votedAgent] = (voteCounts[analysis.votedAgent] || 0) + 1;
            votes.push({ agentId: analysis.agentId, voteFor: analysis.votedAgent, voteReasoning: analysis.reasoning });
          }
        }
      }
      console.log(`[Router] Votes collected from AI vote analysis (${votes.length} votes):`, votes.map(v => `${v.agentId} → ${v.voteFor}`).join(', '));
      // 最大票数を取得
      const maxVote = Math.max(0, ...Object.values(voteCounts));
      // 最大票数の agentId をすべて取得
      let selectedAgentIds = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVote)
        .map(([agentId]) => agentId);
      if (selectedAgentIds.length === 0) {
        selectedAgentIds = ['yui-000']; // fallback
        console.log(`[Router] No votes found, selected agent defaults to: ${selectedAgentIds}`);
      } else {
        console.log(`[Router] Selected agent(s) for final output: ${selectedAgentIds}`);
      }
      if (selectedAgentIds.length > 0) {
        const finalOutputs: AgentResponse[] = []

        // 選ばれたエージェント全員で finalize を実行
        for (const selectedAgentId of selectedAgentIds) {
          const selectedAgent = session.agents.find(agent => agent.id === selectedAgentId);
          if (selectedAgent) {
            const agentInstance = this.agentManager.getAgent(selectedAgentId);
            if (agentInstance) {
              agentInstance.setIsSummarizer(true);
              // 投票結果をVotingResults形式に変換
              const votingResults: VotingResults = {};
              votes.forEach(vote => {
                if (vote.voteFor) {
                  votingResults[vote.agentId] = vote.voteFor;
                }
              });
              // 最終出力を生成
              await sleep(this.delay);
              console.log(`[Router] Finalize delay: ${this.delay}ms`);
              const finalOutput = await agentInstance.stage5_1Finalize(votingResults, responses, session.messages, session.language || 'ja');
              finalOutputs.push(finalOutput);
              // 最終出力をメッセージとして追加
              const finalMessage: Message = {
                id: uuidv4(),
                agentId: selectedAgentId,
                content: finalOutput.content,
                timestamp: new Date(),
                role: 'agent',
                stage: 'finalize',
                sequenceNumber: session.sequenceNumber || 1,
                metadata: {
                  reasoning: finalOutput.reasoning,
                  confidence: finalOutput.confidence,
                  stageData: finalOutput.stageData
                }
              };
              session.messages.push(finalMessage);
              // UIに通知
              if (onProgress) {
                onProgress({ message: finalMessage });
              }
              console.log(`[Router] Final output generated by ${selectedAgentId}`);
            }
          }
        }
        // finalize 実行後に status, currentStage を更新
        session.status = 'completed';
        session.currentStage = 'finalize';
        await this.sessionManager.saveSession(session);
        await this.saveFinalOutputIfNeeded(finalOutputs, session, sessionId, effectiveLanguage);
      }
    }

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

  async createSession(title: string, agentIds: string[], language: Language, version: '1.0' | '2.0' = '1.0'): Promise<Session> {
    return this.sessionManager.createSession(title, agentIds, language, version);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.deleteSession(sessionId);
  }

  async resetSession(sessionId: string): Promise<Session> {
    return this.sessionManager.resetSession(sessionId);
  }

  async startNewSequence(sessionId: string, userPrompt?: string): Promise<Session> {
    return this.sessionManager.startNewSequence(sessionId, userPrompt);
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
    console.log(`[Router][addUserMessageIfNeeded] existingUserMessage=${!!existingUserMessage}, userPrompt="${userPrompt}", sequenceNumber=${session.sequenceNumber}, stage=${stage}`);
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
      console.log(`[Router][addUserMessageIfNeeded] Added user message:`, userMessage);
    } else {
      console.log(`[Router][addUserMessageIfNeeded] Skipped adding user message (already exists for this sequence)`);
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
    // サマリーステージではエージェント応答を生成しない
    if (
      stage === 'mutual-reflection-summary' ||
      stage === 'conflict-resolution-summary' ||
      stage === 'synthesis-attempt-summary'
    ) {
      return { responses: [], agentResponses: [] };
    }

    // 前のステージのサマリーを取得
    const previousStageSummaries = this.getPreviousStageSummaries(session, stage);
    let summaryContext = '';
    if (previousStageSummaries.length > 0) {
      // AI出力（output/rawContent）をそのまま連結して文脈に挿入
      summaryContext = '\n\n前ステージの要約：\n' + previousStageSummaries.map(s => {
        // rawContentやoutputがあればそれを使う
        if ((s as any).rawContent) return (s as any).rawContent;
        if ((s as any).output) return (s as any).output;
        // なければpositionを連結
        return s.summary.map((item: any) => `- ${item.speaker}: ${item.position}`).join('\n');
      }).join('\n\n');
    }

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

    for (let i = 0; i < shuffledAgents.length; i++) {
      const agent = shuffledAgents[i];
      const agentInstance = this.agentManager.getAgent(agent.id);
      console.log(`[Router][generateAgentResponses] agent=${agent.id}, agentInstance=${!!agentInstance}, stage=${stage}, userPrompt="${userPrompt}", sequenceNumber=${session.sequenceNumber}`);
      if (!agentInstance) {
        console.log(`[Router][generateAgentResponses] Skipping agent ${agent.id} (no instance)`);
        continue;
      }

      // --- finalizeステージはここで個別エージェント応答を生成しない ---
      if (stage === 'finalize') {
        console.log(`[Router][generateAgentResponses] Skipping agent response generation for finalize stage.`);
        continue;
      }
      // --- ここまで ---

      const interactionStart = new Date();
      let response;

      // ユーザークエリを必ずcontextに含める
      const userQueryMessage = {
        id: 'user-query',
        agentId: 'user',
        content: userPrompt,
        timestamp: new Date(),
        role: 'user' as const,
        stage: stage
      };
      const contextWithUser = [userQueryMessage, ...context];

      try {
        switch (stage) {
          case 'individual-thought': {
            if (i > 0) {
              const agentResponseDelay = this.delay
              await sleep(agentResponseDelay);
            }            
            // 前シーケンス情報を取得
            const { previousUserInput, previousAgentConclusions } = this.sessionManager.getPreviousSequenceInfo(session);
            // プロンプト生成
            const prompt = getStagePrompt(
              'individual-thought',
              {
                query: userPrompt,
                facts: '',
                previousInput: previousUserInput,
                previousConclusions: Object.values(previousAgentConclusions).join('\n')
              },
              session.language || 'ja'
            );
            const thought = await agentInstance.stage1IndividualThought(prompt, contextWithUser, session.language || 'ja');
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
            if (i > 0) {
              const agentResponseDelay = this.delay
              await sleep(agentResponseDelay);
            }        
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

            // userPromptを必ず渡す
            const reflection = await agentInstance.stage2MutualReflection(userPrompt, individualThoughtsForReflection, contextWithUser, session.agents, session.language || 'ja');
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
            if (i > 0) {
              const agentResponseDelay = this.delay
              await sleep(agentResponseDelay);
            }        
            const conflicts = this.identifyConflicts(session, session.language || 'ja');
            // contextWithUserを必ず渡す
            response = await agentInstance.stage3ConflictResolution(conflicts, contextWithUser, session.language || 'ja');
            break;
          }
          case 'synthesis-attempt': {
            if (i > 0) {
              const agentResponseDelay = this.delay
              await sleep(agentResponseDelay);
            }                    
            const synthesisData = this.prepareSynthesisData(session);
            response = await agentInstance.stage4SynthesisAttempt(synthesisData, contextWithUser, session.language || 'ja');
            break;
          }
          case 'output-generation': {
            if (i > 0) {
              const agentResponseDelay = this.delay
              await sleep(agentResponseDelay);
            }                    
            const finalData = this.prepareFinalData(session);
            response = await agentInstance.stage5OutputGeneration(finalData, contextWithUser, session.language || 'ja');
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
        console.log(`[Router][generateAgentResponses] Added agent message:`, message);

        if (onProgress)
          onProgress({ message: message });

        await this.sessionManager.saveSession(session);
        console.log(`[Router] Saved session with ${session.messages.length} messages`);
        agentResponses.push({ agentId: response.agentId, content: response.content });
        responses.push(response as AgentResponse);
        console.log(`[Router] Agent response generated for ${agent.id} in stage ${stage}:`, response);
      } catch (error) {
        console.log(`[Router][generateAgentResponses] Error for agent ${agent.id}:`, error);
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

    // Stage 2 (Mutual Reflection) の場合は、前のステージのサマリーは送信しない
    // 代わりに個々のエージェントの出力が送信される
    if (stage === 'mutual-reflection') {
      return [];
    }

    // 実際のステージサマリーを取得
    if (session.stageSummaries && session.stageSummaries.length > 0) {
      const previousSummaries = session.stageSummaries.filter(summary => 
        stageOrder.indexOf(summary.stage) < currentIndex && 
        summary.sequenceNumber === (session.sequenceNumber || 1)
      );
      
      // デバッグ用ログ（本番環境では削除）
      console.log(`Stage: ${stage}, Found ${previousSummaries.length} previous summaries:`, 
        previousSummaries.map(s => s.stage));
      
      return previousSummaries;
    }

    // フォールバック: ステージ履歴からダミーサマリーを生成
    return session.stageHistory
      .filter(history => stageOrder.indexOf(history.stage) < currentIndex)
      .map(history => ({
        stage: history.stage,
        summary: [{ speaker: 'system', position: 'No summary available' }],
        timestamp: history.startTime,
        stageNumber: stageOrder.indexOf(history.stage) + 1,
        sequenceNumber: session.sequenceNumber || 1
      }));
  }

  // サマリーを人が読めるテキストに整形する関数
  private formatStageSummary(summary: any): string {
    if (Array.isArray(summary)) {
      // 配列の場合: [{speaker: 'system', content: '...'}, ...]
      return summary.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const speaker = item.speaker ? `**${item.speaker}**: ` : '';
          const content = item.content || item.position || JSON.stringify(item);
          return `- ${speaker}${content}`;
        } else {
          return `- ${String(item)}`;
        }
      }).join('\n');
    } else if (typeof summary === 'object' && summary !== null) {
      // オブジェクトの場合: {speaker: 'system', content: '...'}
      const speaker = summary.speaker ? `**${summary.speaker}**: ` : '';
      const content = summary.content || summary.position || JSON.stringify(summary);
      return `- ${speaker}${content}`;
    } else {
      // その他の場合
      return `- ${String(summary)}`;
    }
  }

  private async saveFinalOutputIfNeeded(
    summaryList: AgentResponse[],
    session: Session,
    sessionId: string,
    language: Language
  ): Promise<void> {
    if (summaryList.length > 0) {
      const finalOutput = summaryList[summaryList.length - 1];
      if (finalOutput && finalOutput.content) {
        const currentSequenceNumber = session.sequenceNumber || 1;
        const savedOutput = await this.outputStorage.saveOutput(
          session.title,
          finalOutput.content,
          session.messages.find(m => m.role === 'user')?.content || '',
          language as Language,
          sessionId,
          finalOutput.agentId,
          currentSequenceNumber,
          session.messages
        );
        
        // シーケンスごとの出力ファイル名を管理
        if (!session.sequenceOutputFiles) {
          session.sequenceOutputFiles = {};
        }
        session.sequenceOutputFiles[currentSequenceNumber] = savedOutput.id + '.md';
        
        // 後方互換性のため、最新のシーケンスのファイル名を outputFileName にも設定
        session.outputFileName = savedOutput.id + '.md';
        
        await this.sessionManager.saveSession(session);
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
    // Stage 4 (synthesis-attempt) では、Stage 3のサマライズ出力のみを使用
    const stage3Summary = session.stageSummaries?.find(summary => 
      summary.stage === 'conflict-resolution' && 
      summary.sequenceNumber === (session.sequenceNumber || 1)
    );

    const individualThoughts: string[] = [];
    const mutualReflections: string[] = [];
    const conflictResolutions: string[] = [];

    // 実際のMutual Reflectionメッセージを取得
    const mutualReflectionMessages = session.messages
      .filter((m: Message) => m.stage === 'mutual-reflection' && m.role === 'agent')
      .map((m: Message) => `${m.agentId}: ${m.content}`);

    mutualReflections.push(...mutualReflectionMessages);

    if (stage3Summary) {
      // Stage 3のサマリーから情報を抽出
      conflictResolutions.push(
        `Stage 3 Summary:\n${stage3Summary.summary.map(item => `- **${item.speaker}**: ${item.position}`).join('\n')}`
      );
    }

    const userMessage = session.messages.find((m: Message) => m.role === 'user');
    const userPrompt = userMessage?.content || '';

    return {
      query: userPrompt,
      individualThoughts,
      mutualReflections,
      conflictResolutions,
      context: stage3Summary ? 
        `Stage 3 Summary:\n${stage3Summary.summary.map(item => `- **${item.speaker}**: ${item.position}`).join('\n')}` : 
        'No previous stage data available'
    };
  }

  private prepareFinalData(session: Session): FinalData {
    // Stage 5 (output-generation) では、Stage 4のサマライズ出力のみを使用
    const stage4Summary = session.stageSummaries?.find(summary => 
      summary.stage === 'synthesis-attempt' && 
      summary.sequenceNumber === (session.sequenceNumber || 1)
    );

    const individualThoughts: string[] = [];
    const mutualReflections: string[] = [];
    const conflictResolutions: string[] = [];
    const synthesisAttempts: string[] = [];

    // 実際のMutual Reflectionメッセージを取得
    const mutualReflectionMessages = session.messages
      .filter((m: Message) => m.stage === 'mutual-reflection' && m.role === 'agent')
      .map((m: Message) => `${m.agentId}: ${m.content}`);

    mutualReflections.push(...mutualReflectionMessages);

    if (stage4Summary) {
      // Stage 4のサマリーから情報を抽出
      synthesisAttempts.push(
        `Stage 4 Summary:\n${stage4Summary.summary.map(item => `- **${item.speaker}**: ${item.position}`).join('\n')}`
      );
    }

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
      context: stage4Summary ? 
        `Stage 4 Summary:\n${stage4Summary.summary.map(item => `- **${item.speaker}**: ${item.position}`).join('\n')}` : 
        'No previous stage data available'
    };
  }

  // テスト用のメソッド
  getAgentManager(): IAgentManager {
    return this.agentManager;
  }

  getSessionManager(): ISessionManager {
    return this.sessionManager;
  }

  // 新メソッド: v2.0エントリーポイント
  async startDynamicSession(
    prompt: string,
    sessionId: string,
    language: Language = 'en'
  ): Promise<Session> {
    console.log(`[YuiProtocolRouter] Starting dynamic session ${sessionId} with prompt: "${prompt}"`);

    // すべてのエージェントにセッションIDを設定
    const availableAgents = this.agentManager.getAvailableAgents();
    const agents: Record<string, any> = {};

    availableAgents.forEach(agentConfig => {
      const agentInstance = this.agentManager.getAgent(agentConfig.id);
      if (agentInstance) {
        agentInstance.setSessionId(sessionId);
        agents[agentConfig.id] = agentInstance;
      }
    });

    try {
      const session = await this.dynamicRouter.conductDynamicDialogue(
        prompt,
        agents,
        sessionId,
        language
      );

      console.log(`[YuiProtocolRouter] Dynamic session completed with ${session.messages?.length || 0} messages`);
      return session;
    } catch (error) {
      console.error(`[YuiProtocolRouter] Error in dynamic session:`, error);
      throw error;
    }
  }

  // WebSocket付きv2.0エントリーポイント
  async startDynamicSessionWithWebSocket(
    prompt: string,
    sessionId: string,
    language: Language = 'en',
    wsEmitter: (event: string, data: any) => void
  ): Promise<Session> {
    console.log(`[YuiProtocolRouter] Starting dynamic session with WebSocket ${sessionId}`);

    // WebSocket付きルーターを一時的に作成
    const sessionStorage = this.sessionManager.getSessionStorage();
    const dynamicRouterWithWS = new DynamicDialogueRouter(sessionStorage, wsEmitter);

    // すべてのエージェントにセッションIDを設定
    const availableAgents = this.agentManager.getAvailableAgents();
    const agents: Record<string, any> = {};

    availableAgents.forEach(agentConfig => {
      const agentInstance = this.agentManager.getAgent(agentConfig.id);
      if (agentInstance) {
        agentInstance.setSessionId(sessionId);
        agents[agentConfig.id] = agentInstance;
      }
    });

    try {
      const session = await dynamicRouterWithWS.conductDynamicDialogue(
        prompt,
        agents,
        sessionId,
        language
      );

      console.log(`[YuiProtocolRouter] Dynamic session with WebSocket completed`);
      return session;
    } catch (error) {
      console.error(`[YuiProtocolRouter] Error in dynamic session with WebSocket:`, error);
      throw error;
    }
  }

  // 統計情報の取得
  getDynamicDialogueStats() {
    return this.dynamicRouter.getDialogueStats();
  }

  // SessionStorageアクセサ（v2.0 API用）
  getSessionStorage(): SessionStorage {
    return this.sessionStorage;
  }
} 