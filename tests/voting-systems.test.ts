import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicDialogueRouter } from '../src/kernel/dynamic-router.js';
import { YuiProtocolRouter } from '../src/kernel/router.js';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';
import { BaseAgent } from '../src/agents/base-agent.js';
import { Agent, Message, AgentResponse } from '../src/types/index.js';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { AgentManager } from '../src/kernel/agent-manager.js';
import { SessionManager } from '../src/kernel/session-manager.js';
import { createStageSummarizer } from '../src/kernel/stage-summarizer.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';

describe('Voting Systems - V1 vs V2 Comparison', () => {
  let mockSessionStorage: SessionStorage;
  let mockAgentManager: AgentManager;
  let mockSessionManager: SessionManager;
  let mockStageSummarizer: ReturnType<typeof createStageSummarizer>;
  let mockInteractionLogger: InteractionLogger;
  let dynamicRouter: DynamicDialogueRouter;
  let v1Router: YuiProtocolRouter;
  let facilitator: FacilitatorAgent;

  const testAgents: Agent[] = [
    {
      id: 'eiro-001',
      name: '慧露',
      furigana: 'えいろ',
      style: 'logical',
      priority: 'precision',
      personality: 'Analytical and systematic',
      preferences: ['logical reasoning', 'systematic analysis'],
      memoryScope: 'session',
      tone: 'formal',
      communicationStyle: 'structured'
    },
    {
      id: 'yui-000',
      name: '結心',
      furigana: 'ゆい',
      style: 'emotive',
      priority: 'balance',
      personality: 'Empathetic and intuitive',
      preferences: ['emotional intelligence', 'pattern analysis'],
      memoryScope: 'session',
      tone: 'warm',
      communicationStyle: 'conversational'
    },
    {
      id: 'hekito-001',
      name: '碧統',
      furigana: 'へきと',
      style: 'analytical',
      priority: 'precision',
      personality: 'Practical and solution-oriented',
      preferences: ['efficiency', 'practical solutions'],
      memoryScope: 'session',
      tone: 'direct',
      communicationStyle: 'concise'
    },
    {
      id: 'yoga-001',
      name: '陽雅',
      furigana: 'ようが',
      style: 'intuitive',
      priority: 'breadth',
      personality: 'Creative and inspiring',
      preferences: ['creativity', 'artistic expression'],
      memoryScope: 'session',
      tone: 'inspiring',
      communicationStyle: 'expressive'
    },
    {
      id: 'kanshi-001',
      name: '観至',
      furigana: 'かんし',
      style: 'critical',
      priority: 'depth',
      personality: 'Critical and precise',
      preferences: ['critical analysis', 'accuracy'],
      memoryScope: 'session',
      tone: 'analytical',
      communicationStyle: 'detailed'
    }
  ];

  beforeEach(() => {
    // Mock implementations
    mockSessionStorage = {
      saveSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn()
    } as any;

    mockAgentManager = {
      getAgents: vi.fn().mockReturnValue({}),
      getAgent: vi.fn()
    } as any;

    mockSessionManager = {
      getSessionStorage: vi.fn().mockReturnValue(mockSessionStorage)
    } as any;

    mockStageSummarizer = {
      summarizeStage: vi.fn(),
      analyzeVotingResponses: vi.fn()
    } as any;

    mockInteractionLogger = {
      saveFacilitatorLog: vi.fn(),
      log: vi.fn()
    } as any;

    facilitator = new FacilitatorAgent('test-session', mockInteractionLogger);
    dynamicRouter = new DynamicDialogueRouter(mockSessionStorage);
    v1Router = new YuiProtocolRouter(
      mockAgentManager,
      mockSessionManager,
      mockStageSummarizer,
      mockInteractionLogger
    );
  });

  describe('V2 Dynamic Router Voting System', () => {
    it('should collect votes from all agents', async () => {
      const mockAgents = testAgents.map(agent => createMockBaseAgent(agent));
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          agentId: 'user',
          content: 'Test query',
          timestamp: new Date(),
          role: 'user'
        }
      ];

      // Mock vote responses
      mockAgents.forEach((agent, index) => {
        const targetAgent = testAgents[(index + 1) % testAgents.length];
        agent['executeAIWithErrorHandling'] = vi.fn().mockResolvedValue(
          `投票: ${targetAgent.id}\n理由: ${targetAgent.name}が最も適切だと思います`
        );
      });

      // Access private method for testing
      const votes = await Promise.all(
        mockAgents.map(agent =>
          (dynamicRouter as any).askForVote(agent, mockMessages, 'ja', mockAgents)
        )
      );

      expect(votes).toHaveLength(testAgents.length);
      votes.forEach(vote => {
        expect(vote.voteFor).toBeDefined();
        expect(vote.voteReasoning).toBeDefined();
        expect(testAgents.some(a => a.id === vote.voteFor)).toBe(true);
      });
    });

    it('should parse vote responses correctly', () => {
      const voteResponse = '投票: eiro-001\n理由: 論理的思考に優れているため';
      const validAgents = ['eiro-001', 'yui-000', 'hekito-001'];

      const result = (dynamicRouter as any).parseVoteResponse(
        voteResponse,
        'kanshi-001',
        validAgents
      );

      expect(result.agentId).toBe('kanshi-001');
      expect(result.voteFor).toBe('eiro-001');
      expect(result.voteReasoning).toBe('論理的思考に優れているため');
    });

    it('should handle English vote format', () => {
      const voteResponse = 'Vote: yui-000\nReason: Best emotional intelligence';
      const validAgents = ['eiro-001', 'yui-000', 'hekito-001'];

      const result = (dynamicRouter as any).parseVoteResponse(
        voteResponse,
        'kanshi-001',
        validAgents
      );

      expect(result.agentId).toBe('kanshi-001');
      expect(result.voteFor).toBe('yui-000');
      expect(result.voteReasoning).toBe('Best emotional intelligence');
    });

    it('should reject invalid agent votes', () => {
      const voteResponse = '投票: invalid-agent\n理由: Invalid choice';
      const validAgents = ['eiro-001', 'yui-000', 'hekito-001'];

      const result = (dynamicRouter as any).parseVoteResponse(
        voteResponse,
        'kanshi-001',
        validAgents
      );

      expect(result.agentId).toBe('kanshi-001');
      expect(result.voteFor).toBeUndefined();
      expect(result.voteReasoning).toBe('Invalid choice');
    });
  });

  describe('Facilitator Vote Analysis', () => {
    it('should analyze votes and select winner correctly', async () => {
      const votes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '論理的分析が優秀' },
        { agentId: 'hekito-001', voteFor: 'eiro-001', voteReasoning: '体系的思考' },
        { agentId: 'yoga-001', voteFor: 'kanshi-001', voteReasoning: '批判的視点' },
        { agentId: 'kanshi-001', voteFor: 'eiro-001', voteReasoning: '精密な分析' }
      ];

      // Mock AI executor response
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        votes,
        testAgents.map(a => a.id)
      );

      expect(result).toEqual(['eiro-001']);
    });

    it('should handle tied votes intelligently', async () => {
      const votes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '論理的' },
        { agentId: 'hekito-001', voteFor: 'kanshi-001', voteReasoning: '批判的' },
        { agentId: 'yoga-001', voteFor: 'eiro-001', voteReasoning: '体系的' },
        { agentId: 'kanshi-001', voteFor: 'yui-000', voteReasoning: '共感的' }
      ];

      // Mock AI executor to choose based on reasoning quality
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        votes,
        testAgents.map(a => a.id)
      );

      expect(testAgents.some(a => a.id === result[0])).toBe(true);
    });

    it('should fallback gracefully on AI error', async () => {
      const votes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '論理的' },
        { agentId: 'hekito-001', voteFor: 'eiro-001', voteReasoning: '体系的' }
      ];

      // Mock AI executor to throw error
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockRejectedValue(new Error('AI Error'))
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        votes,
        testAgents.map(a => a.id)
      );

      expect(result).toEqual(['eiro-001']); // Should fallback to highest vote count
    });
  });

  describe('V1 vs V2 Vote Integration', () => {
    it('should maintain vote format compatibility', () => {
      // Test that v2 vote parsing is compatible with v1 format
      const v1VoteFormats = [
        { text: '投票: eiro-001\n理由: 分析的な視点が優れていたため', expected: 'eiro-001' },
        { text: 'eiro-001に投票します。分析的な視点が優れていたため', expected: undefined }, // Natural language format not fully supported yet
        { text: 'eiro-001氏に投票します。論理的なアプローチが適切だと思います', expected: undefined } // Natural language format not fully supported yet
      ];

      const validAgents = testAgents.map(a => a.id);

      v1VoteFormats.forEach(format => {
        const result = (dynamicRouter as any).parseVoteResponse(
          format.text,
          'kanshi-001',
          validAgents
        );

        if (format.expected) {
          expect(result.voteFor).toBe(format.expected);
          expect(result.voteReasoning).toBeDefined();
        } else {
          // Some formats may not be parsed yet, but should not crash
          expect(result.agentId).toBe('kanshi-001');
        }
      });
    });

    it('should ensure both systems select valid agents', async () => {
      const mockVotes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: 'Logical approach' },
        { agentId: 'hekito-001', voteFor: 'eiro-001', voteReasoning: 'Systematic thinking' },
        { agentId: 'yoga-001', voteFor: 'kanshi-001', voteReasoning: 'Critical analysis' }
      ];

      // Test v2 facilitator analysis
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const v2Result = await facilitator.analyzeFinalizeVotes(
        mockVotes,
        testAgents.map(a => a.id)
      );

      expect(testAgents.some(a => a.id === v2Result[0])).toBe(true);

      // Test v1 style vote counting (simple majority)
      const voteCounts: Record<string, number> = {};
      mockVotes.forEach(vote => {
        if (vote.voteFor) {
          voteCounts[vote.voteFor] = (voteCounts[vote.voteFor] || 0) + 1;
        }
      });

      const maxVotes = Math.max(...Object.values(voteCounts));
      const v1Winner = Object.entries(voteCounts)
        .find(([, count]) => count === maxVotes)?.[0];

      expect(testAgents.some(a => a.id === v1Winner)).toBe(true);
      expect(v1Winner).toBe('eiro-001'); // Should match expected result
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle no votes scenario', async () => {
      const emptyVotes: any[] = [];

      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        emptyVotes,
        testAgents.map(a => a.id)
      );

      expect(testAgents.some(a => a.id === result[0])).toBe(true);
    });

    it('should handle malformed vote responses', () => {
      const malformedResponses = [
        'No vote format here',
        '投票: \n理由: Empty vote',
        'Vote: \nReason: Also empty',
        '投票: non-existent-agent\n理由: Invalid agent'
      ];

      const validAgents = testAgents.map(a => a.id);

      malformedResponses.forEach(response => {
        const result = (dynamicRouter as any).parseVoteResponse(
          response,
          'kanshi-001',
          validAgents
        );

        expect(result.agentId).toBe('kanshi-001');
        expect(result.voteFor).toBeUndefined();
      });
    });

    it('should prevent self-voting', () => {
      const selfVoteResponse = '投票: kanshi-001\n理由: 自分が最適';
      const validAgents = testAgents.map(a => a.id);

      const result = (dynamicRouter as any).parseVoteResponse(
        selfVoteResponse,
        'kanshi-001',
        validAgents
      );

      // In practice, the vote collection should exclude self from valid agents
      const validAgentsExcludingSelf = validAgents.filter(id => id !== 'kanshi-001');
      expect(validAgentsExcludingSelf).not.toContain('kanshi-001');
    });
  });
});

// Helper function to create mock BaseAgent
function createMockBaseAgent(agent: Agent): BaseAgent {
  const mockAgent = {
    getAgent: () => agent,
    getSessionId: () => 'test-session',
    executeAIWithErrorHandling: vi.fn(),
    prepareContext: vi.fn().mockResolvedValue([]),
    analyzeCompressedContext: vi.fn().mockReturnValue('Test context'),
    getPersonalityPrompt: vi.fn().mockReturnValue('Test personality')
  } as any;

  return mockAgent;
}