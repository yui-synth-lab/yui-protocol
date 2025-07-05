import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { YuiProtocolRouter } from '../src/kernel/router.js';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { OutputStorage } from '../src/kernel/output-storage.js';
import { InteractionLogger } from '../src/kernel/interaction-logger.js';
import { createStageSummarizer } from '../src/kernel/stage-summarizer.js';
import { Agent, Session, Language } from '../src/types/index.js';

// Mock dependencies
vi.mock('../src/kernel/router.js');
vi.mock('../src/kernel/session-storage.js');
vi.mock('../src/kernel/output-storage.js');
vi.mock('../src/kernel/interaction-logger.js');
vi.mock('../src/kernel/stage-summarizer.js');

describe('Server API', () => {
  let app: express.Application;
  let mockRealtimeRouter: any;
  let mockSessionStorage: any;
  let mockOutputStorage: any;
  let mockInteractionLogger: any;
  let mockStageSummarizer: any;

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
      summarizeStage: vi.fn().mockResolvedValue('Test summary')
    };

    vi.mocked(createStageSummarizer).mockReturnValue(mockStageSummarizer);

    mockRealtimeRouter = {
      getAvailableAgents: vi.fn().mockReturnValue([mockAgent]),
      getAllSessions: vi.fn().mockResolvedValue([mockSession]),
      createSession: vi.fn().mockResolvedValue(mockSession),
      getSession: vi.fn().mockReturnValue(mockSession),
      deleteSession: vi.fn().mockResolvedValue(true),
      setDefaultLanguage: vi.fn(),
      getDefaultLanguage: vi.fn().mockReturnValue('en'),
      saveFinalOutput: vi.fn().mockResolvedValue(undefined),
      getAllSavedOutputs: vi.fn().mockResolvedValue([]),
      getSavedOutput: vi.fn().mockResolvedValue(null),
      deleteSavedOutput: vi.fn().mockResolvedValue(true),
      processRealtimeStage: vi.fn().mockResolvedValue({ success: true, sessionId: 'test-session', stage: 'individual-thought' })
    };

    vi.mocked(YuiProtocolRouter).mockImplementation(() => mockRealtimeRouter);

    // Create a simple Express app for testing
    app = express();
    app.use(express.json());

    // Mock the server routes
    app.get('/api/agents', (req, res) => {
      try {
        const agents = mockRealtimeRouter.getAvailableAgents();
        res.json(agents);
      } catch (error) {
        console.error('Error getting agents:', error);
        res.status(500).json({ error: 'Failed to get agents' });
      }
    });

    app.get('/api/sessions', async (req, res) => {
      try {
        const sessions = await mockRealtimeRouter.getAllSessions();
        res.json(sessions);
      } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
      }
    });

    app.post('/api/sessions', async (req, res) => {
      try {
        const { title, agentIds } = req.body;
        
        if (!title || !agentIds || !Array.isArray(agentIds)) {
          return res.status(400).json({ error: 'Title and agentIds array are required' });
        }

        const session = await mockRealtimeRouter.createSession(title, agentIds);
        res.status(201).json(session);
      } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
      }
    });

    app.get('/api/sessions/:sessionId', (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = mockRealtimeRouter.getSession(sessionId);
        
        if (!session) {
          return res.status(404).json({ error: 'Session not found' });
        }

        res.json(session);
      } catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({ error: 'Failed to get session' });
      }
    });

    app.delete('/api/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const success = await mockRealtimeRouter.deleteSession(sessionId);
        
        if (!success) {
          return res.status(404).json({ error: 'Session not found' });
        }

        res.status(204).send();
      } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
      }
    });

    app.post('/api/realtime/sessions', async (req, res) => {
      try {
        const { title, agentIds } = req.body;
        
        if (!title || !agentIds || !Array.isArray(agentIds)) {
          return res.status(400).json({ error: 'Title and agentIds array are required' });
        }

        // Check if a session with this title already exists
        const existingSessions = await mockRealtimeRouter.getAllSessions();
        const existingSession = existingSessions.find((s: Session) => s.title === title);
        
        if (existingSession) {
          // Return the existing session instead of creating a new one
          console.log(`Using existing session with title "${title}": ${existingSession.id}`);
          res.status(200).json(existingSession);
        } else {
          // Create new session only if one doesn't exist
          const session = await mockRealtimeRouter.createSession(title, agentIds);
          res.status(201).json(session);
        }
      } catch (error) {
        console.error('Error creating realtime session:', error);
        res.status(500).json({ error: 'Failed to create realtime session' });
      }
    });

    app.post('/api/realtime/sessions/:sessionId/stage', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { prompt, stage, language } = req.body;

        console.log(`[Server] Processing realtime stage request:`, {
          sessionId,
          stage,
          language,
          promptLength: prompt?.length || 0
        });

        if (!prompt || !stage) {
          console.error(`[Server] Missing required parameters:`, { prompt: !!prompt, stage: !!stage });
          return res.status(400).json({ error: 'Prompt and stage are required' });
        }

        // Call the mock method
        const result = await mockRealtimeRouter.processRealtimeStage(sessionId, prompt, stage, language);
        res.json(result);
      } catch (error) {
        console.error('Error processing realtime stage:', error);
        res.status(500).json({ error: 'Failed to process realtime stage' });
      }
    });

    app.get('/api/outputs', async (req, res) => {
      try {
        const outputs = await mockRealtimeRouter.getAllSavedOutputs();
        res.json(outputs);
      } catch (error) {
        console.error('Error getting outputs:', error);
        res.status(500).json({ error: 'Failed to get outputs' });
      }
    });

    app.get('/api/outputs/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const output = await mockRealtimeRouter.getSavedOutput(id);
        
        if (!output) {
          return res.status(404).json({ error: 'Output not found' });
        }

        res.json(output);
      } catch (error) {
        console.error('Error getting output:', error);
        res.status(500).json({ error: 'Failed to get output' });
      }
    });

    app.delete('/api/outputs/:id', async (req, res) => {
      try {
        const { id } = req.params;
        await mockRealtimeRouter.deleteSavedOutput(id);
        res.status(204).send();
      } catch (error) {
        console.error('Error deleting output:', error);
        res.status(500).json({ error: 'Failed to delete output' });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return available agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toEqual([mockAgent]);
      expect(mockRealtimeRouter.getAvailableAgents).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getAvailableAgents.mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/api/agents')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get agents' });
    });
  });

  describe('GET /api/sessions', () => {
    it('should return all sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(200);

      expect(response.body).toEqual([{
        ...mockSession,
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString()
      }]);
      expect(mockRealtimeRouter.getAllSessions).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getAllSessions.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .get('/api/sessions')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get sessions' });
    });
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const sessionData = {
        title: 'New Session',
        agentIds: ['agent-1', 'agent-2']
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body).toEqual({
        ...mockSession,
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString()
      });
      expect(mockRealtimeRouter.createSession).toHaveBeenCalledWith(
        sessionData.title,
        sessionData.agentIds
      );
    });

    it('should return 400 for missing title', async () => {
      const sessionData = {
        agentIds: ['agent-1']
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Title and agentIds array are required' });
    });

    it('should return 400 for missing agentIds', async () => {
      const sessionData = {
        title: 'New Session'
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Title and agentIds array are required' });
    });

    it('should return 400 for non-array agentIds', async () => {
      const sessionData = {
        title: 'New Session',
        agentIds: 'agent-1'
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Title and agentIds array are required' });
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.createSession.mockRejectedValue(new Error('Test error'));

      const sessionData = {
        title: 'New Session',
        agentIds: ['agent-1']
      };

      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create session' });
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should return session if exists', async () => {
      const response = await request(app)
        .get('/api/sessions/test-session')
        .expect(200);

      expect(response.body).toEqual({
        ...mockSession,
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString()
      });
      expect(mockRealtimeRouter.getSession).toHaveBeenCalledWith('test-session');
    });

    it('should return 404 if session does not exist', async () => {
      mockRealtimeRouter.getSession.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/sessions/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Session not found' });
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getSession.mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/api/sessions/test-session')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get session' });
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should delete session successfully', async () => {
      const response = await request(app)
        .delete('/api/sessions/test-session')
        .expect(204);

      expect(mockRealtimeRouter.deleteSession).toHaveBeenCalledWith('test-session');
    });

    it('should return 404 if session does not exist', async () => {
      mockRealtimeRouter.deleteSession.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/sessions/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Session not found' });
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.deleteSession.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .delete('/api/sessions/test-session')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete session' });
    });
  });

  describe('POST /api/realtime/sessions', () => {
    it('should create new session if none exists with title', async () => {
      mockRealtimeRouter.getAllSessions.mockResolvedValue([]);

      const sessionData = {
        title: 'New Session',
        agentIds: ['agent-1']
      };

      const response = await request(app)
        .post('/api/realtime/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body).toEqual({
        ...mockSession,
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString()
      });
      expect(mockRealtimeRouter.createSession).toHaveBeenCalledWith(
        sessionData.title,
        sessionData.agentIds
      );
    });

    it('should return existing session if one exists with title', async () => {
      const existingSession = { 
        ...mockSession, 
        title: 'Existing Session',
        createdAt: mockSession.createdAt.toISOString(),
        updatedAt: mockSession.updatedAt.toISOString()
      };
      mockRealtimeRouter.getAllSessions.mockResolvedValue([existingSession]);

      const sessionData = {
        title: 'Existing Session',
        agentIds: ['agent-1']
      };

      const response = await request(app)
        .post('/api/realtime/sessions')
        .send(sessionData)
        .expect(200);

      expect(response.body).toEqual(existingSession);
      expect(mockRealtimeRouter.createSession).not.toHaveBeenCalled();
    });

    it('should return 400 for missing parameters', async () => {
      const sessionData = {
        title: 'New Session'
      };

      const response = await request(app)
        .post('/api/realtime/sessions')
        .send(sessionData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Title and agentIds array are required' });
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getAllSessions.mockRejectedValue(new Error('Test error'));

      const sessionData = {
        title: 'New Session',
        agentIds: ['agent-1']
      };

      const response = await request(app)
        .post('/api/realtime/sessions')
        .send(sessionData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create realtime session' });
    });
  });

  describe('POST /api/realtime/sessions/:sessionId/stage', () => {
    it('should process realtime stage request', async () => {
      const stageData = {
        prompt: 'Test prompt',
        stage: 'individual-thought',
        language: 'en'
      };

      const response = await request(app)
        .post('/api/realtime/sessions/test-session/stage')
        .send(stageData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        sessionId: 'test-session',
        stage: 'individual-thought'
      });
    });

    it('should return 400 for missing prompt', async () => {
      const stageData = {
        stage: 'individual-thought',
        language: 'en'
      };

      const response = await request(app)
        .post('/api/realtime/sessions/test-session/stage')
        .send(stageData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Prompt and stage are required' });
    });

    it('should return 400 for missing stage', async () => {
      const stageData = {
        prompt: 'Test prompt',
        language: 'en'
      };

      const response = await request(app)
        .post('/api/realtime/sessions/test-session/stage')
        .send(stageData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Prompt and stage are required' });
    });

    it('should handle errors', async () => {
      // Mock the realtime router to throw an error
      mockRealtimeRouter.processRealtimeStage.mockRejectedValue(new Error('Test error'));

      const stageData = {
        prompt: 'Test prompt',
        stage: 'individual-thought',
        language: 'en'
      };

      const response = await request(app)
        .post('/api/realtime/sessions/test-session/stage')
        .send(stageData)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to process realtime stage' });
    });
  });

  describe('GET /api/outputs', () => {
    it('should return all outputs', async () => {
      const mockOutputs = [{ id: 'output-1', title: 'Test Output' }];
      mockRealtimeRouter.getAllSavedOutputs.mockResolvedValue(mockOutputs);

      const response = await request(app)
        .get('/api/outputs')
        .expect(200);

      expect(response.body).toEqual(mockOutputs);
      expect(mockRealtimeRouter.getAllSavedOutputs).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getAllSavedOutputs.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .get('/api/outputs')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get outputs' });
    });
  });

  describe('GET /api/outputs/:id', () => {
    it('should return output if exists', async () => {
      const mockOutput = { id: 'output-1', title: 'Test Output' };
      mockRealtimeRouter.getSavedOutput.mockResolvedValue(mockOutput);

      const response = await request(app)
        .get('/api/outputs/output-1')
        .expect(200);

      expect(response.body).toEqual(mockOutput);
      expect(mockRealtimeRouter.getSavedOutput).toHaveBeenCalledWith('output-1');
    });

    it('should return 404 if output does not exist', async () => {
      mockRealtimeRouter.getSavedOutput.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/outputs/non-existent')
        .expect(404);

      expect(response.body).toEqual({ error: 'Output not found' });
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.getSavedOutput.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .get('/api/outputs/output-1')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get output' });
    });
  });

  describe('DELETE /api/outputs/:id', () => {
    it('should delete output successfully', async () => {
      const response = await request(app)
        .delete('/api/outputs/output-1')
        .expect(204);

      expect(mockRealtimeRouter.deleteSavedOutput).toHaveBeenCalledWith('output-1');
    });

    it('should handle errors', async () => {
      mockRealtimeRouter.deleteSavedOutput.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .delete('/api/outputs/output-1')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to delete output' });
    });
  });
}); 