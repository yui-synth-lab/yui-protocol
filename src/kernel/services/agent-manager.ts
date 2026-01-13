import { Agent, AgentInstance } from '../../types/index.js';
import { YuiAgent } from '../../agents/agent-yui.js';
import { YogaAgent } from '../../agents/agent-yoga.js';
import { KanshiAgent } from '../../agents/agent-kanshi.js';
import { HekitoAgent } from '../../agents/agent-hekito.js';
import { EiroAgent } from '../../agents/agent-eiro.js';
import { InteractionLogger } from '../interaction-logger.js';
import { getRAGManager } from '../rag/rag-manager.js';
import { RAGRetriever } from '../rag/rag-retriever.js';

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private interactionLogger: InteractionLogger;
  private ragRetriever: RAGRetriever | null = null;

  constructor(interactionLogger?: InteractionLogger) {
    this.interactionLogger = interactionLogger || new InteractionLogger();
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).map((instance) => instance.getAgent());
  }

  async initializeAgents(): Promise<void> {
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
    this.agents.set('eiro-001', new EiroAgent(this.interactionLogger, this.ragRetriever));
    this.agents.set('kanshi-001', new KanshiAgent(this.interactionLogger, this.ragRetriever));
    this.agents.set('yoga-001', new YogaAgent(this.interactionLogger, this.ragRetriever));
    this.agents.set('hekito-001', new HekitoAgent(this.interactionLogger, this.ragRetriever));
    this.agents.set('yui-000', new YuiAgent(this.interactionLogger, this.ragRetriever));
    console.log(`[AgentManager] Initialized ${this.agents.size} agents${this.ragRetriever ? ' with RAG support' : ''}`);
  }
} 