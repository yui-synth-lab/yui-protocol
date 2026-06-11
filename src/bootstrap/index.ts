// composition root: 具象クラスの生成と配線をここに集約する。
// kernel（orchestration）はエージェント具象を知らず、server はここを経由して構築する。
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { AgentManager } from '../kernel/services/agent-manager.js';
import { createDefaultAgentFactories } from '../agents/registry.js';

/** 既定の5エージェント構成で AgentManager を構築する */
export function createDefaultAgentManager(interactionLogger?: InteractionLogger): AgentManager {
  return new AgentManager(interactionLogger, createDefaultAgentFactories());
}
