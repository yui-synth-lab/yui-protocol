// 最小のレベル付きロガー（Phase 5）。
// 環境変数 YUI_LOG_LEVEL（debug|info|warn|error、既定 debug）で出力をゲートする。
// 既定 debug = すべて出力 ＝ 従来の console.* と同じ可視性（挙動不変）。
// console.* からの段階的移行先: createLogger(scope) を使い、メッセージ側の
// `[Scope] ` プレフィックスは付けない（ロガーが付与する）。

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function threshold(): number {
  const env = (process.env.YUI_LOG_LEVEL || 'debug').toLowerCase() as LogLevel;
  return LEVELS[env] ?? 0;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, ...args) => { if (threshold() <= 0) console.log(`[${scope}] ${message}`, ...args); },
    info: (message, ...args) => { if (threshold() <= 1) console.log(`[${scope}] ${message}`, ...args); },
    warn: (message, ...args) => { if (threshold() <= 2) console.warn(`[${scope}] ${message}`, ...args); },
    error: (message, ...args) => { if (threshold() <= 3) console.error(`[${scope}] ${message}`, ...args); }
  };
}
