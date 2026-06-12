// WebSocket 接続管理と v1 セッション実行オーケストレーション。
// ステージ進行の業務ルールは orchestration/v1/stage-sequencer.ts に依存する。
import { removeCircularReferences } from '../../kernel/session-storage.js';
import { isV1SequenceComplete, remainingV1Stages } from '../../orchestration/v1/stage-sequencer.js';
import type { DialogueStage, Language } from '../../types/index.js';
import type { ServerContext } from '../context.js';

export function registerWebSocketHandlers(ctx: ServerContext): void {
  const { io } = ctx;
  // WebSocket connection management
  const connectedClients = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    socket.on('join-session', (sessionId: string) => {
      console.log(`[WebSocket] Client ${socket.id} joining session: ${sessionId}`);
      socket.join(sessionId);

      if (!connectedClients.has(sessionId)) {
        connectedClients.set(sessionId, new Set());
      }
      connectedClients.get(sessionId)!.add(socket.id);

      console.log(`[WebSocket] Client ${socket.id} joined session ${sessionId}. Total clients in session: ${connectedClients.get(sessionId)!.size}`);
    });

    socket.on('leave-session', (sessionId: string) => {
      console.log(`[WebSocket] Client ${socket.id} leaving session: ${sessionId}`);
      socket.leave(sessionId);

      const clients = connectedClients.get(sessionId);
      if (clients) {
        clients.delete(socket.id);
        if (clients.size === 0) {
          connectedClients.delete(sessionId);
        }
      }
    });

    socket.on('start-session-execution', async (data: { sessionId: string; userPrompt: string }) => {
      console.log(`[WebSocket] Starting session execution for session: ${data.sessionId}`);
      try {
        await startSessionExecution(ctx, data.sessionId, data.userPrompt);
      } catch (error) {
        console.error(`[WebSocket] Error starting session execution:`, error);
        socket.emit('session-error', {
          sessionId: data.sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      // Remove from all sessions
      for (const [sessionId, clients] of connectedClients.entries()) {
        if (clients.has(socket.id)) {
          clients.delete(socket.id);
          if (clients.size === 0) {
            connectedClients.delete(sessionId);
          }
        }
      }
    });
  });
}

// Session execution orchestrator
async function startSessionExecution(ctx: ServerContext, sessionId: string, userPrompt: string): Promise<void> {
  const { io, realtimeRouter } = ctx;
  console.log(`[SessionExecutor] Starting execution for session ${sessionId} with prompt: ${userPrompt.substring(0, 100)}...`);

  try {
    let session = await realtimeRouter.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // ステージ進行ルールは orchestration/v1/stage-sequencer.ts に集約（Phase 4）
    if (isV1SequenceComplete(session)) {
      console.log(`[SessionExecutor] All stages completed, starting new sequence`);
      await realtimeRouter.startNewSequence(sessionId, userPrompt);
      // 新しいシーケンスの状態を取得し直す
      session = await realtimeRouter.getSession(sessionId);
      if (!session) {
        console.error(`Session ${sessionId} not found after starting new sequence`);
        return;
      }
      // 最新のユーザーメッセージを取得し、userPromptを上書き
      const latestUserMessage = session.messages
        .filter(m => m.role === 'user' && m.sequenceNumber === session!.sequenceNumber)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (latestUserMessage && latestUserMessage.content) {
        userPrompt = latestUserMessage.content;
      }
    }

    const remainingStages = remainingV1Stages(session);
    console.log(`[SessionExecutor] Remaining stages: ${remainingStages.join(', ')}`);
    for (const stage of remainingStages) {
      console.log(`[SessionExecutor] About to execute stage: ${stage} (userPrompt: ${userPrompt})`);
      // Notify clients about stage start
      io.to(sessionId).emit('stage-start', {
        sessionId,
        stage,
        timestamp: new Date().toISOString()
      });

      try {
        console.log(`[SessionExecutor] Calling executeStageWithWebSocket for stage: ${stage}`);
        const result = await executeStageWithWebSocket(ctx, sessionId, userPrompt, stage, session!.language || 'en');
        console.log(`[SessionExecutor] Stage ${stage} completed successfully`);

        // Notify clients about stage completion
        io.to(sessionId).emit('stage-complete', {
          sessionId,
          stage,
          result: removeCircularReferences(result),
          timestamp: new Date().toISOString()
        });

        // Small delay between stages
        if (stage !== 'finalize') {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[SessionExecutor] Error in stage ${stage}:`, error);
        io.to(sessionId).emit('stage-error', {
          sessionId,
          stage,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }

    console.log(`[SessionExecutor] All stages completed for session ${sessionId}`);
    io.to(sessionId).emit('session-complete', {
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[SessionExecutor] Error in session execution:`, error);
    throw error;
  }
}

// Execute stage with WebSocket progress updates
async function executeStageWithWebSocket(
  ctx: ServerContext,
  sessionId: string,
  userPrompt: string,
  stage: DialogueStage,
  language: Language
) {
  const { io, realtimeRouter } = ctx;
  return new Promise((resolve, reject) => {
    const onProgress = (update: { message?: any; session?: any }) => {
      if (update.message) {
        const cleanedMessage = removeCircularReferences(update.message);
        io.to(sessionId).emit('stage-progress', {
          sessionId,
          stage,
          message: cleanedMessage,
          timestamp: new Date().toISOString()
        });
      }
    };

    realtimeRouter.executeStageRealtime(sessionId, userPrompt, stage, language, onProgress)
      .then(resolve)
      .catch(reject);
  });
}
