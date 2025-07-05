import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YuiProtocolRouter } from '../src/kernel/router.js';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { OutputStorage } from '../src/kernel/output-storage.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';
import { createStageSummarizer } from '../src/kernel/stage-summarizer.js';
import { AgentManager } from '../src/kernel/services/agent-manager.js';
import { SessionManager } from '../src/kernel/services/session-manager.js';
import { Agent, Session, DialogueStage, Language } from '../src/types/index.js';

// Mock dependencies
vi.mock('../src/kernel/session-storage.js');
vi.mock('../src/kernel/output-storage.js');
vi.mock('../src/kernel/interaction-logger.js');
vi.mock('../src/kernel/stage-summarizer.js');
vi.mock('../src/kernel/services/agent-manager.js');
vi.mock('../src/kernel/services/session-manager.js');

describe('YuiProtocolRouter (Refactored)', () => {
  let router: YuiProtocolRouter;
  let mockSessionStorage: any;
  let mockOutputStorage: any;
  let mockInteractionLogger: any;
  let mockStageSummarizer: any;
  let mockAgentManager: any;
  let mockSessionManager: any;

  const mockAgent: Agent = {
    id: 'test-agent',
    name: 'Test Agent',
    furigana: 'テストエージェント',
    style: 'logical',
    priority: 'precision',
    memoryScope: 'local',
    personality: 'Test personality',
    preferences: ['test'],
    tone: 'formal',
    communicationStyle: 'direct'
  };

  const mockSession: Session = {
    id: 'test-session',
    title: 'Test Session',
    agents: [mockAgent],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    stageHistory: [],
    language: 'en'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSessionStorage = {
      getAllSessions: vi.fn().mockResolvedValue([]),
      saveSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(true)
    };

    mockOutputStorage = {
      saveOutput: vi.fn().mockResolvedValue(undefined),
      getAllOutputs: vi.fn().mockResolvedValue([]),
      getOutput: vi.fn().mockResolvedValue(null),
      deleteOutput: vi.fn().mockResolvedValue(true)
    };

    mockInteractionLogger = {
      saveInteractionLog: vi.fn().mockResolvedValue(undefined)
    };

    mockStageSummarizer = {
      summarizeStage: vi.fn().mockResolvedValue('Test summary'),
      formatSummaryForPrompt: vi.fn().mockReturnValue('Formatted summary')
    };

    mockAgentManager = {
      getAgent: vi.fn(),
      getAllAgents: vi.fn().mockReturnValue([]),
      getAvailableAgents: vi.fn().mockReturnValue([mockAgent]),
      initializeAgents: vi.fn().mockResolvedValue(undefined),
      addAgent: vi.fn(),
      clearAgents: vi.fn()
    };

    mockSessionManager = {
      getSession: vi.fn().mockResolvedValue(mockSession),
      getAllSessions: vi.fn().mockResolvedValue([mockSession]),
      createSession: vi.fn().mockResolvedValue(mockSession),
      saveSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(true),
      resetSession: vi.fn().mockResolvedValue(mockSession),
      startNewSequence: vi.fn().mockResolvedValue(mockSession),
      addSession: vi.fn(),
      clearSessions: vi.fn()
    };

    vi.mocked(createStageSummarizer).mockReturnValue(mockStageSummarizer);
    vi.mocked(AgentManager).mockImplementation(() => mockAgentManager);
    vi.mocked(SessionManager).mockImplementation(() => mockSessionManager);

    router = new YuiProtocolRouter(
      mockSessionStorage as any,
      mockOutputStorage as any,
      mockInteractionLogger as any,
      {},
      { stageSummarizerDelayMS: 30000, finalSummaryDelayMS: 60000 },
      mockAgentManager,
      mockSessionManager
    );
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(router.getDefaultLanguage()).toBe('en');
      expect(router.getAvailableAgents()).toEqual([mockAgent]);
    });

    it('should initialize with custom delay options', () => {
      const customRouter = new YuiProtocolRouter(
        mockSessionStorage as any,
        mockOutputStorage as any,
        mockInteractionLogger as any,
        {},
        { stageSummarizerDelayMS: 60000, finalSummaryDelayMS: 120000 },
        mockAgentManager,
        mockSessionManager
      );

      expect(customRouter.getDefaultLanguage()).toBe('en');
    });

    it('should initialize with injected dependencies', () => {
      expect(router.getAgentManager()).toBe(mockAgentManager);
      expect(router.getSessionManager()).toBe(mockSessionManager);
    });
  });

  describe('executeStageRealtime', () => {
    it('should execute stage successfully', async () => {
      const result = await router.executeStageRealtime(
        'test-session',
        'Test prompt',
        'individual-thought',
        'en'
      );

      expect(result).toEqual({
        stage: 'individual-thought',
        agentResponses: [],
        duration: expect.any(Number)
      });

      expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session');
      expect(mockSessionManager.saveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should throw error for non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(undefined);

      await expect(
        router.executeStageRealtime(
          'non-existent-session',
          'Test prompt',
          'individual-thought',
          'en'
        )
      ).rejects.toThrow('Session non-existent-session not found');
    });
  });

  describe('session management', () => {
    it('should get session', async () => {
      const session = await router.getSession('test-session');
      expect(session).toEqual(mockSession);
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session');
    });

    it('should get all sessions', async () => {
      const sessions = await router.getAllSessions();
      expect(sessions).toEqual([mockSession]);
      expect(mockSessionManager.getAllSessions).toHaveBeenCalled();
    });

    it('should create session', async () => {
      const newSession = await router.createSession('New Session', ['test-agent'], 'en');
      expect(newSession).toEqual(mockSession);
      expect(mockSessionManager.createSession).toHaveBeenCalledWith('New Session', ['test-agent'], 'en');
    });

    it('should delete session', async () => {
      const result = await router.deleteSession('test-session');
      expect(result).toBe(true);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('test-session');
    });

    it('should reset session', async () => {
      const result = await router.resetSession('test-session');
      expect(result).toEqual(mockSession);
      expect(mockSessionManager.resetSession).toHaveBeenCalledWith('test-session');
    });

    it('should start new sequence', async () => {
      const result = await router.startNewSequence('test-session');
      expect(result).toEqual(mockSession);
      expect(mockSessionManager.startNewSequence).toHaveBeenCalledWith('test-session');
    });
  });

  describe('agent management', () => {
    it('should get available agents', () => {
      const agents = router.getAvailableAgents();
      expect(agents).toEqual([mockAgent]);
      expect(mockAgentManager.getAvailableAgents).toHaveBeenCalled();
    });
  });

  describe('language management', () => {
    it('should set and get default language', () => {
      router.setDefaultLanguage('ja');
      expect(router.getDefaultLanguage()).toBe('ja');
    });
  });

  describe('dependency injection', () => {
    it('should use injected dependencies', () => {
      expect(router.getAgentManager()).toBe(mockAgentManager);
      expect(router.getSessionManager()).toBe(mockSessionManager);
    });

    it('should create default dependencies when not injected', () => {
      // モックを一時的に無効化して実際のクラスをテスト
      vi.doUnmock('../src/kernel/services/agent-manager.js');
      vi.doUnmock('../src/kernel/services/session-manager.js');
      
      const routerWithDefaults = new YuiProtocolRouter(
        mockSessionStorage as any,
        mockOutputStorage as any,
        mockInteractionLogger as any,
        {},
        { stageSummarizerDelayMS: 30000, finalSummaryDelayMS: 60000 }
      );

      // 実際のインスタンスかどうかをチェック
      const agentManager = routerWithDefaults.getAgentManager();
      const sessionManager = routerWithDefaults.getSessionManager();
      
      expect(agentManager).toBeDefined();
      expect(sessionManager).toBeDefined();
      expect(typeof agentManager.getAgent).toBe('function');
      expect(typeof sessionManager.getSession).toBe('function');
      
      // モックを再有効化
      vi.doMock('../src/kernel/services/agent-manager.js');
      vi.doMock('../src/kernel/services/session-manager.js');
    });
  });
}); 