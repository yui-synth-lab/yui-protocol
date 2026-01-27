import { describe, it, expect } from 'vitest';
import { EiroAgent } from '../src/agents/agent-eiro';
import { YogaAgent } from '../src/agents/agent-yoga';
import { KanshiAgent } from '../src/agents/agent-kanshi';
import { HekitoAgent } from '../src/agents/agent-hekito';
import { YuiAgent } from '../src/agents/agent-yui';
import { InteractionLogger } from '../src/kernel/interaction-logger';

describe('Agent generation parameter calculation', () => {
  const interactionLogger = new InteractionLogger();
  const agents = [
    new YuiAgent(interactionLogger),
    new YogaAgent(interactionLogger),
    new EiroAgent(interactionLogger),
    new HekitoAgent(interactionLogger),
    new KanshiAgent(interactionLogger)
  ];

  it('should calculate parameters within valid ranges for all agents', () => {
    for (const agent of agents) {
      const params = agent.getGenerationParameters();
      expect(params.temperature).toBeGreaterThanOrEqual(0.1);
      expect(params.temperature).toBeLessThanOrEqual(1.0);
      expect(params.topP).toBeGreaterThanOrEqual(0.7);
      expect(params.topP).toBeLessThanOrEqual(1.0);
      expect(params.repetitionPenalty).toBeGreaterThanOrEqual(1.0);
      expect(params.repetitionPenalty).toBeLessThanOrEqual(1.3);
      expect(params.presencePenalty).toBeGreaterThanOrEqual(0.0);
      expect(params.presencePenalty).toBeLessThanOrEqual(0.2);
      expect(params.frequencyPenalty).toBeGreaterThanOrEqual(0.0);
      expect(params.frequencyPenalty).toBeLessThanOrEqual(0.2);
      expect(params.topK).toBeGreaterThanOrEqual(10);
      expect(params.topK).toBeLessThanOrEqual(100);
    }
  });

  it('should have different parameter profiles for different agent personalities', () => {
    const paramSets = agents.map(agent => agent.getGenerationParameters());
    // 少なくとも2つのエージェントでtemperatureが異なることを確認
    const uniqueTemperatures = new Set(paramSets.map(p => p.temperature));
    expect(uniqueTemperatures.size).toBeGreaterThan(1);
    // topKも同様
    const uniqueTopK = new Set(paramSets.map(p => p.topK));
    expect(uniqueTopK.size).toBeGreaterThan(1);
  });
}); 