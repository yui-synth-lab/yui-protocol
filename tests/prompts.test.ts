import { describe, it, expect } from 'vitest';
import { 
  PERSONALITY_PROMPT_TEMPLATE, 
  getPersonalityPrompt, 
  formatPrompt,
  Language 
} from '../src/templates/prompts.js';

describe('Prompt Templates', () => {
  describe('PERSONALITY_PROMPT_TEMPLATE', () => {
    it('should include all required fields', () => {
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{name}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{furigana}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{style}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{priority}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{personality}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{preferences}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{memoryScope}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{tone}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{communicationStyle}');
    });

    it('should include new enhanced personality fields', () => {
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{specificBehaviors}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{thinkingPatterns}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{interactionPatterns}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{decisionProcess}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{disagreementStyle}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{agreementStyle}');
    });

    it('should include growth and evolution guidelines', () => {
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Growth and Evolution');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Show how your thinking evolves through dialogue');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Demonstrate learning and adaptation');
    });

    it('should include concrete expression guidelines', () => {
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Concrete Expression Guidelines');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Use specific examples and concrete scenarios');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('Reference actual dialogue exchanges');
    });
  });

  describe('getPersonalityPrompt', () => {
    it('should generate prompt with all required fields', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test1', 'test2'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct'
      };

      const result = getPersonalityPrompt(agent);
      
      expect(result).toContain('Test Agent');
      expect(result).toContain('テストエージェント');
      expect(result).toContain('logical');
      expect(result).toContain('precision');
      expect(result).toContain('Test personality');
      expect(result).toContain('test1, test2');
      expect(result).toContain('session');
      expect(result).toContain('formal');
      expect(result).toContain('direct');
    });

    it('should use default values for optional enhanced fields when not provided', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct'
      };

      const result = getPersonalityPrompt(agent);
      
      // Check that default values are used
      expect(result).toContain('analyze systematically and consider multiple perspectives');
      expect(result).toContain('approach problems methodically while considering emotional and logical aspects');
      expect(result).toContain('engage respectfully with others while maintaining your unique perspective');
      expect(result).toContain('weigh evidence carefully and consider both immediate and long-term implications');
      expect(result).toContain('express differences constructively while seeking common ground');
      expect(result).toContain('acknowledge shared understanding while adding your unique insights');
    });

    it('should use provided values for enhanced fields when available', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct',
        specificBehaviors: 'Custom behavior pattern',
        thinkingPatterns: 'Custom thinking approach',
        interactionPatterns: 'Custom interaction style',
        decisionProcess: 'Custom decision method',
        disagreementStyle: 'Custom disagreement approach',
        agreementStyle: 'Custom agreement method'
      };

      const result = getPersonalityPrompt(agent);
      
      // Check that custom values are used instead of defaults
      expect(result).toContain('Custom behavior pattern');
      expect(result).toContain('Custom thinking approach');
      expect(result).toContain('Custom interaction style');
      expect(result).toContain('Custom decision method');
      expect(result).toContain('Custom disagreement approach');
      expect(result).toContain('Custom agreement method');
      
      // Check that default values are NOT used
      expect(result).not.toContain('analyze systematically and consider multiple perspectives');
      expect(result).not.toContain('approach problems methodically while considering emotional and logical aspects');
    });

    it('should handle Japanese language correctly', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct'
      };

      const result = getPersonalityPrompt(agent, 'ja');
      
      expect(result).toContain('Respond ONLY in Japanese');
      expect(result).toContain('Japanese');
    });

    it('should handle English language correctly', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct'
      };

      const result = getPersonalityPrompt(agent, 'en');
      
      expect(result).toContain('Respond ONLY in English');
      expect(result).toContain('English');
    });

    it('should handle summarizer mode correctly', () => {
      const agent = {
        name: 'Test Agent',
        furigana: 'テストエージェント',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'formal',
        communicationStyle: 'direct'
      };

      const result = getPersonalityPrompt(agent, 'en', true);
      
      // Should include summarizer-specific instruction
      expect(result).toContain('Create a comprehensive and detailed summary');
      expect(result).toContain('Thoroughly summarize the outputs');
    });
  });

  describe('formatPrompt', () => {
    it('should replace all variables in template', () => {
      const template = 'Hello {name}, you are {age} years old.';
      const variables = { name: 'John', age: '25' };
      
      const result = formatPrompt(template, variables);
      
      expect(result).toBe('Hello John, you are 25 years old.');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {name}, you are {age} years old.';
      const variables = { name: 'John' };
      
      const result = formatPrompt(template, variables);
      
      expect(result).toBe('Hello John, you are {age} years old.');
    });

    it('should handle empty variables object', () => {
      const template = 'Hello {name}, you are {age} years old.';
      const variables = {};
      
      const result = formatPrompt(template, variables);
      
      expect(result).toBe('Hello {name}, you are {age} years old.');
    });
  });
}); 