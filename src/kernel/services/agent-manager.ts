import { Agent, AgentInstance } from '../../types/index.js';
import { InteractionLogger } from '../interaction-logger.js';

export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private interactionLogger: InteractionLogger;

  constructor(interactionLogger: InteractionLogger) {
    this.interactionLogger = interactionLogger;
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).map((instance) => instance.getAgent());
  }

  initializeAgents(): void {
    // ここでエージェントインスタンスを初期化してthis.agentsにセットする
    // 例: this.agents.set('agent-id', new SomeAgentClass(...));
  }
} 