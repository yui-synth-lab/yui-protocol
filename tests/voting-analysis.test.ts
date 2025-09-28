import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';

describe('Facilitator Voting Analysis', () => {
  let facilitator: FacilitatorAgent;

  beforeEach(() => {
    facilitator = new FacilitatorAgent('test-session');
  });

  describe('Vote Counting Logic', () => {
    test('should count votes correctly for single winner', () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Best analysis' },
        { agentId: 'agent2', voteFor: 'eiro-001', voteReasoning: 'Logical approach' },
        { agentId: 'agent3', voteFor: 'kanshi-001', voteReasoning: 'Critical thinking' }
      ];

      // Internal vote counting logic test
      const voteCounts: Record<string, number> = {};
      votes.forEach(vote => {
        if (vote.voteFor) {
          voteCounts[vote.voteFor] = (voteCounts[vote.voteFor] || 0) + 1;
        }
      });

      expect(voteCounts['eiro-001']).toBe(2);
      expect(voteCounts['kanshi-001']).toBe(1);

      const maxVotes = Math.max(...Object.values(voteCounts));
      expect(maxVotes).toBe(2);
    });

    test('should handle tie votes correctly', () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good logic' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Sharp analysis' },
        { agentId: 'agent3', voteFor: 'eiro-001', voteReasoning: 'Clear reasoning' },
        { agentId: 'agent4', voteFor: 'kanshi-001', voteReasoning: 'Critical perspective' }
      ];

      const voteCounts: Record<string, number> = {};
      votes.forEach(vote => {
        if (vote.voteFor) {
          voteCounts[vote.voteFor] = (voteCounts[vote.voteFor] || 0) + 1;
        }
      });

      const maxVotes = Math.max(...Object.values(voteCounts));
      const winners = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([agent]) => agent);

      expect(winners).toEqual(['eiro-001', 'kanshi-001']);
      expect(winners.length).toBe(2);
    });
  });

  describe('AI Analysis Integration', () => {
    test('should provide correct prompt format for AI analysis', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Excellent logical analysis throughout the discussion' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Provided critical perspectives that deepened our understanding' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001', 'yui-000'];

      let capturedPrompt: string = '';
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockImplementation(async (prompt: string) => {
          capturedPrompt = prompt;
          return { content: 'eiro-001' };
        })
      };

      await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(capturedPrompt).toContain('投票結果:');
      expect(capturedPrompt).toContain('agent1 → eiro-001: Excellent logical analysis');
      expect(capturedPrompt).toContain('agent2 → kanshi-001: Provided critical perspectives');
      expect(capturedPrompt).toContain('票数集計:');
      expect(capturedPrompt).toContain('eiro-001: 1票');
      expect(capturedPrompt).toContain('kanshi-001: 1票');
      expect(capturedPrompt).toContain('同率1位のエージェントが複数いる場合は、そのすべてのエージェントを選出');
    });

    test('should handle empty or invalid votes', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: undefined, voteReasoning: 'No clear choice' },
        { agentId: 'agent2', voteFor: '', voteReasoning: 'Abstain' },
        { agentId: 'agent3', voteFor: 'eiro-001', voteReasoning: 'Good choice' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual(['eiro-001']);
    });
  });

  describe('Prompt Engineering for Multiple Selection', () => {
    test('should instruct AI to select all tied winners', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Strong analysis' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Critical thinking' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      let capturedPrompt = '';
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockImplementation(async (prompt: string) => {
          capturedPrompt = prompt;
          return { content: 'eiro-001,kanshi-001' };
        })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      // Check prompt includes multiple selection instructions
      expect(capturedPrompt).toContain('同率1位のエージェントが複数いる場合は、そのすべてのエージェントを選出');
      expect(capturedPrompt).toContain('複数の場合はカンマ区切り');
      expect(capturedPrompt).toContain('例: "eiro-001,kanshi-001"');

      expect(result).toEqual(['eiro-001', 'kanshi-001']);
    });
  });

  describe('Fallback Logic', () => {
    test('should fall back to vote count when AI fails', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good' },
        { agentId: 'agent2', voteFor: 'eiro-001', voteReasoning: 'Better' },
        { agentId: 'agent3', voteFor: 'kanshi-001', voteReasoning: 'Also good' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI to fail
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('AI service down'))
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      // Should fallback to highest vote count (eiro-001: 2 votes)
      expect(result).toEqual(['eiro-001']);
    });

    test('should return all tied winners in fallback', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good' },
        { agentId: 'agent2', voteFor: 'kanshi-001', voteReasoning: 'Also good' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI to fail
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('Network error'))
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      // Should return both tied winners
      expect(result.sort()).toEqual(['eiro-001', 'kanshi-001']);
    });
  });

  describe('Edge Cases', () => {
    test('should handle no votes scenario', async () => {
      const votes: any[] = [];
      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI to return first agent
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('No votes to analyze'))
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      expect(result).toEqual([allAgentIds[0]]);
    });

    test('should validate agent IDs in AI response', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Good' }
      ];

      const allAgentIds = ['eiro-001', 'kanshi-001'];

      // Mock AI to return invalid ID
      (facilitator as any).aiExecutor = {
        execute: vi.fn().mockResolvedValue({ content: 'invalid-agent-id' })
      };

      const result = await facilitator.analyzeFinalizeVotes(votes, allAgentIds);

      // Should fallback to vote count
      expect(result).toEqual(['eiro-001']);
    });
  });
});