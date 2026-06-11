// サーバ各モジュールが共有する依存の束。生成は index.ts（composition root 側）が行う。
import type { Server as SocketIOServer } from 'socket.io';
import type { YuiProtocolRouter } from '../kernel/router.js';
import type { DynamicDialogueRouter } from '../kernel/dynamic-router.js';
import type { InteractionLogger } from '../kernel/interaction-logger.js';
import type { SessionStorage } from '../kernel/session-storage.js';
import type { AgentManager } from '../kernel/services/agent-manager.js';

export interface ServerContext {
  io: SocketIOServer;
  realtimeRouter: YuiProtocolRouter;
  v2StatsRouter: DynamicDialogueRouter;
  interactionLogger: InteractionLogger;
  sessionStorage: SessionStorage;
  agentManager: AgentManager;
}
