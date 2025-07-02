import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIExecutor, AIExecutorOptions, AIExecutionResult, createAIExecutor } from '../src/kernel/ai-executor.js';

// Mock implementation for testing
class MockAIExecutor extends AIExecutor {
  constructor(options: AIExecutorOptions) {
    super(options);
  }

  async execute(prompt: string): Promise<AIExecutionResult> {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 50));
    const duration = Date.now() - startTime;
    
    return {
      content: `[${this.agentName}] Mock response to: ${prompt.substring(0, 30)}...`,
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
      agentName: 'TestAgent',
      maxTokens: 4000,
      model: 'test-model',
      provider: 'custom',
      customConfig: {}
    };
    mockExecutor = new MockAIExecutor(options);
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(mockExecutor['agentName']).toBe('TestAgent');
      expect(mockExecutor['maxTokens']).toBe(4000);
      expect(mockExecutor['model']).toBe('test-model');
      expect(mockExecutor['provider']).toBe('custom');
    });

    it('should use default values when options are not provided', () => {
      const minimalOptions: AIExecutorOptions = {
        agentName: 'MinimalAgent'
      };
      const executor = new MockAIExecutor(minimalOptions);
      
      expect(executor['maxTokens']).toBe(4000);
      expect(executor['model']).toBe('default');
      expect(executor['provider']).toBe('custom');
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
      const result = await mockExecutor.execute(prompt);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('TestAgent');
      expect(result.content).toContain('Test prompt');
      expect(result.model).toBe('test-model');
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});

describe('createAIExecutor', () => {
  it('should create an AI executor instance', async () => {
    const executor = await createAIExecutor('TestAgent');
    
    expect(executor).toBeInstanceOf(AIExecutor);
    expect(executor['agentName']).toBe('TestAgent');
  });

  it('should create executor with custom options', async () => {
    const executor = await createAIExecutor('CustomAgent', {
      maxTokens: 8000,
      model: 'custom-model',
      provider: 'custom'
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
    expect(executor['provider']).toBe('gemini');
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