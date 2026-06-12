// セッション管理 REST ルート（v1 共通）。ハンドラの挙動は分割前の server/index.ts と同一。
import { Express, Request, Response, RequestHandler } from 'express';
import { removeCircularReferences } from '../../kernel/session-storage.js';
import type { ServerContext } from '../context.js';

export function registerSessionRoutes(app: Express, ctx: ServerContext): void {
  const { realtimeRouter, interactionLogger } = ctx;

  app.get('/api/agents', ((req: Request, res: Response) => {
    try {
      const agents = realtimeRouter.getAvailableAgents();
      res.json(agents);
    } catch (error) {
      console.error('Error getting agents:', error);
      res.status(500).json({ error: 'Failed to get agents' });
    }
  }) as RequestHandler);

  app.get('/api/sessions', (async (req: Request, res: Response) => {
    try {
      const sessions = await realtimeRouter.getAllSessions();

      // Return only session summaries instead of full data
      const sessionSummaries = sessions.map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        status: session.status,
        language: session.language,
        version: session.version || '1.0', // Add version information with fallback
        agentIds: session.agents?.map(agent => agent.id) || [],
        messageCount: session.messages?.length || 0,
        agentCount: session.agents?.length || 0
      }));

      res.json(sessionSummaries);
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }) as RequestHandler);

  app.post('/api/sessions', (async (req: Request, res: Response) => {
    try {
      const { title, agentIds, language, version } = req.body;
      if (!title || !agentIds || !Array.isArray(agentIds)) {
        return res.status(400).json({ error: 'Title and agentIds array are required' });
      }
      const session = await realtimeRouter.createSession(title, agentIds, language || 'en', version || '1.0');
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }) as RequestHandler);

  app.get('/api/sessions/:sessionId', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await realtimeRouter.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Clean session to remove circular references before sending
      const cleanedSession = removeCircularReferences(session);
      res.json(cleanedSession);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }) as RequestHandler);

  // Endpoint to reset session when starting new process
  app.post('/api/sessions/:sessionId/reset', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;

      // Reset stage progress information but keep messages
      const session = await realtimeRouter.getSession(sessionId);
      if (session) {
        session.status = 'active';
        session.stageHistory = []; // Clear stage history for new process
        session.currentStage = undefined; // Reset current stage
        // Keep existing messages to maintain conversation history

        // Save to session storage
        await realtimeRouter.saveSession(session);
        res.json({ success: true, message: 'Session reset successfully' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      console.error('Error resetting session:', error);
      res.status(500).json({ error: 'Failed to reset session' });
    }
  }) as RequestHandler);

  // Endpoint to get last summary
  app.get('/api/sessions/:sessionId/last-summary', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;

      // Get summary from last output-generation stage
      const session = await realtimeRouter.getSession(sessionId);
      if (session && session.messages) {
        const outputMessages = session.messages.filter((msg: any) => msg.stage === 'output-generation' && msg.role === 'agent');

        if (outputMessages.length > 0) {
          const lastSummary = outputMessages[outputMessages.length - 1];
          res.json({
            success: true,
            summary: lastSummary.content,
            timestamp: lastSummary.timestamp
          });
        } else {
          res.json({ success: true, summary: null });
        }
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      console.error('Error getting last summary:', error);
      res.status(500).json({ error: 'Failed to get last summary' });
    }
  }) as RequestHandler);

  app.delete('/api/sessions/:sessionId', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const deleted = await realtimeRouter.deleteSession(sessionId);

      if (!deleted) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }) as RequestHandler);

  // Endpoint to start new sequence
  app.post('/api/sessions/:sessionId/start-new-sequence', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const { userPrompt } = req.body;
      console.log(`[Server] Starting new sequence for session ${sessionId}`);

      const session = await realtimeRouter.startNewSequence(sessionId, userPrompt);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      console.log(`[Server] New sequence started for session ${sessionId}, sequence number: ${session.sequenceNumber}`);
      res.json({ success: true, session });
    } catch (error) {
      console.error('Error starting new sequence:', error);
      res.status(500).json({ error: 'Failed to start new sequence' });
    }
  }) as RequestHandler);

  // セッション別トークン使用量エンドポイント（コスト会計 M1）
  app.get('/api/sessions/:sessionId/token-usage', ((req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const usage = interactionLogger.getSessionTokenStats(sessionId);
      if (!usage) {
        return res.status(404).json({ error: 'No token usage recorded for this session' });
      }
      res.json({ success: true, usage });
    } catch (error) {
      console.error('[API] Error getting token usage:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }) as RequestHandler);
}
