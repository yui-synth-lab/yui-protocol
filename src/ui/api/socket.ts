// Socket.IO 接続の生成を集約するヘルパー（Phase 4）。
// 接続先 URL の組み立てはこのファイルにのみ置く。イベント購読は各コンポーネントが行う。
import { io, Socket } from 'socket.io-client';

const WS_PORT = 3001; // サーバー側のポートに合わせる

export function createSessionSocket(): Socket {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsHost = window.location.hostname;
  return io(`${wsProtocol}://${wsHost}:${WS_PORT}`);
}
