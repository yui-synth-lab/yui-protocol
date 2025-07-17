import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../src/agents/base-agent.js';
import { Agent, Message, DialogueStage, Language } from '../src/types/index.js';
import { AIExecutor, createAIExecutor } from '../src/kernel/ai-executor.js';

// Create a concrete implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  async respond(prompt: string, context: Message[], language: Language): Promise<any> {
    return { content: 'Test response' };
  }

  async stage1IndividualThought(prompt: string, context: Message[], language: Language): Promise<any> {
    return { content: 'Individual thought' };
  }

  async stage2MutualReflection(prompt: string, otherThoughts: any[], context: Message[], AgentList: any[] = [], language: Language): Promise<any> {
    return { content: 'Mutual reflection' };
  }

  async stage3ConflictResolution(conflicts: any[], context: Message[], language: Language): Promise<any> {
    return { content: 'Conflict resolution' };
  }

  async stage4SynthesisAttempt(synthesisData: any, context: Message[], language: Language): Promise<any> {
    return { content: 'Synthesis attempt' };
  }

  async stage5OutputGeneration(finalData: any, context: Message[], language: Language): Promise<any> {
    return { content: 'Output generation' };
  }

  async stage2_5MutualReflectionSummary(responses: any[], context: Message[] = [], language: Language): Promise<any> {
    return { content: 'Mutual reflection summary' };
  }

  async stage3_5ConflictResolutionSummary(responses: any[], context: Message[] = [], language: Language): Promise<any> {
    return { content: 'Conflict resolution summary' };
  }

  async stage4_5SynthesisAttemptSummary(responses: any[], context: Message[] = [], language: Language): Promise<any> {
    return { content: 'Synthesis attempt summary' };
  }

  async stage5_1Finalize(votingResults: any, responses: any[], context: Message[] = [], language: Language): Promise<any> {
    return { content: 'Finalize' };
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

// Add a custom agent for override test
class CustomAgent extends BaseAgent {
  protected getReferences(): string[] {
    return ['custom-ref'];
  }
  protected getReasoning(contextAnalysis: string): string {
    return `custom-reasoning: ${contextAnalysis}`;
  }
  protected getAssumptions(): string[] {
    return ['custom-assumption'];
  }
  protected getApproach(): string {
    return 'custom-approach';
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
      furigana: 'テストエージェント',
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

    // Remove or comment out the test for getLanguage in 'should initialize with default language'
    // it('should initialize with default language', () => {
    //   expect(agent.getLanguage()).toBe('en');
    // });

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
          error: 'Test error',
          errorDetails: {
            type: 'TEST_ERROR',
            message: 'Test error message',
            stack: 'Test stack trace'
          }
        }),
      } as any;
      
      agent['aiExecutor'] = mockExecutor;
      agent.setSessionId('test-session-error');
      
      const result = await agent['executeAI']('Test prompt');
      expect(result).toBe('Error fallback response');
      
      // Check that error was logged
      const logs = await agent['interactionLogger'].getSessionLogs('test-session-error');
      const errorLog = logs.find(log => log.error);
      expect(errorLog).toBeDefined();
      expect(errorLog?.status).toBe('error');
      expect(errorLog?.error).toContain('AI execution failed: Test error');
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

    it('should handle AI execution errors with proper logging in executeAIWithErrorHandling', async () => {
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
          error: 'Test error with details',
          errorDetails: {
            type: 'EXECUTION_ERROR',
            message: 'Test error message',
            stack: 'Test stack trace'
          }
        }),
      } as any;
      
      agent['aiExecutor'] = mockExecutor;
      agent.setSessionId('test-session-error-handling');
      
      const result = await agent['executeAIWithErrorHandling'](
        'Test prompt',
        'test-session-error-handling',
        'individual-thought',
        'test operation'
      );
      
      expect(result).toBe('Error fallback response');
      
      // Check that error was logged with proper status
      const logs = await agent['interactionLogger'].getSessionLogs('test-session-error-handling');
      const errorLog = logs.find(log => log.error);
      expect(errorLog).toBeDefined();
      expect(errorLog?.status).toBe('error');
      expect(errorLog?.error).toContain('AI execution failed: Test error with details');
      expect(errorLog?.stage).toBe('individual-thought');
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

  describe('abstract methods', () => {
    it('should implement respond method', async () => {
      const response = await agent.respond('Test prompt', [], 'en');
      expect(response).toEqual({ content: 'Test response' });
    });

    it('should implement stage1IndividualThought method', async () => {
      const thought = await agent.stage1IndividualThought('Test prompt', [], 'en');
      expect(thought).toEqual({ content: 'Individual thought' });
    });

    it('should implement stage2MutualReflection method', async () => {
      const reflection = await agent.stage2MutualReflection('Test prompt', [], [], [], 'en');
      expect(reflection).toEqual({ content: 'Mutual reflection' });
    });

    it('should implement stage3ConflictResolution method', async () => {
      const resolution = await agent.stage3ConflictResolution([], [], 'en');
      expect(resolution).toEqual({ content: 'Conflict resolution' });
    });

    it('should implement stage4SynthesisAttempt method', async () => {
      const synthesis = await agent.stage4SynthesisAttempt({}, [], 'en');
      expect(synthesis).toEqual({ content: 'Synthesis attempt' });
    });

    it('should implement stage5OutputGeneration method', async () => {
      const output = await agent.stage5OutputGeneration({}, [], 'en');
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

  describe('parseReflectionsFromContent', () => {
    it('should parse reflections with agreement', () => {
      const content = `
        慧露さんのClaude選択は興味深いです。その論理的思考力は素晴らしいと思います。
        観至さんのMistral DeepSeek選択も理解できます。
      `;
      
      const otherThoughts = [
        { 
          agentId: 'eiro-001', 
          content: 'Claudeを選びます',
          reasoning: '論理的思考力が優れているため',
          assumptions: ['Claudeが最適'],
          approach: '分析的なアプローチ'
        },
        { 
          agentId: 'kanshi-001', 
          content: 'Mistral DeepSeekを選びます',
          reasoning: '数学的推論力が優れているため',
          assumptions: ['Mistral DeepSeekが最適'],
          approach: '数学的なアプローチ'
        }
      ];
      
      const agents = [
        { ...testAgent, id: 'eiro-001', name: '慧露' },
        { ...testAgent, id: 'kanshi-001', name: '観至' }
      ];
      
      const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
      
      expect(reflections).toHaveLength(2);
      expect(reflections[0].targetAgentId).toBe('eiro-001');
      expect(reflections[0].agreement).toBe(true);
      expect(reflections[0].reaction).toContain('慧露');
      expect(reflections[1].targetAgentId).toBe('kanshi-001');
      expect(reflections[1].agreement).toBe(true);
    });

    it('should parse reflections with disagreement', () => {
      const content = `
        碧統さんの分析は論理的ですが、私の感情的なアプローチとは異なります。
        陽雅さんの詩的表現へのこだわりは理解できますが、実用性とのバランスはどう考えていますか？
      `;
      
      const otherThoughts = [
        { 
          agentId: 'hekito-001', 
          content: '分析的なアプローチを重視します',
          reasoning: '論理的思考が重要',
          assumptions: ['分析が最適'],
          approach: '分析的なアプローチ'
        },
        { 
          agentId: 'yoga-001', 
          content: '詩的表現を重視します',
          reasoning: '感情的な表現が重要',
          assumptions: ['詩的表現が最適'],
          approach: '感情的なアプローチ'
        }
      ];
      
      const agents = [
        { ...testAgent, id: 'hekito-001', name: '慧露' },
        { ...testAgent, id: 'yoga-001', name: '陽雅' }
      ];
      
      const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
      
      expect(reflections[0].targetAgentId).toBe('hekito-001');
      expect(reflections[0].agreement).toBe(false); // 異なります
      expect(reflections[1].targetAgentId).toBe('yoga-001');
      expect(reflections[1].questions.length).toBeGreaterThan(0); // 質問がある
    });

    it('should extract questions from content', () => {
      const content = '慧露さん、どのような場面で役立つと思いますか？\n観至さん、バランスはどう考えていますか？';
      const otherThoughts = [
        { agentId: 'hekito-001', content: 'test', reasoning: '', assumptions: [], approach: '' },
        { agentId: 'kanshi-001', content: 'test', reasoning: '', assumptions: [], approach: '' }
      ];
      const agents = [
        { ...testAgent, id: 'hekito-001', name: '慧露' },
        { ...testAgent, id: 'kanshi-001', name: '観至' }
      ];
      const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
      
      expect(reflections[0].questions.length).toBeGreaterThan(0);
      expect(reflections[0].questions[0]).toContain('どのような場面');
      expect(reflections[1].questions.length).toBeGreaterThan(0);
      expect(reflections[1].questions[0]).toContain('バランス');
    });

    it('should handle content without agent mentions', () => {
      const content = '一般的なコメントです。';
      
      const otherThoughts = [
        { 
          agentId: 'eiro-001', 
          content: 'Claudeを選びます',
          reasoning: '論理的思考力が優れているため',
          assumptions: ['Claudeが最適'],
          approach: '分析的なアプローチ'
        }
      ];
      
      const agents = [
        { ...testAgent, id: 'eiro-001', name: '慧露' }
      ];
      
      const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
      
      expect(reflections).toHaveLength(1);
      expect(reflections[0].targetAgentId).toBe('eiro-001');
      expect(reflections[0].reaction).toBe('No direct engagement with this agent\'s perspective');
      expect(reflections[0].agreement).toBe(false);
      expect(reflections[0].questions).toEqual([]);
    });

    it('should handle mixed agreement and disagreement', () => {
      const content = `
        慧露さんのClaude選択には同意します。素晴らしい選択だと思います。
        しかし、観至さんのMistral DeepSeek選択には疑問があります。なぜその選択をしたのでしょうか？
      `;
      
      const otherThoughts = [
        { 
          agentId: 'eiro-001', 
          content: 'Claudeを選びます',
          reasoning: '論理的思考力が優れているため',
          assumptions: ['Claudeが最適'],
          approach: '分析的なアプローチ'
        },
        { 
          agentId: 'kanshi-001', 
          content: 'Mistral DeepSeekを選びます',
          reasoning: '数学的推論力が優れているため',
          assumptions: ['Mistral DeepSeekが最適'],
          approach: '数学的なアプローチ'
        }
      ];
      
      const agents = [
        { ...testAgent, id: 'eiro-001', name: '慧露' },
        { ...testAgent, id: 'kanshi-001', name: '観至' }
      ];
      
      const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
      
      expect(reflections[0].agreement).toBe(true); // 同意
      expect(reflections[1].agreement).toBe(false); // 疑問
      expect(reflections[1].questions.length).toBeGreaterThan(0);
    });
  });
});

describe('BaseAgent (overrides)', () => {
  let agent: CustomAgent;
  let testAgent: Agent;
  let testMessage: Message;
  beforeEach(() => {
    testAgent = {
      id: 'custom-1',
      name: 'Custom Name',
      furigana: 'カスタム',
      style: 'meta',
      personality: 'Meta',
      priority: 'balance',
      memoryScope: 'session',
      preferences: ['meta'],
      tone: 'meta',
      communicationStyle: 'meta'
    };
    agent = new CustomAgent(testAgent);
    testMessage = {
      id: 'msg-1',
      agentId: 'custom-1',
      content: 'Prompt',
      timestamp: new Date(),
      role: 'user'
    };
  });
  it('should use overridden getReferences, getReasoning, getAssumptions, getApproach', async () => {
    const resp = await agent.respond('Prompt', [testMessage]);
    expect(resp.references).toEqual(['custom-ref']);
    expect(resp.reasoning).toContain('custom-reasoning');
    if (resp.stageData) {
      expect(resp.stageData.assumptions).toEqual(['custom-assumption']);
      expect(resp.stageData.approach).toBe('custom-approach');
    }
  });
  it('parseReflectionsFromContent uses agent.name as displayName', () => {
    const otherThoughts = [{ agentId: 'custom-1', content: 'test', reasoning: '', assumptions: [], approach: '' }];
    const agents = [testAgent];
    const content = 'Custom Nameに同意します。';
    const result = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(result[0].targetAgentId).toBe('custom-1');
    expect(result[0].agreement).toBe(true);
  });

  it('parseReflectionsFromContent should parse reflections with agreement', () => {
    const otherThoughts = [
      { agentId: 'eiro-001', content: 'test', reasoning: '', assumptions: [], approach: '' },
      { agentId: 'kanshi-001', content: 'test', reasoning: '', assumptions: [], approach: '' }
    ];
    const agents = [
      { ...testAgent, id: 'eiro-001', name: '慧露' },
      { ...testAgent, id: 'kanshi-001', name: '観至' }
    ];
    const content = '慧露に同意します。観至に同意します。';
    const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(reflections).toHaveLength(2);
    expect(reflections[0].targetAgentId).toBe('eiro-001');
    expect(reflections[0].agreement).toBe(true);
    expect(reflections[0].reaction).toContain('慧露');
    expect(reflections[1].targetAgentId).toBe('kanshi-001');
    expect(reflections[1].agreement).toBe(true);
    expect(reflections[1].reaction).toContain('観至');
  });

  it('parseReflectionsFromContent should parse reflections with disagreement', () => {
    const otherThoughts = [
      { agentId: 'eiro-001', content: 'test', reasoning: '', assumptions: [], approach: '' },
      { agentId: 'yoga-001', content: 'test', reasoning: '', assumptions: [], approach: '' }
    ];
    const agents = [
      { ...testAgent, id: 'eiro-001', name: '慧露' },
      { ...testAgent, id: 'yoga-001', name: '陽雅' }
    ];
    const content = '慧露の意見には反対です。陽雅さん、どのような場面で役立つと思いますか？';
    const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(reflections[0].agreement).toBe(false); // 反対
    expect(reflections[1].targetAgentId).toBe('yoga-001');
    expect(reflections[1].questions.length).toBeGreaterThan(0); // 質問がある
  });

  it('parseReflectionsFromContent should extract questions from content', () => {
    const otherThoughts = [
      { agentId: 'hekito-001', content: 'test', reasoning: '', assumptions: [], approach: '' },
      { agentId: 'kanshi-001', content: 'test', reasoning: '', assumptions: [], approach: '' }
    ];
    const agents = [
      { ...testAgent, id: 'hekito-001', name: '慧露' },
      { ...testAgent, id: 'kanshi-001', name: '観至' }
    ];
    const content = '慧露さん、どう思いますか？\n観至さん、何が問題ですか？';
    const reflections = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(reflections[0].questions.length).toBeGreaterThan(0);
    expect(reflections[0].questions[0]).toContain('どう思いますか');
    expect(reflections[1].questions.length).toBeGreaterThan(0);
    expect(reflections[1].questions[0]).toContain('何が問題');
  });

  it('parseReflectionsFromContent should handle content without agent mentions', () => {
    const otherThoughts = [{ agentId: 'custom-1', content: 'test', reasoning: '', assumptions: [], approach: '' }];
    const agents = [testAgent];
    const content = 'これは誰にも言及していません。';
    const result = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(result[0].agreement).toBe(false);
    expect(result[0].reaction).toBe('No direct engagement with this agent\'s perspective');
  });

  it('parseReflectionsFromContent should handle mixed agreement and disagreement', () => {
    const otherThoughts = [
      { agentId: 'custom-1', content: 'test', reasoning: '', assumptions: [], approach: '' },
      { agentId: 'custom-2', content: 'test2', reasoning: '', assumptions: [], approach: '' }
    ];
    const agents = [testAgent, { ...testAgent, id: 'custom-2', name: 'Other Agent' }];
    const content = 'Custom Nameに同意します。\nOther Agentには反対です。\nOther Agentさん、どう思いますか？';
    const result = agent['parseReflectionsFromContent'](content, otherThoughts, agents);
    expect(result[0].agreement).toBe(true); // 同意
    expect(result[1].agreement).toBe(false); // 反対
    expect(result[1].questions.length).toBeGreaterThan(0);
  });
}); 