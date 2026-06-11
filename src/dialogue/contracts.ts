// 対話システムの層間契約（ポート定義）。
// orchestration層（ルーター）はエージェント具象型ではなくここで定義されたポートに依存する。
// composition root（src/bootstrap/）が具象実装を供給する。
import type { Agent, AgentInstance, DialogueStage, IndividualThought, Language, Message } from '../types/index.js';
import type { ConsensusIndicator, DialogueState, DynamicRound, FacilitatorAction, FacilitatorLog } from '../types/consensus.js';
import type { AIExecutor, AIExecutorOptions } from '../kernel/ai-executor.js';
import type { InteractionLogger } from '../kernel/interaction-logger.js';
import type { RAGRetriever } from '../kernel/rag/rag-retriever.js';

/**
 * v2.0 対話ルーターがエージェントに要求する操作の契約。
 * BaseAgent がこれを実装する。
 */
export interface DialogueAgent {
  getAgent(): Agent;
  getSessionId(): string | undefined;
  setSessionId(sessionId: string): void;
  stage1IndividualThought(prompt: string, context: Message[], language: Language): Promise<IndividualThought>;
  /**
   * 人格プロンプトを付与して自由形式プロンプトを実行する（v2ラウンド用の公開API）。
   * sessionId 未設定時は fallbackSessionId がログ用セッションIDとして使われる。
   * tier に 'mechanical'/'summary' を指定し config/v2-settings.json の modelTiers が
   * 設定されている場合、安価モデル＋短縮人格＋出力上限で実行される（コスト削減 M2/M3、オプトイン）。
   */
  executeWithPersonality(
    prompt: string,
    stage: DialogueStage,
    operationName: string,
    language: Language,
    fallbackSessionId?: string,
    tier?: TaskTier
  ): Promise<string>;
  /** ファイナライザ用モデル（高コスト枠）で実行する */
  executeWithFinalizerModel(
    prompt: string,
    customAgentId: string,
    stage: DialogueStage,
    operationName: string,
    language: Language,
    fallbackSessionId?: string
  ): Promise<string>;
}

/** エージェント生成のファクトリ契約。具象クラスの import は agents/registry.ts に集約する */
export interface AgentFactory {
  id: string;
  create(interactionLogger?: InteractionLogger, ragRetriever?: RAGRetriever | null): AgentInstance & DialogueAgent;
}

/**
 * タスク階層（コスト削減 M2 の基盤）。
 * - reasoning: エージェントの思考・対話・finalize（本体モデル）
 * - mechanical: コンセンサス確認・投票・発言順などの様式化タスク（安価モデル候補）
 * - summary: 要約・メモリ圧縮（安価モデル候補）
 */
export type TaskTier = 'reasoning' | 'mechanical' | 'summary';

/** AIExecutor 生成の契約。(agentId, tier, model) 単位でキャッシュされる（M8） */
export interface ExecutorFactory {
  getExecutor(agentId: string, options?: Partial<AIExecutorOptions>, tier?: TaskTier): Promise<AIExecutor>;
}

/** 対話イベントの送出先（WebSocket / SSE / テスト用 sink を差し替え可能にする） */
export type DialogueEventSink = (event: string, data: unknown) => void;

/**
 * v2.0 ルーターがファシリテーターに要求する操作の契約。
 * FacilitatorAgent がこれを実装する。
 */
export interface FacilitatorPort {
  setKnownAgents(agentIds: string[]): void;
  initializeSession(sessionId: string): void;
  determineInitialSpeakingOrder(
    query: string,
    agents: { id: string; name: string; style: string; expertise: string[] }[]
  ): Promise<string[]>;
  analyzeDialogueState(
    messages: Message[],
    consensusData: ConsensusIndicator[],
    roundNumber: number,
    originalQuery?: string
  ): Promise<DialogueState>;
  updateParticipationCount(participationMap: Map<string, number>): void;
  calculateOverallConsensus(indicators: ConsensusIndicator[]): number;
  recordRound(round: DynamicRound): void;
  logIntervention(action: FacilitatorAction, success: boolean, errorMessage?: string, agentResponses?: string[]): void;
  analyzeFinalizeVotes(
    votes: { agentId: string; voteFor: string | undefined; voteReasoning?: string }[],
    allAgentIds: string[],
    language?: 'ja' | 'en'
  ): Promise<string[]>;
  getAllLogs(): FacilitatorLog[];
  getDialogueStats(): Record<string, unknown>;
}
