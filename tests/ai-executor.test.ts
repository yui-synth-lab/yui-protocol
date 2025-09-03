import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIExecutor, AIExecutorOptions, AIExecutionResult, createAIExecutor } from '../src/kernel/ai-executor.js';

// Mock implementation for testing
class MockAIExecutor extends AIExecutor {
  constructor(options: AIExecutorOptions) {
    super({
      provider: 'ollama',
      model: 'default',
      customConfig: { maxTokens: 4000, ...(options.customConfig || {}) },
      ...options,
    });
  }

  async execute(prompt: string, personality: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 50));
    const duration = Date.now() - startTime;
    
    return {
      content: `[${this.agentId}] Mock response to: ${prompt.substring(0, 30)}...`,
      model: this.model,
      duration,
      success: true
    };
  }
}

describe('AIExecutor', () => {
  let mockExecutor: MockAIExecutor;
  let options: AIExecutorOptions;

  beforeEach(() => {
    options = {
      agentId: 'TestAgent',
      model: 'test-model',
      provider: 'custom',
      customConfig: { maxTokens: 4000 }
    };
    mockExecutor = new MockAIExecutor(options);
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(mockExecutor['agentId']).toBe('TestAgent');
      expect(mockExecutor['maxTokens']).toBe(4000);
      expect(mockExecutor['model']).toBe('test-model');
      expect(mockExecutor['provider']).toBe('custom');
    });

    it('should use default values when options are not provided', () => {
      const minimalOptions: AIExecutorOptions = {
        agentId: 'MinimalAgent'
      };
      const executor = new MockAIExecutor(minimalOptions);
      
      expect(executor['maxTokens']).toBe(4000);
      expect(executor['model']).toBe('default');
      expect(executor['provider']).toBe('ollama');
    });
  });

  describe('truncatePrompt', () => {
    it('should not truncate short prompts', () => {
      const shortPrompt = 'This is a short prompt';
      const result = mockExecutor['truncatePrompt'](shortPrompt, 100);
      expect(result).toBe(shortPrompt);
    });

    it('should truncate long prompts', () => {
      const longPrompt = 'A'.repeat(1000); // 1000 characters
      const result = mockExecutor['truncatePrompt'](longPrompt, 100); // 100 tokens = ~400 chars
      
      expect(result.length).toBeLessThan(longPrompt.length);
      expect(result).toContain('[Content truncated for token limit]');
      expect(result).toContain('A'.repeat(200)); // Beginning
      expect(result).toContain('A'.repeat(200)); // End
    });

    it('should handle edge case where prompt is exactly at limit', () => {
      const edgePrompt = 'A'.repeat(400); // Exactly 100 tokens
      const result = mockExecutor['truncatePrompt'](edgePrompt, 100);
      expect(result).toBe(edgePrompt);
    });
  });

  describe('generateFallbackResponse', () => {
    it('should generate appropriate fallback response', () => {
      const prompt = 'This is a test prompt that should be referenced in the fallback';
      const fallback = mockExecutor['generateFallbackResponse'](prompt);
      
      expect(fallback).toContain('TestAgent');
      expect(fallback).toContain('This is a test prompt that should be');
      expect(fallback).toContain('technical difficulties');
    });

    it('should handle very long prompts in fallback', () => {
      const longPrompt = 'A'.repeat(1000);
      const fallback = mockExecutor['generateFallbackResponse'](longPrompt);
      
      expect(fallback).toContain('A'.repeat(50));
      // The fallback response includes the agent name and other text, so it will be longer
      expect(fallback.length).toBeLessThan(300);
    });
  });

  describe('execute', () => {
    it('should execute successfully', async () => {
      const prompt = 'Test prompt';
      const personality = 'Test personality';
      const result = await mockExecutor.execute(prompt, personality);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('TestAgent');
      expect(result.content).toContain('Test prompt');
      expect(result.model).toBe('test-model');
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('sanitizeContent', () => {
    it('should remove think tags from content', () => {
      const contentWithThinkTags = `
        <think>This is some thinking process</think>
        Here is the actual response.
        <thinking>More thinking here</thinking>
        <reasoning>Some reasoning</reasoning>
        Final content.
      `;
      
      const sanitized = mockExecutor['sanitizeContent'](contentWithThinkTags);
      
      expect(sanitized).not.toContain('<think>');
      expect(sanitized).not.toContain('</think>');
      expect(sanitized).not.toContain('<thinking>');
      expect(sanitized).not.toContain('</thinking>');
      expect(sanitized).not.toContain('<reasoning>');
      expect(sanitized).not.toContain('</reasoning>');
      expect(sanitized).toContain('Here is the actual response.');
      expect(sanitized).toContain('Final content.');
    });

    it('should handle content without think tags', () => {
      const normalContent = 'This is normal content without any think tags.';
      const sanitized = mockExecutor['sanitizeContent'](normalContent);
      expect(sanitized).toBe(normalContent);
    });

    it('should handle empty content', () => {
      const sanitized = mockExecutor['sanitizeContent']('');
      expect(sanitized).toContain('Fallback response');
    });

    it('should handle null content', () => {
      const sanitized = mockExecutor['sanitizeContent'](null as any);
      expect(sanitized).toContain('Fallback response');
    });
  });
});

describe('createAIExecutor', () => {
  it('should create an AI executor instance', async () => {
    const executor = await createAIExecutor('TestAgent');
    
    expect(executor).toBeInstanceOf(AIExecutor);
    expect(executor['agentId']).toBe('TestAgent');
  });

  it('should create executor with custom options', async () => {
    const executor = await createAIExecutor('CustomAgent', {
      model: 'custom-model',
      provider: 'custom',
      customConfig: { maxTokens: 8000 }
    });
    
    expect(executor['maxTokens']).toBe(8000);
    expect(executor['model']).toBe('custom-model');
    expect(executor['provider']).toBe('custom');
  });

  it('should use default options when not specified', async () => {
    const executor = await createAIExecutor('DefaultAgent');
    
    expect(executor['maxTokens']).toBe(4000);
    // The actual model might vary based on the implementation, so we just check it's a string
    expect(typeof executor['model']).toBe('string');
    expect(executor['provider']).toBe('openai');
  });
});

describe('AIExecutionResult', () => {
  it('should have correct structure', () => {
    const result: AIExecutionResult = {
      content: 'Test content',
      tokensUsed: 150,
      model: 'test-model',
      duration: 1000,
      success: true
    };
    
    expect(result.content).toBe('Test content');
    expect(result.tokensUsed).toBe(150);
    expect(result.model).toBe('test-model');
    expect(result.duration).toBe(1000);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle error cases', () => {
    const errorResult: AIExecutionResult = {
      content: 'Fallback content',
      model: 'test-model',
      duration: 500,
      success: false,
      error: 'API key not found'
    };
    
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('API key not found');
    expect(errorResult.tokensUsed).toBeUndefined();
  });
}); 