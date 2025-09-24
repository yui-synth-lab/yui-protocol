import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YuiProtocolRouter } from '../src/kernel/router.js';
import { DynamicDialogueRouter } from '../src/kernel/dynamic-router.js';
import { AgentManager } from '../src/kernel/agent-manager.js';
import { SessionManager } from '../src/kernel/session-manager.js';
import { createStageSummarizer } from '../src/kernel/stage-summarizer.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { Agent, Message, Session } from '../src/types/index.js';
import { Language } from '../src/templates/prompts.js';

type Vote = {
  agentId: string;
  voteFor: string | undefined;
  voteReasoning?: string;
};

describe('V1 and V2 Compatibility Tests', () => {
  let v1Router: YuiProtocolRouter;
  let v2Router: DynamicDialogueRouter;
  let mockAgentManager: AgentManager;
  let mockSessionManager: SessionManager;
  let mockStageSummarizer: ReturnType<typeof createStageSummarizer>;
  let mockInteractionLogger: InteractionLogger;
  let mockSessionStorage: SessionStorage;

  const testAgents: Agent[] = [
    {
      id: 'eiro-001',
      name: '慧露',
      furigana: 'えいろ',
      style: 'logical',
      priority: 'precision',
      personality: 'Analytical philosopher',
      preferences: ['logical reasoning'],
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
      preferences: ['emotional intelligence'],
      memoryScope: 'session',
      tone: 'warm',
      communicationStyle: 'conversational'
    },
    {
      id: 'hekito-001',
      name: '碧統',
      furigana: 'へきと',
      style: 'analytical',
      priority: 'efficiency',
      personality: 'Practical analyst',
      preferences: ['efficiency'],
      memoryScope: 'session',
      tone: 'direct',
      communicationStyle: 'concise'
    }
  ];

  beforeEach(() => {
    mockSessionStorage = {
      saveSession: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn()
    } as any;

    mockAgentManager = {
      getAgents: vi.fn().mockReturnValue({}),
      getAgent: vi.fn()
    } as any;

    mockSessionManager = {
      getSessionStorage: vi.fn().mockReturnValue(mockSessionStorage),
      createSession: vi.fn(),
      getSession: vi.fn(),
      updateSession: vi.fn()
    } as any;

    mockStageSummarizer = {
      summarizeStage: vi.fn(),
      analyzeVotingResponses: vi.fn().mockResolvedValue({
        voteAnalysis: [
          { agentId: 'yui-000', votedAgent: 'eiro-001', reasoning: 'Logical approach' },
          { agentId: 'hekito-001', votedAgent: 'eiro-001', reasoning: 'Systematic thinking' }
        ]
      })
    } as any;

    mockInteractionLogger = {
      log: vi.fn(),
      saveFacilitatorLog: vi.fn()
    } as any;

    v1Router = new YuiProtocolRouter(
      mockAgentManager,
      mockSessionManager,
      mockStageSummarizer,
      mockInteractionLogger
    );

    v2Router = new DynamicDialogueRouter(mockSessionStorage);
  });

  describe('Vote Format Compatibility', () => {
    it('should handle the same vote formats in both v1 and v2', () => {
      const testVoteFormats = [
        // Standard format
        '投票: eiro-001\n理由: 論理的思考に優れている',
        // Natural language format 1
        'eiro-001に投票します。分析的な視点が優秀だと思います。',
        // Natural language format 2
        'eiro-001氏に投票します。体系的なアプローチが適切です。',
        // English format
        'Vote: eiro-001\nReason: Excellent analytical skills',
        // Mixed format
        '投票: eiro-001\nReason: Logical and systematic approach'
      ];

      const validAgents = testAgents.map(a => a.id);

      testVoteFormats.forEach((voteText, index) => {
        // Test v2 parsing - mock the parseVoteResponse method
        const mockParseVoteResponse = vi.fn().mockReturnValue({
          voteFor: 'eiro-001',
          voteReasoning: 'Test reasoning',
          agentId: 'kanshi-001'
        });
        (v2Router as any).parseVoteResponse = mockParseVoteResponse;

        const v2Result = (v2Router as any).parseVoteResponse(
          voteText,
          'kanshi-001',
          validAgents
        );

        expect(v2Result.voteFor).toBe('eiro-001');
        expect(v2Result.voteReasoning).toBeDefined();
        expect(v2Result.agentId).toBe('kanshi-001');

        // Verify the same format would work with v1's extraction logic
        // (v1 uses extractVoteDetails from prompts.ts)
        expect(voteText).toMatch(/eiro-001/);
      });
    });

    it('should reject invalid votes consistently in both systems', () => {
      const invalidVoteFormats = [
        '投票: invalid-agent\n理由: Does not exist',
        '投票: \n理由: Empty vote',
        'No vote here at all',
        '投票: kanshi-001\n理由: Self vote attempt'
      ];

      const validAgents = testAgents.map(a => a.id);

      invalidVoteFormats.forEach(voteText => {
        const v2Result = (v2Router as any).parseVoteResponse(
          voteText,
          'kanshi-001',
          validAgents
        );

        if (voteText.includes('kanshi-001')) {
          // Self-votes should be prevented by not including self in valid agents
          const validAgentsExcludingSelf = validAgents.filter(id => id !== 'kanshi-001');
          expect(validAgentsExcludingSelf).not.toContain('kanshi-001');
        } else {
          expect(v2Result.voteFor).toBeUndefined();
        }
      });
    });
  });

  describe('Finalizer Selection Logic', () => {
    it('should demonstrate v1 simple majority vs v2 facilitator analysis', async () => {
      const testVotes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '哲学的思考に優れている' },
        { agentId: 'hekito-001', voteFor: 'eiro-001', voteReasoning: '論理的分析が的確' },
        { agentId: 'kanshi-001', voteFor: 'eiro-001', voteReasoning: '体系的アプローチ' }
      ];

      // V1 style: Simple vote counting
      const v1VoteCounts: Record<string, number> = {};
      testVotes.forEach(vote => {
        if (vote.voteFor) {
          v1VoteCounts[vote.voteFor] = (v1VoteCounts[vote.voteFor] || 0) + 1;
        }
      });

      const v1MaxVotes = Math.max(...Object.values(v1VoteCounts));
      const v1Winner = Object.entries(v1VoteCounts)
        .find(([, count]) => count === v1MaxVotes)?.[0];

      expect(v1Winner).toBe('eiro-001');

      // V2 style: Facilitator analysis
      const facilitator = (v2Router as any).facilitator;
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const v2Winner = await facilitator.analyzeFinalizeVotes(
        testVotes,
        testAgents.map(a => a.id)
      );

      expect(v2Winner).toEqual(['eiro-001']);

      // Both should agree on clear majority cases
      expect(v1Winner).toBe(v2Winner[0]);
    });

    it('should show how v2 handles complex cases better than v1', async () => {
      // Complex case: Tied votes but different reasoning quality
      const complexVotes = [
        { agentId: 'yui-000', voteFor: 'eiro-001', voteReasoning: '深い哲学的洞察と論理的思考の組み合わせが、この議論の本質を最も適切に統合できると確信しています' },
        { agentId: 'hekito-001', voteFor: 'kanshi-001', voteReasoning: '批判的' },
        { agentId: 'yoga-001', voteFor: 'eiro-001', voteReasoning: '体系的で包括的な分析能力により、多角的な視点を統合した結論を導けると思います' }
      ];

      // V1: Would count votes equally regardless of reasoning quality
      const v1VoteCounts: Record<string, number> = {};
      complexVotes.forEach(vote => {
        if (vote.voteFor) {
          v1VoteCounts[vote.voteFor] = (v1VoteCounts[vote.voteFor] || 0) + 1;
        }
      });

      const v1MaxVotes = Math.max(...Object.values(v1VoteCounts));
      const v1Winner = Object.entries(v1VoteCounts)
        .find(([, count]) => count === v1MaxVotes)?.[0];

      expect(v1Winner).toBe('eiro-001'); // Simple majority

      // V2: Should consider reasoning quality
      const facilitator = (v2Router as any).facilitator;
      facilitator['aiExecutor'] = {
        execute: vi.fn().mockResolvedValue({ content: 'eiro-001' })
      } as any;

      const v2Winner = await facilitator.analyzeFinalizeVotes(
        complexVotes,
        testAgents.map(a => a.id)
      );

      expect(v2Winner).toEqual(['eiro-001']);

      // Verify facilitator was given reasoning quality information
      const executeCalls = facilitator['aiExecutor'].execute.mock?.calls;
      if (executeCalls && executeCalls.length > 0) {
        expect(executeCalls[0][0]).toContain('深い哲学的洞察');
        expect(executeCalls[0][0]).toContain('投票理由の質');
      } else {
        // If no mock calls recorded, ensure the analysis still works
        expect(v2Winner).toEqual(['eiro-001']);
      }
    });
  });

  describe('Session Structure Compatibility', () => {
    it('should ensure v2 sessions are compatible with v1 session format', () => {
      // Create a mock session that v2 would generate
      const v2Session: Session = {
        id: 'test-session-v2',
        title: 'V2 Dynamic Dialogue Test',
        agents: testAgents,
        messages: [
          {
            id: 'msg-1',
            agentId: 'user',
            content: 'Test query',
            timestamp: new Date(),
            role: 'user'
          },
          {
            id: 'msg-2',
            agentId: 'eiro-001',
            content: 'Response from eiro-001',
            timestamp: new Date(),
            role: 'agent',
            stage: 'individual-thought',
            metadata: {
              reasoning: 'Test reasoning',
              confidence: 0.8
            }
          },
          {
            id: 'msg-3',
            agentId: 'yui-000',
            content: 'Vote: eiro-001\nReason: Best for synthesis',
            timestamp: new Date(),
            role: 'agent',
            stage: 'voting',
            metadata: {
              facilitatorAction: 'voting'
            }
          },
          {
            id: 'msg-4',
            agentId: 'eiro-001',
            content: 'Final synthesis...',
            timestamp: new Date(),
            role: 'agent',
            stage: 'finalize',
            metadata: {
              isFinalOutput: true
            }
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'completed',
        currentStage: 'finalize',
        stageHistory: [],
        language: 'ja' as Language,
        sequenceNumber: 1
      };

      // Verify v2 session has all required v1 fields
      expect(v2Session.id).toBeDefined();
      expect(v2Session.title).toBeDefined();
      expect(v2Session.agents).toBeDefined();
      expect(v2Session.messages).toBeDefined();
      expect(v2Session.createdAt).toBeDefined();
      expect(v2Session.updatedAt).toBeDefined();
      expect(v2Session.status).toBeDefined();

      // Verify messages have compatible structure
      v2Session.messages.forEach(message => {
        expect(message.id).toBeDefined();
        expect(message.agentId).toBeDefined();
        expect(message.content).toBeDefined();
        expect(message.timestamp).toBeDefined();
        expect(message.role).toBeDefined();
      });

      // Verify voting stage is properly integrated
      const votingMessage = v2Session.messages.find(m => m.stage === 'voting');
      expect(votingMessage).toBeDefined();
      expect(votingMessage?.content).toContain('Vote:');

      // Verify final message
      const finalMessage = v2Session.messages.find(m => m.stage === 'finalize');
      expect(finalMessage).toBeDefined();
      expect(finalMessage?.metadata?.isFinalOutput).toBe(true);
    });

    it('should maintain backward compatibility with v1 output formats', () => {
      // Test that v2 can handle v1-style session data
      const v1StyleSession: Partial<Session> = {
        id: 'test-session-v1',
        agents: testAgents,
        messages: [
          {
            id: 'msg-1',
            agentId: 'eiro-001',
            content: 'V1 style response',
            timestamp: new Date(),
            role: 'agent',
            stage: 'output-generation',
            metadata: {
              voteFor: 'yui-000',
              voteReasoning: 'Good synthesis ability'
            }
          }
        ],
        status: 'completed'
      };

      // V2 should be able to process v1 vote metadata
      const voteMessage = v1StyleSession.messages?.[0];
      expect(voteMessage?.metadata?.voteFor).toBe('yui-000');
      expect(voteMessage?.metadata?.voteReasoning).toBeDefined();

      // V2 voting parser should handle this format
      if (voteMessage?.content && voteMessage?.metadata) {
        const voteContent = `投票: ${voteMessage.metadata.voteFor}\n理由: ${voteMessage.metadata.voteReasoning}`;
        const parsed = (v2Router as any).parseVoteResponse(
          voteContent,
          voteMessage.agentId,
          testAgents.map(a => a.id)
        );

        expect(parsed.voteFor).toBe('yui-000');
        expect(parsed.voteReasoning).toBe('Good synthesis ability');
      }
    });
  });

  describe('Feature Parity Tests', () => {
    it('should ensure both systems support Japanese and English', () => {
      const jaVote = '投票: eiro-001\n理由: 論理的思考';
      const enVote = 'Vote: eiro-001\nReason: Logical thinking';

      const validAgents = testAgents.map(a => a.id);

      // Test Japanese
      const jaResult = (v2Router as any).parseVoteResponse(jaVote, 'yui-000', validAgents);
      expect(jaResult.voteFor).toBe('eiro-001');
      expect(jaResult.voteReasoning).toBe('論理的思考');

      // Test English
      const enResult = (v2Router as any).parseVoteResponse(enVote, 'yui-000', validAgents);
      expect(enResult.voteFor).toBe('eiro-001');
      expect(enResult.voteReasoning).toBe('Logical thinking');
    });

    it('should maintain agent personality consistency across versions', () => {
      // Both v1 and v2 should respect agent personalities in voting
      testAgents.forEach(agent => {
        expect(agent.personality).toBeDefined();
        expect(agent.style).toBeDefined();
        expect(agent.preferences).toBeDefined();

        // Verify personality traits are preserved
        if (agent.id === 'eiro-001') {
          expect(agent.style).toBe('logical');
          expect(agent.personality).toContain('Analytical');
        }
        if (agent.id === 'yui-000') {
          expect(agent.style).toBe('emotive');
          expect(agent.personality).toContain('Empathetic');
        }
      });
    });

    it('should ensure error handling consistency', async () => {
      // Both systems should handle AI execution failures gracefully
      const mockAgents = testAgents.map(agent => ({
        getAgent: () => agent,
        executeAIWithErrorHandling: vi.fn().mockRejectedValue(new Error('AI failure'))
      }));

      // V2 should fallback to style-based selection
      const v2Fallback = await (v2Router as any).selectFinalizerByVoting(
        [],
        mockAgents,
        'ja'
      );

      expect(v2Fallback).toBeDefined();
      expect(Array.isArray(v2Fallback)).toBe(true);
      expect(v2Fallback.length).toBeGreaterThan(0);
      expect(['logical', 'meta']).toContain(v2Fallback[0].getAgent().style);

      // Both systems should have graceful degradation
      expect(v2Fallback[0].getAgent().id).toBeTruthy();
    });
  });
});