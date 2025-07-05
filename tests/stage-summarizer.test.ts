import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StageSummarizer, createStageSummarizer, StageSummary } from '../src/kernel/stage-summarizer.js';
import { Message, DialogueStage, Agent } from '../src/types/index.js';

// Mock AI executor
vi.mock('../src/kernel/ai-executor.js', () => ({
  createAIExecutor: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({
      content: '- yui-000: 仮説に同意。ただし情報理論の視点を追加。\n- kanshi-001: 概念に興味を示すが、検証性を懸念。\n- youga-001: 論点を概念的に拡張し、統合を提案。',
      success: true,
      duration: 1000
    })
  })
}));

describe('StageSummarizer', () => {
  let summarizer: StageSummarizer;
  let mockMessages: Message[];
  let mockAgents: Agent[];

  beforeEach(() => {
    summarizer = createStageSummarizer({ language: 'ja' }); // テスト用に日本語を設定
    
    mockAgents = [
             {
         id: 'yui-000',
         name: 'yui',
         furigana: 'ユイ',
         style: 'emotive',
         priority: 'breadth',
         memoryScope: 'session',
         personality: 'Emotive and creative',
         preferences: [],
         tone: 'expressive',
         communicationStyle: 'creative'
       },
       {
         id: 'kanshi-001',
         name: 'kanshi',
         furigana: 'カンシ',
         style: 'critical',
         priority: 'precision',
         memoryScope: 'session',
         personality: 'Critical and analytical',
         preferences: [],
         tone: 'direct',
         communicationStyle: 'structured'
       },
       {
         id: 'youga-001',
         name: 'youga',
         furigana: 'ヨウガ',
         style: 'intuitive',
         priority: 'breadth',
         memoryScope: 'session',
         personality: 'Intuitive and innovative',
         preferences: [],
         tone: 'creative',
         communicationStyle: 'practical'
       }
    ];

         mockMessages = [
       {
         id: '1',
         agentId: 'yui-000',
         content: 'I agree with the hypothesis, but I would add an information theory perspective.',
         timestamp: new Date(),
         role: 'agent' as const,
         stage: 'individual-thought' as const
       },
       {
         id: '2',
         agentId: 'kanshi-001',
         content: 'I find the concept interesting, but I have concerns about verifiability.',
         timestamp: new Date(),
         role: 'agent' as const,
         stage: 'individual-thought' as const
       },
       {
         id: '3',
         agentId: 'youga-001',
         content: 'I would extend the argument conceptually and propose integration.',
         timestamp: new Date(),
         role: 'agent' as const,
         stage: 'individual-thought' as const
       }
     ];
  });

  describe('summarizeStage', () => {
    it('should generate summary for individual-thought stage', async () => {
      const summary = await summarizer.summarizeStage(
        'individual-thought',
        mockMessages,
        mockAgents,
        'test-session-123'
      );

      expect(summary).toBeDefined();
      expect(summary.stage).toBe('individual-thought');
      expect(summary.stageNumber).toBe(1);
      expect(summary.summary).toHaveLength(3);
      expect(summary.timestamp).toBeInstanceOf(Date);
    });

    it('should return empty summary for stage with no messages', async () => {
      const summary = await summarizer.summarizeStage(
        'mutual-reflection',
        [],
        mockAgents,
        'test-session-123'
      );

      expect(summary.summary).toHaveLength(0);
      expect(summary.stage).toBe('mutual-reflection');
      expect(summary.stageNumber).toBe(2);
    });

    it('should filter messages by stage', async () => {
      const mixedMessages = [
        ...mockMessages,
        {
          id: '4',
          agentId: 'yui-000',
          content: 'This is from mutual reflection stage.',
          timestamp: new Date(),
          role: 'agent' as const,
          stage: 'mutual-reflection' as const
        }
      ];

      const summary = await summarizer.summarizeStage(
        'individual-thought',
        mixedMessages,
        mockAgents,
        'test-session-123'
      );

      // Should only include individual-thought messages
      expect(summary.summary).toHaveLength(3);
    });
  });

  describe('generateFinalSummary', () => {
    it('should generate final summary from multiple stage summaries', async () => {
      const stageSummaries: StageSummary[] = [
        {
          stage: 'individual-thought',
          summary: [
            { speaker: 'yui', position: '仮説に同意。ただし情報理論の視点を追加。' },
            { speaker: 'kanshi', position: '概念に興味を示すが、検証性を懸念。' }
          ],
          timestamp: new Date(),
          stageNumber: 1
        },
        {
          stage: 'mutual-reflection',
          summary: [
            { speaker: 'yui', position: 'kanshiの視点を評価し、統合を提案。' },
            { speaker: 'kanshi', position: 'yuiの論点に同意し、実装方法を検討。' }
          ],
          timestamp: new Date(),
          stageNumber: 2
        }
      ];

      const finalSummary = await summarizer.generateFinalSummary(
        stageSummaries,
        mockAgents,
        'test-session-123'
      );

      expect(finalSummary).toBeDefined();
      expect(typeof finalSummary).toBe('string');
      expect(finalSummary.length).toBeGreaterThan(0);
    });

    it('should return default message for empty summaries', async () => {
      const finalSummary = await summarizer.generateFinalSummary([], mockAgents, 'test-session-123');
      expect(finalSummary).toBe('No stage summaries available.');
    });
  });

  describe('formatSummaryForPrompt', () => {
    it('should format summaries for prompt inclusion', () => {
      const stageSummaries: StageSummary[] = [
        {
          stage: 'individual-thought',
          summary: [
            { speaker: 'yui', position: '仮説に同意。ただし情報理論の視点を追加。' },
            { speaker: 'kanshi', position: '概念に興味を示すが、検証性を懸念。' }
          ],
          timestamp: new Date(),
          stageNumber: 1
        }
      ];

      const formatted = summarizer.formatSummaryForPrompt(stageSummaries);
      
      expect(formatted).toContain('Stage 1: Individual Thought');
      expect(formatted).toContain('yui: 仮説に同意。ただし情報理論の視点を追加。');
      expect(formatted).toContain('kanshi: 概念に興味を示すが、検証性を懸念。');
    });

    it('should return default message for empty summaries', () => {
      const formatted = summarizer.formatSummaryForPrompt([]);
      expect(formatted).toBe('前のステージの要約はありません。');
    });
  });

  describe('stage number mapping', () => {
    it('should correctly map stage names to numbers', async () => {
      const stages: DialogueStage[] = [
        'individual-thought',
        'mutual-reflection',
        'conflict-resolution',
        'synthesis-attempt',
        'output-generation'
      ];

      for (let i = 0; i < stages.length; i++) {
        const summary = await summarizer.summarizeStage(
          stages[i],
          mockMessages,
          mockAgents
        );
        expect(summary.stageNumber).toBe(i + 1);
      }
    });
  });

  describe('language configuration', () => {
    it('should use default language (en) when not specified', () => {
      const defaultSummarizer = createStageSummarizer();
      expect(defaultSummarizer).toBeDefined();
    });

    it('should use specified language', () => {
      const japaneseSummarizer = createStageSummarizer({ language: 'ja' });
      const englishSummarizer = createStageSummarizer({ language: 'en' });
      
      expect(japaneseSummarizer).toBeDefined();
      expect(englishSummarizer).toBeDefined();
    });
  });
}); 