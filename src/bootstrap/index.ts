// composition root: 具象クラスの生成と配線をここに集約する。
// kernel（orchestration）はエージェント具象を知らず、server はここを経由して構築する。
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { AgentManager } from '../kernel/services/agent-manager.js';
import { DynamicDialogueRouter } from '../kernel/dynamic-router.js';
import { SessionStorage } from '../kernel/session-storage.js';
import { RAGRetriever } from '../kernel/rag/rag-retriever.js';
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
