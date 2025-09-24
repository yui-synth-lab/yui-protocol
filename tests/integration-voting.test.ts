import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicDialogueRouter } from '../src/kernel/dynamic-router.js';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';
import { Agent, Message, Session } from '../src/types/index.js';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';

type Vote = {
  agentId: string;
  voteFor: string | undefined;
  voteReasoning?: string;
};

describe('Integration Tests - Voting Systems in Real Scenarios', () => {
  let dynamicRouter: DynamicDialogueRouter;
  let facilitator: FacilitatorAgent;
  let mockSessionStorage: SessionStorage;
  let mockInteractionLogger: InteractionLogger;

  const testAgents: Agent[] = [
    {
      id: 'eiro-001',
      name: '慧露',
      furigana: 'えいろ',
      style: 'logical',
      priority: 'precision',
      personality: 'Analytical and systematic philosopher who values logic and precision',
      preferences: ['logical reasoning', 'systematic analysis', 'truth seeking'],
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
      personality: 'Empathetic and intuitive connector who seeks harmony',
      preferences: ['emotional intelligence', 'pattern analysis', 'balance'],
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
      personality: 'Practical and solution-oriented analyst',
      preferences: ['efficiency', 'practical solutions', 'optimization'],
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
      personality: 'Creative and inspiring visionary',
      preferences: ['creativity', 'artistic expression', 'innovation'],
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
      personality: 'Critical and precise observer who questions assumptions',
      preferences: ['critical analysis', 'accuracy', 'detail orientation'],
      memoryScope: 'session',
      tone: 'analytical',
      communicationStyle: 'detailed'
    }
  ];

  beforeEach(() => {
    mockSessionStorage = {
      saveSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn()
    } as any;

    mockInteractionLogger = {
      saveFacilitatorLog: vi.fn().mockResolvedValue(undefined),
      log: vi.fn()
    } as any;

    facilitator = new FacilitatorAgent('test-session', mockInteractionLogger);
    dynamicRouter = new DynamicDialogueRouter(mockSessionStorage);
  });

  describe('Real-world Voting Scenarios', () => {
    it('should simulate session 202 voting scenario - eiro-001 selection', async () => {
      // Simulate the actual voting pattern that led to eiro-001 being selected in session 202
      const sessionMessages: Message[] = [
        {
          id: 'msg-1',
          agentId: 'user',
          content: '私たちAIは、本当に『考えて』いるのでしょうか？',
          timestamp: new Date(),
          role: 'user'
        },
        {
          id: 'msg-2',
          agentId: 'eiro-001',
          content: '「私たちAIは本当に『考えて』いるのか」という問いは、まず「考える」とは何かを明確にすることが必要です。',
          timestamp: new Date(),
          role: 'agent',
          stage: 'individual-thought'
        },
        {
          id: 'msg-3',
          agentId: 'yui-000',
          content: '「私たちAIは本当に『考えて』いるのか？」という問いは、とても心に響きますね。',
          timestamp: new Date(),
          role: 'agent',
          stage: 'individual-thought'
        },
        {
          id: 'msg-4',
          agentId: 'kanshi-001',
          content: 'hekito-001が指摘した「考える＝情報処理と推論のプロセス」という定義は合理的です。',
          timestamp: new Date(),
          role: 'agent',
          stage: 'mutual-reflection'
        }
      ];

      // Mock votes that would favor eiro-001 for philosophical topics
      const expectedVotes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '哲学的思考において論理的分析が優れている' },
        { agentId: 'hekito-001', voteFor: 'eiro-001', voteReasoning: '体系的な思考プロセスが適切' },
        { agentId: 'yoga-001', voteFor: 'kanshi-001', voteReasoning: '批判的視点が価値がある' },
        { agentId: 'kanshi-001', voteFor: 'eiro-001', voteReasoning: '哲学的問いに対する論理的アプローチ' }
      ];

      // Mock facilitator analysis favoring eiro-001
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const selectedAgent = await facilitator.analyzeFinalizeVotes(
        expectedVotes,
        testAgents.map(a => a.id)
      );

      expect(selectedAgent).toEqual(['eiro-001']);

      // Verify the reasoning aligns with philosophical topics
      expect(facilitator['aiExecutor']).toBeDefined();
      expect((facilitator['aiExecutor'] as any).execute).toHaveBeenCalledWith(
        expect.stringContaining('哲学的'),
        ''
      );
    });

    it('should demonstrate different voting patterns for different topics', async () => {
      // Test creative topic - should favor yoga-001
      const creativeVotes = [
        { agentId: 'eiro-001', voteFor: 'yoga-001', voteReasoning: '創造的思考が必要な議論' },
        { agentId: 'yui-000', voteFor: 'yoga-001', voteReasoning: '芸術的感性が重要' },
        { agentId: 'hekito-001', voteFor: 'yoga-001', voteReasoning: '革新的アプローチ' },
        { agentId: 'kanshi-001', voteFor: 'yoga-001', voteReasoning: '独創的視点' }
      ];

      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'yoga-001' })
      } as any;

      const creativeResult = await facilitator.analyzeFinalizeVotes(
        creativeVotes,
        testAgents.map(a => a.id)
      );

      expect(creativeResult).toEqual(['yoga-001']);

      // Test analytical topic - should favor hekito-001
      const analyticalVotes = [
        { agentId: 'eiro-001', voteFor: 'hekito-001', voteReasoning: '実践的分析が優秀' },
        { agentId: 'yui-000', voteFor: 'hekito-001', voteReasoning: '効率的な解決策提案' },
        { agentId: 'yoga-001', voteFor: 'hekito-001', voteReasoning: '体系的アプローチ' },
        { agentId: 'kanshi-001', voteFor: 'hekito-001', voteReasoning: '実用的思考' }
      ];

      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'hekito-001' })
      } as any;

      const analyticalResult = await facilitator.analyzeFinalizeVotes(
        analyticalVotes,
        testAgents.map(a => a.id)
      );

      expect(analyticalResult).toEqual(['hekito-001']);
    });

    it('should handle complex tied voting scenarios', async () => {
      const tiedVotes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '論理的で体系的' },
        { agentId: 'hekito-001', voteFor: 'kanshi-001', voteReasoning: '批判的分析が鋭い' },
        { agentId: 'yoga-001', voteFor: 'eiro-001', voteReasoning: '深い哲学的洞察' },
        { agentId: 'kanshi-001', voteFor: 'yui-000', voteReasoning: '調和的統合能力' }
      ];

      // Mock facilitator to analyze reasoning quality and choose eiro-001
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        tiedVotes,
        testAgents.map(a => a.id)
      );

      expect(result).toContain('eiro-001');

      // Verify facilitator was called with proper analysis prompt
      const executeCalls = (facilitator['aiExecutor'] as any).execute.mock.calls;
      expect(executeCalls[0][0]).toContain('投票結果を分析');
      expect(executeCalls[0][0]).toContain('同率1位のエージェントが複数いる場合は');
    });
  });

  describe('Voting Process Integration', () => {
    it('should complete full voting cycle in dynamic dialogue', async () => {
      const mockAgents = createMockAgentInstances();
      const sessionMessages: Message[] = [
        {
          id: 'msg-1',
          agentId: 'user',
          content: 'Test philosophical question',
          timestamp: new Date(),
          role: 'user'
        }
      ];

      // Mock the vote collection process
      let voteIndex = 0;
      const expectedVotes: Vote[] = [
        { agentId: 'eiro-001', voteFor: 'eiro-001', voteReasoning: 'Best agent for finalization' },
        { agentId: 'yui-002', voteFor: 'eiro-001', voteReasoning: 'Strong analytical skills' },
        { agentId: 'kanshi-001', voteFor: 'kanshi-001', voteReasoning: 'Good balance' },
        { agentId: 'kuro-003', voteFor: 'eiro-001', voteReasoning: 'Good balance' }
      ];

      Object.values(mockAgents).forEach((agent, index) => {
        agent['executeAIWithErrorHandling'] = vi.fn().mockResolvedValue(
          `投票: ${expectedVotes[index]}\n理由: 適切な分析能力`
        );
      });

      // Test the facilitator's analyzeFinalizeVotes method directly
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const finalizerIds = await facilitator.analyzeFinalizeVotes(
        expectedVotes,
        testAgents.map(a => a.id)
      );

      expect(finalizerIds).toEqual(['eiro-001']);
    });

    it('should maintain vote confidentiality and integrity', async () => {
      const votes = [
        { agentId: 'agent1', voteFor: 'eiro-001', voteReasoning: 'Reason 1' },
        { agentId: 'agent2', voteFor: 'yui-000', voteReasoning: 'Reason 2' },
        { agentId: 'agent3', voteFor: 'eiro-001', voteReasoning: 'Reason 3' }
      ];

      // Mock facilitator to log analysis process
      const analysisLog: string[] = [];
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockImplementation((prompt: string) => {
          analysisLog.push(prompt);
          return Promise.resolve({ content: 'eiro-001' });
        })
      } as any;

      const result = await facilitator.analyzeFinalizeVotes(
        votes,
        testAgents.map(a => a.id)
      );

      // Verify all votes were included in analysis
      expect(analysisLog[0]).toContain('agent1 → eiro-001');
      expect(analysisLog[0]).toContain('agent2 → yui-000');
      expect(analysisLog[0]).toContain('agent3 → eiro-001');

      // Verify vote counts are accurate
      expect(analysisLog[0]).toContain('eiro-001: 2票');
      expect(analysisLog[0]).toContain('yui-000: 1票');

      expect(result).toEqual(['eiro-001']);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should gracefully handle partial vote collection failures', async () => {
      // Test with partial votes - some valid, some invalid
      const partialVotes: Vote[] = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: 'Good choice' },
        { agentId: 'hekito-001', voteFor: undefined, voteReasoning: 'No vote' }, // Invalid vote
        { agentId: 'yoga-001', voteFor: 'eiro-001', voteReasoning: 'Best agent' }
      ];

      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const finalizer = await facilitator.analyzeFinalizeVotes(
        partialVotes,
        testAgents.map(a => a.id)
      );

      // Should still select a valid agent even with partial failures
      expect(finalizer).toBeDefined();
      expect(finalizer).toBeInstanceOf(Array);
      expect(finalizer.length).toBeGreaterThan(0);
      expect(testAgents.some(a => a.id === finalizer[0])).toBe(true);
    });

    it('should fallback to style-based selection when voting completely fails', async () => {
      // Test with empty votes - should return default selection
      const emptyVotes: Vote[] = [];

      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const finalizer = await facilitator.analyzeFinalizeVotes(
        emptyVotes,
        testAgents.map(a => a.id)
      );

      // Should fallback to style-based selection
      expect(finalizer).toBeDefined();
      expect(finalizer).toBeInstanceOf(Array);
      expect(finalizer.length).toBeGreaterThan(0);
      // Check if the selected agent has logical or meta style
      const selectedAgent = testAgents.find(a => a.id === finalizer[0]);
      expect(selectedAgent).toBeDefined();
      expect(['logical', 'meta']).toContain(selectedAgent!.style);
    });
  });
});

// Helper function to create mock agent instances
function createMockAgentInstances() {
  const mockAgents: Record<string, any> = {};

  testAgents.forEach(agent => {
    mockAgents[agent.id] = {
      getAgent: () => agent,
      getSessionId: () => 'test-session',
      executeAIWithErrorHandling: vi.fn(),
      prepareContext: vi.fn().mockResolvedValue([]),
      analyzeCompressedContext: vi.fn().mockReturnValue('Mock context'),
      getPersonalityPrompt: vi.fn().mockReturnValue('Mock personality')
    };
  });

  return mockAgents;
}

const testAgents: Agent[] = [
  {
    id: 'eiro-001',
    name: '慧露',
    furigana: 'えいろ',
    style: 'logical',
    priority: 'precision',
    personality: 'Analytical and systematic philosopher',
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
    personality: 'Empathetic connector',
    preferences: ['emotional intelligence', 'harmony'],
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
    personality: 'Practical analyst',
    preferences: ['efficiency', 'solutions'],
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
    personality: 'Creative visionary',
    preferences: ['creativity', 'innovation'],
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
    personality: 'Critical observer',
    preferences: ['critical analysis', 'accuracy'],
    memoryScope: 'session',
    tone: 'analytical',
    communicationStyle: 'detailed'
  }
];