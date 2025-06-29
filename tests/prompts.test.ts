import { describe, it, expect } from 'vitest';
import {
  getPersonalityPrompt,
  getStagePrompt,
  formatPrompt,
  PERSONALITY_PROMPT_TEMPLATE,
  LANGUAGE_INSTRUCTIONS,
  STAGE_PROMPTS
} from '../src/templates/prompts.js';
import { DialogueStage } from '../src/types/index.js';

describe('Prompt Templates', () => {
  describe('PERSONALITY_PROMPT_TEMPLATE', () => {
    it('should contain placeholders for agent properties', () => {
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{name}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{style}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{priority}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{personality}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{preferences}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{memoryScope}');
      expect(PERSONALITY_PROMPT_TEMPLATE).toContain('{languageInstruction}');
    });
  });

  describe('LANGUAGE_INSTRUCTIONS', () => {
    it('should contain English instruction', () => {
      expect(LANGUAGE_INSTRUCTIONS.en).toContain('English');
    });

    it('should contain Japanese instruction', () => {
      expect(LANGUAGE_INSTRUCTIONS.ja).toContain('日本語');
    });
  });

  describe('STAGE_PROMPTS', () => {
    it('should contain all dialogue stages', () => {
      const stages: DialogueStage[] = [
        'individual-thought',
        'mutual-reflection',
        'conflict-resolution',
        'synthesis-attempt',
        'output-generation'
      ];
      
      stages.forEach(stage => {
        expect(STAGE_PROMPTS[stage]).toBeDefined();
        expect(STAGE_PROMPTS[stage].en).toBeDefined();
        expect(STAGE_PROMPTS[stage].ja).toBeDefined();
      });
    });

    it('should contain English stage 1 prompt', () => {
      const prompt = STAGE_PROMPTS['individual-thought'].en;
      expect(prompt).toContain('STAGE 1 - INDIVIDUAL THOUGHT');
      expect(prompt).toContain('Think independently');
    });

    it('should contain Japanese stage 1 prompt', () => {
      const prompt = STAGE_PROMPTS['individual-thought'].ja;
      expect(prompt).toContain('ステージ1 - 個別思考');
      expect(prompt).toContain('独立して考えてください');
    });

    it('should contain English stage 2 prompt', () => {
      const prompt = STAGE_PROMPTS['mutual-reflection'].en;
      expect(prompt).toContain('STAGE 2 - MUTUAL REFLECTION');
      expect(prompt).toContain('React to other agents');
    });

    it('should contain Japanese stage 2 prompt', () => {
      const prompt = STAGE_PROMPTS['mutual-reflection'].ja;
      expect(prompt).toContain('ステージ2 - 相互反省');
      expect(prompt).toContain('他のエージェントの思考');
    });
  });

  describe('getPersonalityPrompt', () => {
    it('should generate English personality prompt', () => {
      const agent = {
        name: 'Test Agent',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'professional',
        communicationStyle: 'formal'
      };

      const prompt = getPersonalityPrompt(agent, 'en');
      expect(prompt).toContain('Test Agent');
      expect(prompt).toContain('logical');
      expect(prompt).toContain('precision');
      expect(prompt).toContain('Test personality');
      expect(prompt).toContain('test');
      expect(prompt).toContain('session');
      expect(prompt).toContain('English');
    });

    it('should generate Japanese personality prompt', () => {
      const agent = {
        name: 'テストエージェント',
        style: '論理的',
        priority: '精密性',
        personality: 'テスト性格',
        preferences: ['テスト'],
        memoryScope: 'セッション',
        tone: 'プロフェッショナル',
        communicationStyle: 'フォーマル'
      };

      const prompt = getPersonalityPrompt(agent, 'ja');
      expect(prompt).toContain('テストエージェント');
      expect(prompt).toContain('論理的');
      expect(prompt).toContain('精密性');
      expect(prompt).toContain('テスト性格');
      expect(prompt).toContain('テスト');
      expect(prompt).toContain('セッション');
      expect(prompt).toContain('日本語');
    });

    it('should default to English for unknown language', () => {
      const agent = {
        name: 'Test Agent',
        style: 'logical',
        priority: 'precision',
        personality: 'Test personality',
        preferences: ['test'],
        memoryScope: 'session',
        tone: 'professional',
        communicationStyle: 'formal'
      };

      const prompt = getPersonalityPrompt(agent, 'fr' as any);
      expect(prompt).toContain('English');
    });
  });

  describe('getStagePrompt', () => {
    it('should generate English stage prompt', () => {
      const personalityPrompt = 'You are Test Agent';
      const variables = {
        query: 'Test query',
        context: 'Test context'
      };

      const prompt = getStagePrompt('individual-thought', personalityPrompt, variables, 'en');
      expect(prompt).toContain('You are Test Agent');
      expect(prompt).toContain('STAGE 1 - INDIVIDUAL THOUGHT');
      expect(prompt).toContain('Test query');
    });

    it('should generate Japanese stage prompt', () => {
      const personalityPrompt = 'あなたはテストエージェントです';
      const variables = {
        query: 'テストクエリ',
        context: 'テストコンテキスト'
      };

      const prompt = getStagePrompt('individual-thought', personalityPrompt, variables, 'ja');
      expect(prompt).toContain('あなたはテストエージェントです');
      expect(prompt).toContain('ステージ1 - 個別思考');
      expect(prompt).toContain('テストクエリ');
    });

    it('should handle all stages', () => {
      const personalityPrompt = 'You are Test Agent';
      const variables = { query: 'Test', context: 'Test' };
      const stages: DialogueStage[] = [
        'individual-thought',
        'mutual-reflection',
        'conflict-resolution',
        'synthesis-attempt',
        'output-generation'
      ];

      stages.forEach(stage => {
        const prompt = getStagePrompt(stage, personalityPrompt, variables, 'en');
        expect(prompt).toContain('You are Test Agent');
        expect(prompt).toContain('Test');
      });
    });
  });

  describe('formatPrompt', () => {
    it('should format prompt with variables', () => {
      const template = 'Hello {name}, you are {role}';
      const variables = { name: 'Alice', role: 'developer' };
      const result = formatPrompt(template, variables);
      expect(result).toBe('Hello Alice, you are developer');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {name}, you are {role}';
      const variables = { name: 'Alice' };
      const result = formatPrompt(template, variables);
      expect(result).toBe('Hello Alice, you are {role}');
    });

    it('should handle empty variables', () => {
      const template = 'Hello {name}';
      const result = formatPrompt(template, {});
      expect(result).toBe('Hello {name}');
    });

    it('should handle template without variables', () => {
      const template = 'Hello world';
      const result = formatPrompt(template, { name: 'Alice' });
      expect(result).toBe('Hello world');
    });
  });
}); 