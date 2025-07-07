import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { YuiProtocolRouter } from '../kernel/router.js';
import { SessionStorage, removeCircularReferences } from '../kernel/session-storage.js';
import { Session } from '../types/index.js';
import { OutputStorage } from '../kernel/output-storage.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { createStageSummarizer } from '../kernel/stage-summarizer.js';

const app = express();
const port = process.env.PORT || 3001;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '..')));

// Initialize shared session storage
const sharedSessionStorage = new SessionStorage();

// Initialize shared output storage
const sharedOutputStorage = new OutputStorage();

// Initialize shared interaction logger
const sharedInteractionLogger = new InteractionLogger();

// Initialize stage summarizer options
const stageSummarizerOptions = {};

// Initialize delay options - 統一的なdelay設定
const delayOptions = {
  agentResponseDelayMS: 15000,      // エージェント間の応答間隔: 15秒
  stageSummarizerDelayMS: 15000,    // ステージサマリー生成前の待機時間: 45秒
  finalSummaryDelayMS: 15000,       // 最終サマリー生成前の待機時間: 90秒
  defaultDelayMS: 15000             // デフォルト値: 15秒
};

// Initialize realtime router with shared session storage, output storage, interaction logger, stage summarizer options, and delay options
const realtimeRouter = new YuiProtocolRouter(
  sharedSessionStorage,
  sharedOutputStorage,
  sharedInteractionLogger,
  stageSummarizerOptions,
  delayOptions
);


// API Routes
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
    
    // Clean sessions to remove circular references before sending
    const cleanedSessions = sessions.map(session => removeCircularReferences(session));
    res.json(cleanedSessions);
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
}) as RequestHandler);

app.post('/api/sessions', (async (req: Request, res: Response) => {
  try {
    const { title, agentIds, language } = req.body;
    if (!title || !agentIds || !Array.isArray(agentIds)) {
      return res.status(400).json({ error: 'Title and agentIds array are required' });
    }
    const session = await realtimeRouter.createSession(title, agentIds, language || 'en');
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
}) as RequestHandler);

app.get('/api/sessions/:sessionId', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
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

// Real-time collaboration endpoints
app.post('/api/realtime/sessions', (async (req: Request, res: Response) => {
  try {
    const { title, agentIds, language } = req.body;
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
      const session = await realtimeRouter.createSession(title, agentIds, language || 'en');
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
    const { sessionId } = req.params;
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

// Endpoint to reset session when starting new process
app.post('/api/sessions/:sessionId/reset', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
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

// Endpoint to reset realtime session when starting new process
app.post('/api/realtime/sessions/:sessionId/reset', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
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

// Endpoint to get last summary
app.get('/api/sessions/:sessionId/last-summary', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
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

// Endpoint to get last summary for realtime sessions
app.get('/api/realtime/sessions/:sessionId/last-summary', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
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
    const { sessionId } = req.params;
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

app.delete('/api/sessions/:sessionId', (async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
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
    const { sessionId } = req.params;
    console.log(`[Server] Starting new sequence for session ${sessionId}`);
    
    const session = await realtimeRouter.startNewSequence(sessionId);
    
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

// Output storage endpoints
/*
app.post('/api/outputs/save', (async (req: Request, res: Response) => {
  try {
    const { sessionId, title, content, userPrompt, language } = req.body;
    if (!sessionId || !title || !content || !userPrompt || !language) {
      return res.status(400).json({ error: 'sessionId, title, content, userPrompt, and language are required' });
    }
    const savedOutput = await realtimeRouter.saveFinalOutput(sessionId, title, content, userPrompt, language);
    res.status(201).json(savedOutput);
  } catch (error) {
    console.error('Error saving output:', error);
    res.status(500).json({ error: 'Failed to save output' });
  }
}) as RequestHandler);

app.get('/api/outputs', (async (req: Request, res: Response) => {
  try {
    const outputs = await realtimeRouter.getAllSavedOutputs();
    res.json(outputs);
  } catch (error) {
    console.error('Error getting outputs:', error);
    res.status(500).json({ error: 'Failed to get outputs' });
  }
}) as RequestHandler);

app.get('/api/outputs/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const output = await realtimeRouter.getSavedOutput(id);
    if (!output) {
      return res.status(404).json({ error: 'Output not found' });
    }
    if (id.endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(output);
      return;
    }
    res.json(output);
  } catch (error) {
    console.error('Error getting output:', error);
    res.status(500).json({ error: 'Failed to get output' });
  }
}) as RequestHandler);

app.delete('/api/outputs/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await realtimeRouter.deleteSavedOutput(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Output not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting output:', error);
    res.status(500).json({ error: 'Failed to delete output' });
  }
}) as RequestHandler);
*/

// Health check endpoint
app.get('/api/health', ((req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}) as RequestHandler);

// Catch-all route for SPA - serve index.html for any non-API routes
app.get('*', ((req: Request, res: Response) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve the main HTML file for all other routes
  res.sendFile(path.join(__dirname, '../index.html'));
}) as RequestHandler);


// Start server
const server = app.listen(port, () => {
  console.log(`🤖 Yui Protocol Server running on port ${port}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/agents - Get available agents`);
  console.log(`  GET  /api/sessions - Get all sessions`);
  console.log(`  POST /api/sessions - Create new session`);
  console.log(`  GET  /api/sessions/:id - Get specific session`);
  console.log(`  POST /api/realtime/sessions - Create realtime session`);
  console.log(`  POST /api/realtime/sessions/:id/stage - Execute stage with real-time updates`);
  console.log(`  GET  /api/realtime/sessions/:id - Get realtime session`);
  console.log(`  POST /api/outputs/save - Save output`);
  console.log(`  GET  /api/outputs - Get all outputs`);
  console.log(`  GET  /api/outputs/:id - Get specific output`);
  console.log(`  DELETE /api/outputs/:id - Delete specific output`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
    console.log('👋 Yui Protocol Server stopped');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle different termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
}); 