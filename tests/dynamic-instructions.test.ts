import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';
import { ConsensusIndicator, FacilitatorAction, DynamicInstruction } from '../src/types/consensus.js';
import { Message } from '../src/types/index.js';

describe('Dynamic Instructions System', () => {
  let facilitator: FacilitatorAgent;

  beforeEach(() => {
    facilitator = new FacilitatorAgent('test-session-001');
  });

  describe('Dialogue Pattern Detection', () => {
    const createMockMessages = (count: number): Message[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `msg-${i}`,
        agentId: `agent-${i % 3}`,
        content: `This is message ${i} about the topic. It contains some discussion content.`,
        timestamp: new Date(),
        role: 'agent' as const
      }));
    };

    const createMockConsensus = (
      satisfaction: number,
      readyToMove: boolean,
      hasAdditional: boolean
    ): ConsensusIndicator[] => {
      return [
        {
          agentId: 'eiro-001',
          satisfactionLevel: satisfaction,
          hasAdditionalPoints: hasAdditional,
          questionsForOthers: [],
          readyToMove: readyToMove,
          reasoning: 'Test reasoning'
        },
        {
          agentId: 'yui-000',
          satisfactionLevel: satisfaction,
          hasAdditionalPoints: hasAdditional,
          questionsForOthers: [],
          readyToMove: readyToMove,
          reasoning: 'Test reasoning'
        },
        {
          agentId: 'hekito-001',
          satisfactionLevel: satisfaction,
          hasAdditionalPoints: hasAdditional,
          questionsForOthers: [],
          readyToMove: readyToMove,
          reasoning: 'Test reasoning'
        }
      ];
    };

    it('should detect easy consensus in early rounds with high satisfaction', () => {
      const messages = createMockMessages(10);
      const consensus = createMockConsensus(8.5, true, false);

      const pattern = facilitator.detectDialoguePattern(messages, consensus, 2);

      expect(pattern).toBe('easy_consensus');
    });

    it('should not detect easy consensus in later rounds', () => {
      const messages = createMockMessages(10);
      const consensus = createMockConsensus(8.5, true, false);

      const pattern = facilitator.detectDialoguePattern(messages, consensus, 5);

      expect(pattern).not.toBe('easy_consensus');
    });

    it('should detect dialogue gap when satisfaction is low and no additional points', () => {
      const messages = createMockMessages(10);
      const consensus = createMockConsensus(4.5, false, false);

      const pattern = facilitator.detectDialoguePattern(messages, consensus, 3);

      expect(pattern).toBe('dialogue_gap');
    });

    it('should not detect dialogue gap when there are additional points', () => {
      const messages = createMockMessages(10);
      const consensus = createMockConsensus(4.5, false, true);

      const pattern = facilitator.detectDialoguePattern(messages, consensus, 3);

      expect(pattern).not.toBe('dialogue_gap');
    });

    it('should return null for healthy dialogue (moderate satisfaction, not ready)', () => {
      const messages = createMockMessages(10);
      const consensus = createMockConsensus(6.5, false, true);

      const pattern = facilitator.detectDialoguePattern(messages, consensus, 2);

      expect(pattern).toBeNull();
    });

    it('should return null for empty consensus data', () => {
      const messages = createMockMessages(10);

      const pattern = facilitator.detectDialoguePattern(messages, [], 2);

      expect(pattern).toBeNull();
    });
  });

  describe('Dynamic Instruction Generation', () => {
    const mockAction: FacilitatorAction = {
      type: 'deep_dive',
      target: 'eiro-001',
      reason: 'Test reason',
      priority: 8
    };

    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        agentId: 'eiro-001',
        content: 'Test message content',
        timestamp: new Date(),
        role: 'agent'
      }
    ];

    it('should generate deconstructive instruction for easy consensus', async () => {
      const instruction = await facilitator.generateDynamicInstruction(
        'easy_consensus',
        mockAction,
        mockMessages,
        2
      );

      expect(instruction.tone).toBe('deconstructive');
      expect(instruction.content).toContain('早急に閉じないでください');
      expect(instruction.metadata?.triggerReason).toBe('easy_consensus');
    });

    it('should generate exploratory instruction for dialogue gap', async () => {
      const instruction = await facilitator.generateDynamicInstruction(
        'dialogue_gap',
        mockAction,
        mockMessages,
        3
      );

      expect(instruction.tone).toBe('exploratory');
      expect(instruction.content).toContain('行き詰まりました');
      expect(instruction.metadata?.triggerReason).toBe('dialogue_gap');
    });

    it('should generate integrative instruction for topic stagnation', async () => {
      const instruction = await facilitator.generateDynamicInstruction(
        'topic_stagnation',
        mockAction,
        mockMessages,
        5
      );

      expect(instruction.tone).toBe('integrative');
      expect(instruction.content).toContain('循環しています');
      expect(instruction.metadata?.triggerReason).toBe('topic_stagnation');
    });

    it('should include timestamp in metadata', async () => {
      const beforeGeneration = new Date();

      const instruction = await facilitator.generateDynamicInstruction(
        'easy_consensus',
        mockAction,
        mockMessages,
        2
      );

      expect(instruction.metadata?.generatedAt).toBeDefined();
      expect(instruction.metadata?.generatedAt.getTime()).toBeGreaterThanOrEqual(beforeGeneration.getTime());
    });
  });

  describe('DynamicInstruction Type', () => {
    it('should support all required properties', () => {
      const instruction: DynamicInstruction = {
        content: 'Test instruction content',
        tone: 'deconstructive',
        ragDissonance: {
          sourceSessionId: 'session-123',
          sourceConclusionSummary: 'Previous conclusion summary',
          similarityScore: 0.85,
          deconstructionHint: 'Consider alternative perspectives'
        },
        metadata: {
          triggerReason: 'rag_similarity',
          generatedAt: new Date()
        }
      };

      expect(instruction.content).toBeDefined();
      expect(instruction.tone).toBe('deconstructive');
      expect(instruction.ragDissonance?.similarityScore).toBe(0.85);
      expect(instruction.metadata?.triggerReason).toBe('rag_similarity');
    });

    it('should allow optional ragDissonance', () => {
      const instruction: DynamicInstruction = {
        content: 'Test instruction',
        tone: 'exploratory'
      };

      expect(instruction.ragDissonance).toBeUndefined();
    });
  });

  describe('FacilitatorAction with dynamicInstruction', () => {
    it('should support optional dynamicInstruction property', () => {
      const actionWithInstruction: FacilitatorAction = {
        type: 'deep_dive',
        target: 'eiro-001',
        reason: 'Explore deeper',
        priority: 8,
        dynamicInstruction: {
          content: 'Challenge the consensus',
          tone: 'deconstructive',
          metadata: {
            triggerReason: 'easy_consensus',
            generatedAt: new Date()
          }
        }
      };

      expect(actionWithInstruction.dynamicInstruction).toBeDefined();
      expect(actionWithInstruction.dynamicInstruction?.tone).toBe('deconstructive');
    });

    it('should work without dynamicInstruction (backward compatible)', () => {
      const actionWithoutInstruction: FacilitatorAction = {
        type: 'clarification',
        target: 'yui-000',
        reason: 'Need clarification',
        priority: 7
      };

      expect(actionWithoutInstruction.dynamicInstruction).toBeUndefined();
    });
  });
});
