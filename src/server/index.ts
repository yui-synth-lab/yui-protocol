// サーバのエントリポイント（composition のみ）。
// ルート定義は src/server/routes/、WS実行は src/server/ws/、共有依存は ServerContext に分離（Phase 4）。
import 'dotenv/config';
import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { YuiProtocolRouter } from '../kernel/router.js';
import { SessionStorage } from '../kernel/session-storage.js';
import { InteractionLogger } from '../kernel/interaction-logger.js';
import { V2ConfigLoader } from '../config/v2-config-loader.js';
import { createDefaultAgentManager, createDynamicRouter, createDefaultOutputStorage } from '../bootstrap/index.js';
import type { ServerContext } from './context.js';
import { registerWebSocketHandlers } from './ws/session-executor.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerRealtimeRoutes } from './routes/realtime.js';
import { registerV2Routes } from './routes/v2.js';
import { registerMetaRoutes } from './routes/meta.js';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

// Initialize V2 configuration
const v2ConfigLoader = V2ConfigLoader.getInstance();
v2ConfigLoader.logCurrentConfig();
if (!v2ConfigLoader.validateConfig()) {
  console.error('[Server] V2設定の検証に失敗しました。デフォルト設定を使用します。');
}

// 共有インスタンスの構築（エージェント等の具象配線は src/bootstrap が担う）
const sharedSessionStorage = new SessionStorage();
const sharedOutputStorage = createDefaultOutputStorage(); // RAG自動インデックスはリスナーとして配線済み
const sharedInteractionLogger = new InteractionLogger();
const sharedAgentManager = createDefaultAgentManager(sharedInteractionLogger);

// v1 ルーター
const realtimeRouter = new YuiProtocolRouter(
  sharedSessionStorage,
  sharedOutputStorage,
  sharedInteractionLogger,
  {},
  30000,
  sharedAgentManager
);

// v2.0 統計用ルーター（セッション実行用ルーターは routes/v2.ts が実行毎に構築する）
const v2StatsRouter = createDynamicRouter(sharedSessionStorage, undefined, undefined, sharedInteractionLogger);

const ctx: ServerContext = {
  io,
  realtimeRouter,
  v2StatsRouter,
  interactionLogger: sharedInteractionLogger,
  sessionStorage: sharedSessionStorage,
  agentManager: sharedAgentManager
};

// WebSocket ハンドラとルートの登録
registerWebSocketHandlers(ctx);
registerSessionRoutes(app, ctx);
registerRealtimeRoutes(app, ctx);
registerV2Routes(app, ctx);
registerMetaRoutes(app);

// Catch-all route for SPA - serve index.html for any non-API routes
// Express 5 requires named wildcard parameter
app.get('/{*path}', ((req: Request, res: Response) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Serve the main HTML file for all other routes
  res.sendFile(path.join(__dirname, '../index.html'));
}) as RequestHandler);


// Start server
server.listen(port, () => {
  console.log(`🤖 Yui Protocol Server running on port ${port}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/agents - Get available agents`);
  console.log(`  GET  /api/sessions - Get all sessions`);
  console.log(`  POST /api/sessions - Create new session`);
  console.log(`  GET  /api/sessions/:id - Get specific session`);
  console.log(`  GET  /api/sessions/:id/token-usage - Get token usage for a session`);
  console.log(`  POST /api/realtime/sessions - Create realtime session`);
  console.log(`  POST /api/realtime/sessions/:id/stage - Execute stage with real-time updates`);
  console.log(`  GET  /api/realtime/sessions/:id - Get realtime session`);
  console.log(`v2.0 Dynamic Dialogue:`);
  console.log(`  POST /api/v2/sessions/:id/start - Start dynamic dialogue session`);
  console.log(`  GET  /api/v2/stats - Get dynamic dialogue statistics`);
  console.log(`  GET  /api/version - Get API version information`);
  console.log(`WebSocket server is running on the same port`);
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
