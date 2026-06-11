// v2.0 動的対話 REST ルート。v2 ルーターは実行ごとに bootstrap 経由で構築する
// （v1 ルーターは v2 を参照しない: 設計原則1）。ハンドラの挙動は分割前と同一。
import { Express, Request, Response, RequestHandler } from 'express';
import { removeCircularReferences } from '../../kernel/session-storage.js';
import { createDynamicRouter, collectDialogueAgents } from '../../bootstrap/index.js';
import { getRAGManager } from '../../kernel/rag/rag-manager.js';
import type { Language, Session } from '../../types/index.js';
import type { ServerContext } from '../context.js';

export function registerV2Routes(app: Express, ctx: ServerContext): void {
  const { io, v2StatsRouter, interactionLogger } = ctx;

  // v2.0 dynamic dialogue endpoints
  app.post('/api/v2/sessions/:sessionId/start', (async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const { prompt, language = 'en' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      console.log(`[API] Starting v2.0 dynamic session ${sessionId}`);

      // Start the dynamic session with WebSocket progress callbacks
      executeV2SessionWithWebSocket(ctx, sessionId, prompt, language)
        .then(session => {
          console.log(`[API] v2.0 session ${sessionId} completed`);
          io.to(sessionId).emit('v2-complete', {
            sessionId,
            session: removeCircularReferences(session),
            totalRounds: session.metadata?.totalRounds || 0,
            finalConsensus: session.metadata?.finalConsensus || 0
          });
        })
        .catch(error => {
          console.error(`[API] Error in v2.0 session ${sessionId}:`, error);
          io.to(sessionId).emit('v2-error', {
            sessionId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });

      // Return immediately - client will receive updates via WebSocket
      res.json({
        success: true,
        message: 'Dynamic dialogue session started',
        version: '2.0'
      });
    } catch (error) {
      console.error('[API] Error starting v2.0 session:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        version: '2.0'
      });
    }
  }) as RequestHandler);

  // v2.0 統計情報エンドポイント
  app.get('/api/v2/stats', (async (req: Request, res: Response) => {
    try {
      const stats = v2StatsRouter.getDialogueStats();
      res.json({
        success: true,
        stats,
        tokenUsage: interactionLogger.getAllTokenStats(),
        version: '2.0'
      });
    } catch (error) {
      console.error('[API] Error getting v2.0 stats:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }) as RequestHandler);
}

// Execute v2.0 session with WebSocket updates
async function executeV2SessionWithWebSocket(
  ctx: ServerContext,
  sessionId: string,
  prompt: string,
  language: Language
): Promise<Session> {
  const { io, sessionStorage, agentManager, interactionLogger } = ctx;
  try {
    // Notify start
    io.to(sessionId).emit('v2-session-start', {
      sessionId,
      prompt,
      timestamp: new Date().toISOString()
    });

    // Create WebSocket emitter for the dynamic router
    const wsEmitter = (event: string, data: any) => {
      io.to(sessionId).emit(event, data);
    };

    // v2 ルーターは bootstrap 経由で構築する（v1 ルーターは v2 を参照しない）。
    // RAG が初期化済みなら retriever を渡し、不協和音検出（過去の結論との類似時に脱構築を促す）を有効化する
    const ragRetriever = getRAGManager().isReady() ? getRAGManager().getRetriever() ?? undefined : undefined;
    const dynamicRouter = createDynamicRouter(sessionStorage, wsEmitter, ragRetriever, interactionLogger);
    const agents = collectDialogueAgents(agentManager, sessionId);
    const session = await dynamicRouter.conductDynamicDialogue(prompt, agents, sessionId, language);
    return session;
  } catch (error) {
    console.error(`[V2SessionExecutor] Error:`, error);
    throw error;
  }
}
