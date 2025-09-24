import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';

describe('Multiple Finalizer Selection', () => {
  let facilitator: FacilitatorAgent;

  beforeEach(() => {
    facilitator = new FacilitatorAgent('test-session');
  });

  describe('analyzeFinalizeVotes', () => {
    test('should return single winner when clear majority', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Best logical analysis' },
        { agentId: 'agent2', voteFor: 'eiro-001', voteReasoning: 'Strong reasoning' },
        { agentId: 'agent3', voteFor: 'kanshi-001', voteReasoning: 'Good perspective' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001', 'yui-000'];

      // Mock AI executor to return single winner
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({
          content: 'eiro-001'
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001']);
    });

    test('should return multiple winners for tie votes', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Excellent analysis' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Critical thinking' },
        { agentId: 'agent3', voteFor: 'eiro-001', voteReasoning: 'Logical approach' },
        { agentId: 'agent4', voteFor: 'kanshi-001', voteReasoning: 'Sharp insights' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001', 'yui-000'];

      // Mock AI executor to return comma-separated winners
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({
          content: 'eiro-001,kanshi-001'
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001', 'kanshi-001']);
      expect(result.length).toBe(2);
    });

    test('should fallback to highest vote count when AI selection is invalid', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good analysis' },
        { agentId: 'agent2', voteFor: 'eiro-001', voteReasoning: 'Strong logic' },
        { agentId: 'agent3', voteFor: 'kanshi-001', voteReasoning: 'Critical view' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001', 'yui-000'];

      // Mock AI executor to return invalid agent
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({
          content: 'invalid-agent'
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001']); // Highest vote count
    });

    test('should handle tie votes in fallback scenario', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Logic' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Critical' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001', 'yui-000'];

      // Mock AI executor to throw error (trigger fallback)
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('AI failed'))
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001', 'kanshi-001']); // Both tied winners
      expect(result.length).toBe(2);
    });

    test('should trim whitespace from AI response', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI executor with whitespace
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({
          content: '  eiro-001, kanshi-001  '
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001', 'kanshi-001']);
    });

    test('should filter out invalid agent IDs from AI response', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI executor with mix of valid/invalid IDs
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({
          content: 'eiro-001,invalid-agent,kanshi-001'
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001', 'kanshi-001']);
    });
  });
});