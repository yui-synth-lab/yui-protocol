import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicDialogueRouter } from '../src/kernel/dynamic-router.js';

// Mock the dependencies
vi.mock('../src/agents/facilitator-agent.js', () => ({
  FacilitatorAgent: vi.fn()
}));

describe('Consensus Parsing Logic', () => {
  let router: DynamicDialogueRouter;

  beforeEach(() => {
    router = new DynamicDialogueRouter({} as any);
  });

  describe('parseConsensusResponse', () => {
    it('should parse new format consensus response correctly', () => {
      const response = `Satisfaction: 7
Meaningful insights: yes
Ready to conclude: yes
Critical points remaining: no
Reasoning: This discussion has provided sufficient insights and we can move to conclusion.`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(7);
      expect(result.readyToMove).toBe(true);
      expect(result.hasAdditionalPoints).toBe(false);
      expect(result.reasoning).toContain('sufficient insights');
    });

    test('should handle critical points remaining as true', () => {
      const response = `Satisfaction: 6
Meaningful insights: yes
Ready to conclude: no
Critical points remaining: yes
Reasoning: We still have essential topics to discuss before concluding.`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(6);
      expect(result.readyToMove).toBe(false);
      expect(result.hasAdditionalPoints).toBe(true);
    });

    test('should handle edge cases with whitespace and variations', () => {
      const response = `Satisfaction: 8
Meaningful insights:yes
Ready to conclude:  yes
Critical points remaining:no
Reasoning: Clean conclusion ready`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(8);
      expect(result.readyToMove).toBe(true);
      expect(result.hasAdditionalPoints).toBe(false);
    });

    test('should handle invalid satisfaction levels gracefully', () => {
      const response = `Satisfaction: 15
Meaningful insights: yes
Ready to conclude: yes
Critical points remaining: no
Reasoning: High satisfaction`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(10); // Clamped to max
    });

    test('should default to safe values when parsing fails', () => {
      const response = `Invalid response format`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(5);
      expect(result.readyToMove).toBe(false);
      expect(result.hasAdditionalPoints).toBe(false);
    });

    test('should prioritize critical points over ready to conclude', () => {
      const response = `Satisfaction: 8
Meaningful insights: yes
Ready to conclude: yes
Critical points remaining: yes
Reasoning: Ready but have critical points`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      expect(result.satisfactionLevel).toBe(8);
      expect(result.readyToMove).toBe(false); // Should be false due to critical points
      expect(result.hasAdditionalPoints).toBe(true);
    });
  });

  describe('Consensus Logic Fixes', () => {
    test('should not treat meaningful insights as additional points', () => {
      const response = `Satisfaction: 8
Meaningful insights: yes
Ready to conclude: yes
Critical points remaining: no
Reasoning: Good insights achieved, ready to conclude`;

      const result = (router as any).parseConsensusResponse(response, 'test-agent');

      // Before fix: hasAdditionalPoints would be true (wrong)
      // After fix: hasAdditionalPoints should be false (correct)
      expect(result.hasAdditionalPoints).toBe(false);
      expect(result.readyToMove).toBe(true);
    });
  });
});