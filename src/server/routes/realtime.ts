// realtime セッション REST ルート（SSE によるステージ実行を含む）。
// ハンドラの挙動は分割前の server/index.ts と同一。
import { Express, Request, Response, RequestHandler } from 'express';
import { removeCircularReferences } from '../../kernel/session-storage.js';
import type { ServerContext } from '../context.js';

export function registerRealtimeRoutes(app: Express, ctx: ServerContext): void {
  const { realtimeRouter } = ctx;

  // Real-time collaboration endpoints
  app.post('/api/realtime/sessions', (async (req: Request, res: Response) => {
    try {
      const { title, agentIds, language, version } = req.body;
      if (!title || !agentIds || !Array.isArray(agentIds)) {
        return res.status(400).json({ error: 'Title and agentIds array are required' });
      }
      // Check if a session with this title already exists
      const existingSessions = await realtimeRouter.getAllSessions();
      const existingSession = existingSessions.find(s => s.title === title);
      if (existingSession) {
        // Return the existing session instead of creating a new one
        console.log(`Using existing session with title "${title}": ${existingSession.id}`);
        res.status(200).json(existingSession);
      } else {
        // Create new session only if one doesn't exist
        const session = await realtimeRouter.createSession(title, agentIds, language || 'en', version || '1.0');
        res.status(201).json(session);
      }
    } catch (error) {
      console.error('Error creating realtime session:', error);
      res.status(500).json({ error: 'Failed to create realtime session' });
    }
  }) as RequestHandler);

  app.post('/api/realtime/sessions/:sessionId/stage', (async (req: Request, res: Response) => {
    console.log(`[Server] Received realtime stage request for session ${req.params.sessionId}`);
    console.log(`[Server] Request body:`, req.body);

    try {
      const sessionId = req.params.sessionId as string;
      const { prompt, stage, language = 'ja' } = req.body;

      console.log(`[Server] Processing stage ${stage} for session ${sessionId} with prompt: ${prompt?.substring(0, 100)}...`);

      if (!sessionId || !prompt || !stage) {
        console.error(`[Server] Missing required parameters: sessionId=${sessionId}, prompt=${!!prompt}, stage=${stage}`);
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Set up Server-Sent Events for real-time updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const onProgress = (update: { message?: any; session?: any }) => {
        if (update.message) {
          const cleanedMessage = removeCircularReferences(update.message);
          console.log(`[Server] Sending progress message via SSE:`, {
            agentId: cleanedMessage.agentId,
            stage: cleanedMessage.stage,
            contentLength: cleanedMessage.content?.length || 0
          });
          try {
            const sseData = JSON.stringify({ type: 'progress', message: cleanedMessage });
            if (sseData.length > 1000000) {
              console.warn(`[Server] Large SSE message detected (${sseData.length} bytes), truncating content`);
              if (cleanedMessage.content && cleanedMessage.content.length > 50000) {
                cleanedMessage.content = cleanedMessage.content.substring(0, 50000) + '... [truncated]';
              }
              const truncatedData = JSON.stringify({ type: 'progress', message: cleanedMessage });
              res.write(`data: ${truncatedData}\n\n`);
            } else {
              res.write(`data: ${sseData}\n\n`);
            }
            if ('flush' in res && typeof res.flush === 'function') {
              res.flush();
            }
          } catch (error) {
            console.error('[Server] Error serializing SSE message:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to serialize message' })}\n\n`);
          }
        }
      };

      try {
        console.log(`[Server] Executing stage ${stage} for session ${sessionId}`);
        const result = await realtimeRouter.executeStageRealtime(
          sessionId,
          prompt,
          stage,
          language,
          onProgress
        );

        const cleanedResult = removeCircularReferences(result);
        console.log(`[Server] Stage ${stage} completed successfully for session ${sessionId}`);
        res.write(`data: ${JSON.stringify({ type: 'complete', result: cleanedResult })}\n\n`);
      } catch (error) {
        console.error(`[Server] Error executing stage ${stage} for session ${sessionId}:`, error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message })}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error('[Server] Error processing realtime stage:', error);
      res.status(500).json({ error: 'Failed to process realtime stage' });
    }
  }) as RequestHandler);

  // Endpoint to reset realtime session when starting new process
  app.post('/api/realtime/sessions/:sessionId/reset', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;

      console.log(`[Server] Resetting realtime session ${sessionId}`);

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
      console.error('Error resetting realtime session:', error);
      res.status(500).json({ error: 'Failed to reset session' });
    }
  }) as RequestHandler);

  // Endpoint to get last summary for realtime sessions
  app.get('/api/realtime/sessions/:sessionId/last-summary', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;

      console.log(`[Server] Getting last summary for realtime session ${sessionId}`);

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
      console.error('Error getting last summary for realtime session:', error);
      res.status(500).json({ error: 'Failed to get last summary' });
    }
  }) as RequestHandler);

  app.get('/api/realtime/sessions/:sessionId', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await realtimeRouter.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const cleanedSession = removeCircularReferences(session);
      res.json(cleanedSession);
    } catch (error) {
      console.error('Error getting realtime session:', error);
      res.status(500).json({ error: 'Failed to get realtime session' });
    }
  }) as RequestHandler);
}
