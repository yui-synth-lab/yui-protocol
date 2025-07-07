import { Agent, AgentInstance } from '../../types/index.js';
import { yuiAgent } from '../../agents/agent-yui.js';
import { YogaAgent } from '../../agents/agent-yoga.js';
import { KanshiAgent } from '../../agents/agent-kanshi.js';
import { HekitoAgent } from '../../agents/agent-hekito.js';
import { EiroAgent } from '../../agents/agent-eiro.js';
import { InteractionLogger } from '../interaction-logger.js';

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private interactionLogger: InteractionLogger;

  constructor(interactionLogger?: InteractionLogger) {
    this.interactionLogger = interactionLogger || new InteractionLogger();
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).map((instance) => instance.getAgent());
  }

  initializeAgents(): void {
    // 全てのエージェントを初期化
    this.agents.set('eiro-001', new EiroAgent(this.interactionLogger));
    this.agents.set('kanshi-001', new KanshiAgent(this.interactionLogger));
    this.agents.set('yoga-001', new YogaAgent(this.interactionLogger));
    this.agents.set('hekito-001', new HekitoAgent(this.interactionLogger));
    this.agents.set('yui-000', new yuiAgent(this.interactionLogger));    
    console.log(`[AgentManager] Initialized ${this.agents.size} agents`);
  }
} 