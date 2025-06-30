import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RealtimeYuiProtocolRouter } from '../kernel/realtime-router.js';
import { SessionStorage, removeCircularReferences } from '../kernel/session-storage.js';
import { Session } from '../types/index.js';

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

// Initialize realtime router with shared session storage
const realtimeRouter = new RealtimeYuiProtocolRouter(sharedSessionStorage);

// Helper function to clean up duplicate sessions
async function cleanupDuplicateSessions(): Promise<void> {
  try {
    const sessions = await sharedSessionStorage.getAllSessions();
    const titleMap = new Map<string, Session[]>();
    
    // Group sessions by title
    for (const session of sessions) {
      if (!titleMap.has(session.title)) {
        titleMap.set(session.title, []);
      }
      titleMap.get(session.title)!.push(session);
    }
    
    // Remove duplicates, keeping the most recent one
    for (const [title, sessionList] of titleMap) {
      if (sessionList.length > 1) {
        console.log(`Found ${sessionList.length} duplicate sessions for title: "${title}"`);
        
        // Sort by updatedAt (newest first) and keep only the first one
        sessionList.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const sessionsToDelete = sessionList.slice(1);
        
        for (const sessionToDelete of sessionsToDelete) {
          console.log(`Deleting duplicate session: ${sessionToDelete.id}`);
          await sharedSessionStorage.deleteSession(sessionToDelete.id);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicate sessions:', error);
  }
}

// Clean up duplicates on startup
cleanupDuplicateSessions();

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
    const { title, agentIds } = req.body;
    
    if (!title || !agentIds || !Array.isArray(agentIds)) {
      return res.status(400).json({ error: 'Title and agentIds array are required' });
    }

    const session = await realtimeRouter.createSession(title, agentIds);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
}) as RequestHandler);

app.get('/api/sessions/:sessionId', ((req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = realtimeRouter.getSession(sessionId);
    
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
    const { title, agentIds } = req.body;
    
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
      const session = await realtimeRouter.createSession(title, agentIds);
      res.status(201).json(session);
    }
  } catch (error) {
    console.error('Error creating realtime session:', error);
    res.status(500).json({ error: 'Failed to create realtime session' });
  }
}) as RequestHandler);

app.post('/api/realtime/sessions/:sessionId/stage', (async (req: Request, res: Response) => {
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

    // Set up Server-Sent Events for real-time updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const onProgress = (message: any) => {
      const cleanedMessage = removeCircularReferences(message);
      console.log(`[Server] Sending progress message via SSE:`, {
        agentId: cleanedMessage.agentId,
        stage: cleanedMessage.stage,
        contentLength: cleanedMessage.content?.length || 0
      });
      
      try {
        const sseData = JSON.stringify({ type: 'progress', message: cleanedMessage });
        
        // Check if the message is too large and might cause issues
        if (sseData.length > 1000000) { // 1MB limit
          console.warn(`[Server] Large SSE message detected (${sseData.length} bytes), truncating content`);
          // Truncate the content if it's too large
          if (cleanedMessage.content && cleanedMessage.content.length > 50000) {
            cleanedMessage.content = cleanedMessage.content.substring(0, 50000) + '... [truncated]';
          }
          const truncatedData = JSON.stringify({ type: 'progress', message: cleanedMessage });
          res.write(`data: ${truncatedData}\n\n`);
        } else {
          res.write(`data: ${sseData}\n\n`);
        }
        
        // Ensure the data is flushed to the client
        if ('flush' in res && typeof res.flush === 'function') {
          res.flush();
        }
      } catch (error) {
        console.error('[Server] Error serializing SSE message:', error);
        // Send a simplified error message
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to serialize message' })}\n\n`);
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
    const session = realtimeRouter.getSession(sessionId);
    if (session) {
      session.status = 'active';
      session.stageHistory = []; // Clear stage history for new process
      session.currentStage = undefined; // Reset current stage
      // Keep existing messages to maintain conversation history
      
      // Save to session storage
      await realtimeRouter['saveSessionToStorage'](session);
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
    const session = realtimeRouter.getSession(sessionId);
    if (session) {
      session.status = 'active';
      session.stageHistory = []; // Clear stage history for new process
      session.currentStage = undefined; // Reset current stage
      // Keep existing messages to maintain conversation history
      
      // Save to session storage
      await realtimeRouter['saveSessionToStorage'](session);
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
    const session = realtimeRouter.getSession(sessionId);
    if (session && session.messages) {
      const outputGenerationMessages = session.messages.filter(
        msg => msg.stage === 'output-generation' && msg.role === 'agent'
      );
      
      if (outputGenerationMessages.length > 0) {
        const lastSummary = outputGenerationMessages[outputGenerationMessages.length - 1];
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
    const session = realtimeRouter.getSession(sessionId);
    if (session && session.messages) {
      const outputGenerationMessages = session.messages.filter(
        msg => msg.stage === 'output-generation' && msg.role === 'agent'
      );
      
      if (outputGenerationMessages.length > 0) {
        const lastSummary = outputGenerationMessages[outputGenerationMessages.length - 1];
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

app.get('/api/realtime/sessions/:sessionId', ((req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = realtimeRouter.getSession(sessionId);
    
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

// Output storage endpoints
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