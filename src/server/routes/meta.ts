// バージョン情報・ヘルスチェックのルート。ハンドラの挙動は分割前と同一。
import { Express, Request, Response, RequestHandler } from 'express';

export function registerMetaRoutes(app: Express): void {
  // バージョン情報エンドポイント
  app.get('/api/version', ((req: Request, res: Response) => {
    res.json({
      v1: {
        available: true,
        description: 'Fixed 5-stage dialogue system',
        endpoints: [
          '/api/sessions/:id/stage-1',
          '/api/sessions/:id/stage-2',
          '/api/sessions/:id/stage-3',
          '/api/sessions/:id/stage-4',
          '/api/sessions/:id/stage-5',
          '/api/realtime/sessions/:id/stage'
        ]
      },
      v2: {
        available: true,
        description: 'Dynamic dialogue with consensus-based progression',
        endpoints: [
          '/api/v2/sessions/:id/start',
          '/api/v2/stats'
        ]
      }
    });
  }) as RequestHandler);

  // Health check endpoint
  app.get('/api/health', ((req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }) as RequestHandler);
}
