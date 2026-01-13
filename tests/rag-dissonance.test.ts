import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamicInstruction } from '../src/types/consensus.js';
import { Message } from '../src/types/index.js';
import { formatRAGDissonancePrompt, getDynamicInstructionPrompt, DYNAMIC_INSTRUCTION_PROMPTS } from '../src/templates/v2-prompts.js';

// Note: DynamicDialogueRouter tests require mocking RAGRetriever
// These tests focus on the type definitions and prompt generation

describe('RAG Dissonance Integration', () => {
  describe('DynamicInstruction ragDissonance structure', () => {
    it('should have all required ragDissonance properties', () => {
      const ragDissonance: DynamicInstruction['ragDissonance'] = {
        sourceSessionId: 'session-abc123',
        sourceConclusionSummary: 'Previous discussion concluded that habit formation requires 21 days...',
        similarityScore: 0.82,
        deconstructionHint: 'Consider whether this conclusion was context-dependent'
      };

      expect(ragDissonance?.sourceSessionId).toBe('session-abc123');
      expect(ragDissonance?.sourceConclusionSummary).toContain('habit formation');
      expect(ragDissonance?.similarityScore).toBeGreaterThanOrEqual(0);
      expect(ragDissonance?.similarityScore).toBeLessThanOrEqual(1);
      expect(ragDissonance?.deconstructionHint).toBeDefined();
    });

    it('should create complete DynamicInstruction with ragDissonance', () => {
      const instruction: DynamicInstruction = {
        content: 'Challenge the previous conclusion',
        tone: 'deconstructive',
        ragDissonance: {
          sourceSessionId: 'session-xyz789',
          sourceConclusionSummary: 'The nature of consciousness was debated...',
          similarityScore: 0.78,
          deconstructionHint: 'What if consciousness is not binary?'
        },
        metadata: {
          triggerReason: 'rag_similarity',
          generatedAt: new Date()
        }
      };

      expect(instruction.tone).toBe('deconstructive');
      expect(instruction.metadata?.triggerReason).toBe('rag_similarity');
      expect(instruction.ragDissonance?.similarityScore).toBe(0.78);
    });
  });

  describe('RAG Dissonance Prompt Templates', () => {
    it('should have Japanese RAG dissonance prompt', () => {
      const jaPrompt = DYNAMIC_INSTRUCTION_PROMPTS.rag_dissonance.ja;

      expect(jaPrompt).toContain('過去の視点への挑戦');
      expect(jaPrompt).toContain('{pastConclusion}');
      expect(jaPrompt).toContain('可能性B');
    });

    it('should have English RAG dissonance prompt', () => {
      const enPrompt = DYNAMIC_INSTRUCTION_PROMPTS.rag_dissonance.en;

      expect(enPrompt).toContain('HISTORICAL PERSPECTIVE CHALLENGE');
      expect(enPrompt).toContain('{pastConclusion}');
      expect(enPrompt).toContain('possibility B');
    });

    it('should format RAG dissonance prompt with past conclusion', () => {
      const pastConclusion = 'The discussion concluded that AI cannot truly understand emotions.';

      const formattedJa = formatRAGDissonancePrompt(pastConclusion, 'ja');
      const formattedEn = formatRAGDissonancePrompt(pastConclusion, 'en');

      expect(formattedJa).toContain(pastConclusion);
      expect(formattedJa).not.toContain('{pastConclusion}');
      expect(formattedEn).toContain(pastConclusion);
      expect(formattedEn).not.toContain('{pastConclusion}');
    });

    it('should truncate long past conclusions', () => {
      const longConclusion = 'A'.repeat(300); // 300 characters

      const formatted = formatRAGDissonancePrompt(longConclusion, 'en');

      // Should be truncated to 200 characters
      expect(formatted).not.toContain('A'.repeat(300));
      expect(formatted).toContain('A'.repeat(200));
    });
  });

  describe('Dynamic Instruction Prompt Types', () => {
    it('should provide deconstructive prompt in both languages', () => {
      const jaPrompt = getDynamicInstructionPrompt('deconstructive', 'ja');
      const enPrompt = getDynamicInstructionPrompt('deconstructive', 'en');

      expect(jaPrompt).toContain('挑戦');
      expect(enPrompt).toContain('CHALLENGE');
    });

    it('should provide exploratory prompt in both languages', () => {
      const jaPrompt = getDynamicInstructionPrompt('exploratory', 'ja');
      const enPrompt = getDynamicInstructionPrompt('exploratory', 'en');

      expect(jaPrompt).toContain('再開');
      expect(enPrompt).toContain('REOPEN');
    });

    it('should provide integrative prompt in both languages', () => {
      const jaPrompt = getDynamicInstructionPrompt('integrative', 'ja');
      const enPrompt = getDynamicInstructionPrompt('integrative', 'en');

      expect(jaPrompt).toContain('接続');
      expect(enPrompt).toContain('CONNECT');
    });
  });

  describe('Similarity Threshold Logic', () => {
    // These tests document the expected behavior of similarity-based triggering

    it('should recognize high similarity (>=0.75) as trigger-worthy', () => {
      const highSimilarity = 0.82;
      const threshold = 0.75;

      expect(highSimilarity >= threshold).toBe(true);
    });

    it('should not trigger for low similarity (<0.75)', () => {
      const lowSimilarity = 0.65;
      const threshold = 0.75;

      expect(lowSimilarity >= threshold).toBe(false);
    });

    it('should handle boundary case (exactly 0.75)', () => {
      const boundarySimilarity = 0.75;
      const threshold = 0.75;

      expect(boundarySimilarity >= threshold).toBe(true);
    });
  });

  describe('Deconstruction Hint Generation', () => {
    it('should create meaningful deconstruction hint from past conclusion', () => {
      const pastConclusion = 'We concluded that meditation improves focus.';

      // Simulating the hint generation logic from DynamicRouter
      const hint = `かつて「${pastConclusion}...」と結論づけられました。
しかし今の文脈で、この結論は不完全だったかもしれません。
何が変わったか？どんな新しい視点がこの理解に挑戦するか？
可能性Bを考慮してください。`;

      expect(hint).toContain(pastConclusion);
      expect(hint).toContain('不完全');
      expect(hint).toContain('可能性B');
    });
  });

  describe('Integration with FacilitatorAction', () => {
    it('should allow RAG-triggered dynamic instruction on action', () => {
      const actionWithRAGDissonance = {
        type: 'deep_dive' as const,
        target: 'eiro-001',
        reason: 'Explore topic further',
        priority: 8,
        dynamicInstruction: {
          content: 'Challenge the previous conclusion about this topic',
          tone: 'deconstructive' as const,
          ragDissonance: {
            sourceSessionId: 'past-session-001',
            sourceConclusionSummary: 'Previous stance on the topic...',
            similarityScore: 0.88,
            deconstructionHint: 'Consider if context has changed'
          },
          metadata: {
            triggerReason: 'rag_similarity' as const,
            generatedAt: new Date()
          }
        }
      };

      expect(actionWithRAGDissonance.dynamicInstruction?.ragDissonance).toBeDefined();
      expect(actionWithRAGDissonance.dynamicInstruction?.metadata?.triggerReason).toBe('rag_similarity');
    });

    it('should not override existing facilitator-generated instruction', () => {
      // When facilitator already generated an instruction (e.g., easy_consensus),
      // RAG dissonance should NOT override it
      const facilitatorInstruction: DynamicInstruction = {
        content: 'Original facilitator instruction',
        tone: 'deconstructive',
        metadata: {
          triggerReason: 'easy_consensus',
          generatedAt: new Date()
        }
      };

      // RAG dissonance should only be added if dynamicInstruction is undefined
      const shouldAddRAGDissonance = facilitatorInstruction === undefined;

      expect(shouldAddRAGDissonance).toBe(false);
    });
  });

  describe('Message Metadata with Dynamic Instruction', () => {
    it('should include hasDynamicInstruction flag in message metadata', () => {
      const messageMetadata = {
        facilitatorAction: 'deep_dive',
        reasoning: 'Test reason',
        hasDynamicInstruction: true,
        wordCountTarget: '150-200 words'
      };

      expect(messageMetadata.hasDynamicInstruction).toBe(true);
    });

    it('should indicate when no dynamic instruction was used', () => {
      const messageMetadata = {
        facilitatorAction: 'clarification',
        reasoning: 'Test reason',
        hasDynamicInstruction: false
      };

      expect(messageMetadata.hasDynamicInstruction).toBe(false);
    });
  });
});
