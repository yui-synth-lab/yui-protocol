// composition root: 具象クラスの生成と配線をここに集約する。
// kernel（orchestration）はエージェント具象を知らず、server はここを経由して構築する。
import { createLogger } from '../utils/logger.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { AgentManager } from '../kernel/services/agent-manager.js';
import { DynamicDialogueRouter } from '../kernel/dynamic-router.js';
import { SessionStorage } from '../kernel/session-storage.js';
import { OutputStorage, OutputSavedEvent } from '../kernel/output-storage.js';
import { RAGRetriever } from '../kernel/rag/rag-retriever.js';
import { getRAGManager } from '../kernel/rag/rag-manager.js';
import { FacilitatorAgent } from '../agents/facilitator-agent.js';
import { createDefaultAgentFactories } from '../agents/registry.js';
import type { DialogueAgent, DialogueEventSink } from '../dialogue/contracts.js';

/** 既定の5エージェント構成で AgentManager を構築する */
export function createDefaultAgentManager(interactionLogger?: InteractionLogger): AgentManager {
  return new AgentManager(interactionLogger, createDefaultAgentFactories());
}

/** v2.0 動的対話ルーターを構築する（ファシリテーターを注入） */
export function createDynamicRouter(
  sessionStorage: SessionStorage,
  wsEmitter?: DialogueEventSink,
  ragRetriever?: RAGRetriever,
  interactionLogger?: InteractionLogger
): DynamicDialogueRouter {
  return new DynamicDialogueRouter(
    sessionStorage,
    wsEmitter,
    ragRetriever,
    new FacilitatorAgent(undefined, interactionLogger)
  );
}

/** セッション参加エージェントを収集し sessionId を設定する（v2 対話の準備） */
export function collectDialogueAgents(agentManager: AgentManager, sessionId: string): Record<string, DialogueAgent> {
  const agents: Record<string, DialogueAgent> = {};
  for (const agentConfig of agentManager.getAvailableAgents()) {
    const instance = agentManager.getAgent(agentConfig.id);
    if (instance) {
      instance.setSessionId(sessionId);
      agents[agentConfig.id] = instance as unknown as DialogueAgent;
    }
  }
  return agents;
}

const log = createLogger('Bootstrap/RAG');

/**
 * 出力保存後の RAG 自動インデックス（旧 OutputStorage 内蔵ロジック）。
 * ストレージ層は RAG を知らず、composition root がこのリスナーで配線する。
 * インデックス失敗は警告に留め、保存自体には影響させない。
 */
export async function ragAutoIndexListener(event: OutputSavedEvent): Promise<void> {
  const ragManager = getRAGManager();

  // RAGが有効でない場合はスキップ
  if (!ragManager.isReady()) {
    return;
  }

  const stats = await ragManager.getStats();

  // outputs のインデックス化
  if (stats.config.indexing.autoIndexOutputs) {
    const retriever = ragManager.getRetriever();
    if (retriever) {
      try {
        log.info(`🔍 Auto-indexing to RAG: ${event.filepath}`);
        const chunksIndexed = await retriever.indexLocalDocuments([event.filepath]);
        log.info(`✓ Auto-indexed ${chunksIndexed} chunks to RAG`);
      } catch (error) {
        log.warn('⚠️  Failed to auto-index output to RAG:', error);
      }
    }
  } else {
    console.log('[Bootstrap/RAG] Auto-indexing outputs is disabled in config');
  }

  // セッションメッセージのインデックス化
  if (stats.config.indexing.autoIndexSessions && event.sessionMessages && event.sessionMessages.length > 0) {
    try {
      console.log(`[Bootstrap/RAG] 🔍 Auto-indexing session ${event.sessionId} to RAG`);
      const chunksIndexed = await ragManager.indexSessionMessages(event.sessionId, event.sessionMessages);
      if (chunksIndexed > 0) {
        console.log(`[Bootstrap/RAG] ✓ Auto-indexed ${chunksIndexed} chunks from session ${event.sessionId}`);
      }
    } catch (error) {
      console.warn('[Bootstrap/RAG] ⚠️  Failed to auto-index session to RAG:', error);
    }
  }
}

/** RAG 自動インデックス付きの OutputStorage を構築する */
export function createDefaultOutputStorage(outputDir?: string): OutputStorage {
  return new OutputStorage(outputDir ?? 'outputs', ragAutoIndexListener);
}
