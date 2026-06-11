// 対話システムの層間契約（ポート定義）。
// orchestration層（ルーター）はエージェント具象型ではなくここで定義されたポートに依存する。
// composition root（src/bootstrap/）が具象実装を供給する。
import type { Agent, AgentInstance, DialogueStage, IndividualThought, Language, Message } from '../types/index.js';
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
   */
  executeWithPersonality(
    prompt: string,
    stage: DialogueStage,
    operationName: string,
    language: Language,
    fallbackSessionId?: string
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
