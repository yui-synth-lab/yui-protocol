import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FacilitatorAgent } from '../src/agents/facilitator-agent.js';
import { ConsensusIndicator, FacilitatorAction } from '../src/types/consensus.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';

// Mock AI executor
vi.mock('../src/kernel/ai-executor.js', () => ({
  createAIExecutor: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({
      content: '[{"type": "deep_dive", "target": "eiro-001", "reason": "needs more analysis", "priority": 7}]',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    })
  })
}));

describe('Facilitator JSON Parsing Robustness', () => {
  let facilitator: FacilitatorAgent;
  let mockAIExecutor: any;
  let mockLogger: InteractionLogger;

  beforeEach(async () => {
    mockLogger = {
      logInteraction: vi.fn().mockResolvedValue(undefined),
      getInteractionHistory: vi.fn().mockResolvedValue([]),
      clearHistory: vi.fn().mockResolvedValue(undefined)
    } as any;

    facilitator = new FacilitatorAgent('test-session', mockLogger);

    // Get the mocked AI executor
    const { createAIExecutor } = await import('../src/kernel/ai-executor.js');
    mockAIExecutor = await createAIExecutor();
    (facilitator as any).aiExecutor = mockAIExecutor;
  });

  const mockConsensus: ConsensusIndicator[] = [
    {
      agentId: 'eiro-001',
      satisfactionLevel: 7,
      hasAdditionalPoints: false,
      questionsForOthers: [],
      readyToMove: true,
      reasoning: 'Good progress'
    },
    {
      agentId: 'kanshi-001',
      satisfactionLevel: 6,
      hasAdditionalPoints: true,
      questionsForOthers: ['What about edge cases?'],
      readyToMove: false,
      reasoning: 'Need more analysis'
    }
  ];

  const mockMessages = [
    {
      id: '1',
      agentId: 'eiro-001',
      content: 'This is a thoughtful analysis...',
      timestamp: new Date(),
      role: 'agent' as const
    },
    {
      id: '2',
      agentId: 'kanshi-001',
      content: 'I have some concerns about this approach...',
      timestamp: new Date(),
      role: 'agent' as const
    }
  ];

  it('should handle valid JSON array response', async () => {
    mockAIExecutor.execute.mockResolvedValue({
      content: '[{"type": "perspective_shift", "target": "yui-000", "reason": "encourage participation", "priority": 8}]',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      3,
      'Original query about AI ethics'
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'perspective_shift',
      target: 'yui-000',
      reason: 'encourage participation',
      priority: 8
    });
  });

  it('should handle JSON with markdown code blocks', async () => {
    mockAIExecutor.execute.mockResolvedValue({
      content: '```json\n[{"type": "clarification", "target": "hekito-001", "reason": "need data analysis", "priority": 7}]\n```',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      5
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].type).toBe('clarification');
    expect(result[0].target).toBe('hekito-001');
  });

  it('should handle response with extra text and JSON', async () => {
    mockAIExecutor.execute.mockResolvedValue({
      content: 'Based on the analysis, here are my suggestions:\n\n[{"type": "deep_dive", "target": "yoga-001", "reason": "creative insights needed", "priority": 6}]\n\nThese actions should help improve the dialogue.',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      2
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].type).toBe('deep_dive');
    expect(result[0].target).toBe('yoga-001');
  });

  it('should fallback gracefully for invalid JSON like "[facilitator]"', async () => {
    console.warn = vi.fn(); // Mock console.warn

    mockAIExecutor.execute.mockResolvedValue({
      content: '[facilitator]',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      4
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Should use fallback actions based on configuration
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('target');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Facilitator] No valid JSON found in response, using fallback')
    );
  });

  it('should fallback gracefully for malformed JSON', async () => {
    console.warn = vi.fn();

    mockAIExecutor.execute.mockResolvedValue({
      content: '[{"type": "deep_dive", "target": "eiro-001", "reason": "incomplete json"',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      1
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Facilitator] JSON parse failed:')
    );
  });

  it('should handle empty or whitespace-only responses', async () => {
    console.warn = vi.fn();

    mockAIExecutor.execute.mockResolvedValue({
      content: '   \n\n  ',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      6
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Facilitator] No valid JSON found in response, using fallback')
    );
  });

  it('should handle response with "Your JSON array:" prefix', async () => {
    mockAIExecutor.execute.mockResolvedValue({
      content: 'Your JSON array: [{"type": "summarize", "target": "kanshi-001", "reason": "analytical summary needed", "priority": 7}]',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      8
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].type).toBe('summarize');
    expect(result[0].target).toBe('kanshi-001');
  });

  it('should handle AI execution errors gracefully', async () => {
    console.warn = vi.fn();

    mockAIExecutor.execute.mockRejectedValue(new Error('AI service unavailable'));

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      10
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Facilitator] Failed to parse facilitator suggestions, using fallback:')
    );
  });

  it('should use fallback actions when AI returns non-array JSON', async () => {
    console.warn = vi.fn();

    mockAIExecutor.execute.mockResolvedValue({
      content: '{"error": "Unable to generate suggestions"}',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });

    const result = await (facilitator as any).generateSuggestions(
      mockMessages,
      mockConsensus,
      7
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Facilitator] Invalid suggestions format, using fallback')
    );
  });
});