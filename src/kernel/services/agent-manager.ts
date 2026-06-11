import { Agent, AgentInstance } from '../../types/index.js';
import { InteractionLogger } from '../interaction-logger.js';
import { getRAGManager } from '../rag/rag-manager.js';
import { RAGRetriever } from '../rag/rag-retriever.js';
import type { AgentFactory } from '../../dialogue/contracts.js';

/**
 * エージェントのライフサイクル管理。
 * 具象エージェントクラスは import しない — ファクトリは composition root
 * （src/bootstrap/ + src/agents/registry.ts）から注入される。
 */
export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private interactionLogger: InteractionLogger;
  private factories: AgentFactory[];
  private ragRetriever: RAGRetriever | null = null;

  constructor(interactionLogger?: InteractionLogger, factories: AgentFactory[] = []) {
    this.interactionLogger = interactionLogger || new InteractionLogger();
    this.factories = factories;
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).map((instance) => instance.getAgent());
  }

  async initializeAgents(): Promise<void> {
    if (this.factories.length === 0) {
      console.warn('[AgentManager] No agent factories provided — no agents registered. Use createDefaultAgentManager() from src/bootstrap.');
      return;
    }

    // RAGマネージャーを初期化してRetrieverを取得
    try {
      const ragManager = getRAGManager();
      await ragManager.initialize();
      this.ragRetriever = ragManager.getRetriever();
      if (this.ragRetriever) {
        console.log('[AgentManager] RAG system initialized successfully');
      } else {
        console.log('[AgentManager] RAG system not available (disabled or failed to initialize)');
      }
    } catch (error) {
      console.warn('[AgentManager] Failed to initialize RAG system:', error);
      this.ragRetriever = null;
    }

    // 全てのエージェントを初期化（RAGRetrieverを渡す）
    for (const factory of this.factories) {
      this.agents.set(factory.id, factory.create(this.interactionLogger, this.ragRetriever));
    }
    console.log(`[AgentManager] Initialized ${this.agents.size} agents${this.ragRetriever ? ' with RAG support' : ''}`);
  }
}
