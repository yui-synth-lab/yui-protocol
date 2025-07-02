import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../src/agents/base-agent.js';
import { Agent, Message, DialogueStage, Language } from '../src/types/index.js';
import { AIExecutor, createAIExecutor } from '../src/kernel/ai-executor.js';

// Create a concrete implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  async respond(prompt: string, context: Message[]): Promise<any> {
    return { content: 'Test response' };
  }

  async stage1IndividualThought(prompt: string, context: Message[]): Promise<any> {
    return { content: 'Individual thought' };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: any[], context: Message[]): Promise<any> {
    return { content: 'Mutual reflection' };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[]): Promise<any> {
    return { content: 'Conflict resolution' };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[]): Promise<any> {
    return { content: 'Synthesis attempt' };
  }

  async stage5OutputGeneration(finalData: any, context: Message[]): Promise<any> {
    return { content: 'Output generation' };
  }
}

// Mock AI Executor for testing
class MockAIExecutor extends AIExecutor {
  constructor() {
    super({
      agentName: 'TestAgent',
      model: 'test-model',
      provider: 'custom'
    });
  }

  async execute(prompt: string): Promise<any> {
    return {
      content: `[TestAgent] Mock response to: ${prompt}`,
      model: this.model,
      duration: 100,
      success: true
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let testAgent: Agent;
  let testMessage: Message;

  beforeEach(() => {
    testAgent = {
      id: 'test-agent-1',
      name: 'Test Agent',
      style: 'analytical',
      personality: 'Analytical and precise',
      priority: 'precision',
      memoryScope: 'session',
      preferences: ['reasoning', 'analysis'],
      tone: 'analytical, precise',
      communicationStyle: 'structured, evidence-based'
    };
    agent = new TestAgent(testAgent);
    testMessage = {
      id: 'test-message-1',
      agentId: 'test-agent-1',
      content: 'Test message content',
      timestamp: new Date(),
      role: 'user'
    };
  });

  describe('constructor', () => {
    it('should initialize agent with provided agent data', () => {
      expect(agent.getAgent()).toEqual(testAgent);
    });

    it('should initialize with empty memory', () => {
      expect(agent.getMemory()).toEqual([]);
    });

    it('should initialize with default language', () => {
      expect(agent.getLanguage()).toBe('en');
    });

    it('should initialize AI executor promise', () => {
      expect(agent['aiExecutorPromise']).toBeDefined();
      expect(agent['aiExecutor']).toBeUndefined(); // Should be undefined initially
    });
  });

  describe('AI execution methods', () => {
    it('should execute AI successfully', async () => {
      // Mock the AI executor to avoid real API calls
      const mockExecutor = new MockAIExecutor();
      agent['aiExecutor'] = mockExecutor;
      
      const result = await agent['executeAI']('Test prompt');
      expect(result).toContain('TestAgent');
      expect(result).toContain('Test prompt');
    });

    it('should execute AI with truncation', async () => {
      // Mock the AI executor to avoid real API calls
      const mockExecutor = new MockAIExecutor();
      agent['aiExecutor'] = mockExecutor;
      
      const result = await agent['executeAIWithTruncation']('Test prompt');
      expect(result).toContain('TestAgent');
      expect(result).toContain('Test prompt');
    });

    it('should handle AI execution errors gracefully', async () => {
      // Mock the AI executor to return an error
      const mockExecutor = {
        agentName: 'TestAgent',
        maxTokens: 4000,
        model: 'test-model',
        provider: 'custom',
        customConfig: {},
        execute: vi.fn().mockResolvedValue({
          content: 'Error fallback response',
          success: false,
          error: 'Test error'
        }),
      } as any;
      
      agent['aiExecutor'] = mockExecutor;
      
      const result = await agent['executeAI']('Test prompt');
      expect(result).toBe('Error fallback response');
    });

    it('should ensure AI executor is properly cached after initialization', async () => {
      // Create a new agent
      const agent2 = new TestAgent(testAgent);
      
      // Initially aiExecutor is undefined
      expect(agent2['aiExecutor']).toBeUndefined();
      
      // Call ensureAIExecutor directly to initialize
      const executor1 = await agent2['ensureAIExecutor']();
      expect(agent2['aiExecutor']).toBeDefined();
      expect(agent2['aiExecutor']).toBe(executor1);
      
      // Call ensureAIExecutor again
      const executor2 = await agent2['ensureAIExecutor']();
      
      // Same instance is returned (cached)
      expect(executor2).toBe(executor1);
      expect(agent2['aiExecutor']).toBe(executor1);
      
      // Even more calls return the same instance
      const executor3 = await agent2['ensureAIExecutor']();
      expect(executor3).toBe(executor1);
    });
  });

  describe('Legacy AI methods', () => {
    beforeEach(() => {
      // Mock the AI executor to avoid real API calls
      const mockExecutor = new MockAIExecutor();
      agent['aiExecutor'] = mockExecutor;
    });

    it('should maintain backward compatibility with callGeminiCli', async () => {
      const result = await agent['callGeminiCli']('Legacy prompt');
      expect(result).toContain('TestAgent');
      expect(result).toContain('Legacy prompt');
    });

    it('should maintain backward compatibility with callGeminiCliWithTruncation', async () => {
      const result = await agent['callGeminiCliWithTruncation']('Legacy prompt');
      expect(result).toContain('TestAgent');
      expect(result).toContain('Legacy prompt');
    });
  });

  describe('getAgent', () => {
    it('should return the agent data', () => {
      const returnedAgent = agent.getAgent();
      expect(returnedAgent).toEqual(testAgent);
    });
  });

  describe('getMemory', () => {
    it('should return a copy of memory', () => {
      agent['addToMemory'](testMessage);
      const memory = agent.getMemory();
      
      expect(memory).toHaveLength(1);
      expect(memory[0]).toEqual(testMessage);
      
      // Should be a copy, not the same reference
      expect(memory).not.toBe(agent['memory']);
    });
  });

  describe('clearMemory', () => {
    it('should clear all memory', () => {
      agent['addToMemory'](testMessage);
      expect(agent.getMemory()).toHaveLength(1);
      
      agent.clearMemory();
      expect(agent.getMemory()).toHaveLength(0);
    });
  });

  describe('addToMemory', () => {
    it('should add message to memory', () => {
      agent['addToMemory'](testMessage);
      expect(agent.getMemory()).toHaveLength(1);
      expect(agent.getMemory()[0]).toEqual(testMessage);
    });

    it('should respect memory scope limits', () => {
      // Test local scope (max 20 messages)
      const localAgent = new TestAgent({ ...testAgent, memoryScope: 'local' });
      
      // Add 25 messages
      for (let i = 0; i < 25; i++) {
        localAgent['addToMemory']({ ...testMessage, id: `msg-${i}` });
      }
      
      expect(localAgent.getMemory()).toHaveLength(20);
      expect(localAgent.getMemory()[0].id).toBe('msg-5'); // Should keep last 20
    });

    it('should respect session scope limits', () => {
      const sessionAgent = new TestAgent({ ...testAgent, memoryScope: 'session' });
      
      // Add 110 messages
      for (let i = 0; i < 110; i++) {
        sessionAgent['addToMemory']({ ...testMessage, id: `msg-${i}` });
      }
      
      expect(sessionAgent.getMemory()).toHaveLength(100);
      expect(sessionAgent.getMemory()[0].id).toBe('msg-10'); // Should keep last 100
    });

    it('should respect cross-session scope limits', () => {
      const crossSessionAgent = new TestAgent({ ...testAgent, memoryScope: 'cross-session' });
      
      // Add 600 messages
      for (let i = 0; i < 600; i++) {
        crossSessionAgent['addToMemory']({ ...testMessage, id: `msg-${i}` });
      }
      
      expect(crossSessionAgent.getMemory()).toHaveLength(500);
      expect(crossSessionAgent.getMemory()[0].id).toBe('msg-100'); // Should keep last 500
    });
  });

  describe('getRelevantContext', () => {
    it('should return limited context for local scope', () => {
      const context = Array.from({ length: 30 }, (_, i) => ({
        ...testMessage,
        id: `context-${i}`,
        content: `Context message ${i}`
      }));
      
      const localAgent = new TestAgent({ ...testAgent, memoryScope: 'local' });
      const relevantContext = localAgent['getRelevantContext'](context);
      
      expect(relevantContext).toHaveLength(5);
      expect(relevantContext[0].id).toBe('context-25');
      expect(relevantContext[4].id).toBe('context-29');
    });

    it('should return session-level context for session scope', () => {
      const context = Array.from({ length: 30 }, (_, i) => ({
        ...testMessage,
        id: `context-${i}`,
        content: `Context message ${i}`
      }));
      
      const sessionAgent = new TestAgent({ ...testAgent, memoryScope: 'session' });
      const relevantContext = sessionAgent['getRelevantContext'](context);
      
      expect(relevantContext).toHaveLength(20);
      expect(relevantContext[0].id).toBe('context-10');
      expect(relevantContext[19].id).toBe('context-29');
    });

    it('should return full context for cross-session scope', () => {
      const context = Array.from({ length: 30 }, (_, i) => ({
        ...testMessage,
        id: `context-${i}`,
        content: `Context message ${i}`
      }));
      
      const crossSessionAgent = new TestAgent({ ...testAgent, memoryScope: 'cross-session' });
      const relevantContext = crossSessionAgent['getRelevantContext'](context);
      
      expect(relevantContext).toHaveLength(30);
      expect(relevantContext[0].id).toBe('context-0');
      expect(relevantContext[29].id).toBe('context-29');
    });

    it('should return default context for unknown scope', () => {
      const context = Array.from({ length: 30 }, (_, i) => ({
        ...testMessage,
        id: `context-${i}`,
        content: `Context message ${i}`
      }));
      
      const unknownAgent = new TestAgent({ ...testAgent, memoryScope: 'unknown' as any });
      const relevantContext = unknownAgent['getRelevantContext'](context);
      
      expect(relevantContext).toHaveLength(10);
      expect(relevantContext[0].id).toBe('context-20');
      expect(relevantContext[9].id).toBe('context-29');
    });

    it('should handle context with fewer messages than requested', () => {
      const context = Array.from({ length: 30 }, (_, i) => ({
        ...testMessage,
        id: `context-${i}`,
        content: `Context message ${i}`
      }));
      
      const shortContext = context.slice(0, 3); // Only 3 messages
      const relevantContext = agent['getRelevantContext'](shortContext);
      
      expect(relevantContext).toHaveLength(3);
      expect(relevantContext[0].id).toBe('context-0');
      expect(relevantContext[2].id).toBe('context-2');
    });
  });

  describe('generateConfidence', () => {
    it('should generate confidence within expected range', async () => {
      const confidence = await agent['generateConfidence']();
      expect(confidence).toBeGreaterThanOrEqual(0.1);
      expect(confidence).toBeLessThanOrEqual(0.95);
    });

    it('should adjust confidence based on precision priority', async () => {
      const precisionAgent = new TestAgent({ ...testAgent, priority: 'precision' });
      const confidence = await precisionAgent['generateConfidence']();
      expect(confidence).toBeLessThan(0.7); // Should be lower due to precision focus
    });

    it('should adjust confidence based on breadth priority', async () => {
      const breadthAgent = new TestAgent({ ...testAgent, priority: 'breadth' });
      const confidence = await breadthAgent['generateConfidence']();
      expect(confidence).toBeGreaterThan(0.5); // Should be higher due to breadth focus
    });

    it('should use standard confidence for depth priority', async () => {
      const depthAgent = new TestAgent({ ...testAgent, priority: 'depth' });
      const confidence = await depthAgent['generateConfidence']();
      expect(confidence).toBeGreaterThanOrEqual(0.1);
      expect(confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('setLanguage and getLanguage', () => {
    it('should set and get language correctly', () => {
      expect(agent.getLanguage()).toBe('en');
      
      agent.setLanguage('ja');
      expect(agent.getLanguage()).toBe('ja');
      
      agent.setLanguage('en');
      expect(agent.getLanguage()).toBe('en');
    });
  });

  describe('abstract methods', () => {
    it('should implement respond method', async () => {
      const response = await agent.respond('Test prompt', []);
      expect(response).toEqual({ content: 'Test response' });
    });

    it('should implement stage1IndividualThought method', async () => {
      const thought = await agent.stage1IndividualThought('Test prompt', []);
      expect(thought).toEqual({ content: 'Individual thought' });
    });

    it('should implement stage2MutualReflection method', async () => {
      const reflection = await agent.stage2MutualReflection('Test prompt', [], []);
      expect(reflection).toEqual({ content: 'Mutual reflection' });
    });

    it('should implement stage3ConflictResolution method', async () => {
      const resolution = await agent.stage3ConflictResolution([], []);
      expect(resolution).toEqual({ content: 'Conflict resolution' });
    });

    it('should implement stage4SynthesisAttempt method', async () => {
      const synthesis = await agent.stage4SynthesisAttempt({}, []);
      expect(synthesis).toEqual({ content: 'Synthesis attempt' });
    });

    it('should implement stage5OutputGeneration method', async () => {
      const output = await agent.stage5OutputGeneration({}, []);
      expect(output).toEqual({ content: 'Output generation' });
    });
  });

  describe('memory management edge cases', () => {
    it('should handle empty memory gracefully', () => {
      expect(agent.getMemory()).toEqual([]);
      agent.clearMemory();
      expect(agent.getMemory()).toEqual([]);
    });

    it('should handle memory scope with fewer messages than limit', () => {
      const localAgent = new TestAgent({ ...testAgent, memoryScope: 'local' });
      
      // Add only 5 messages (less than limit of 20)
      for (let i = 0; i < 5; i++) {
        localAgent['addToMemory']({ ...testMessage, id: `msg-${i}` });
      }
      
      expect(localAgent.getMemory()).toHaveLength(5);
      expect(localAgent.getMemory()[0].id).toBe('msg-0');
      expect(localAgent.getMemory()[4].id).toBe('msg-4');
    });
  });
}); 