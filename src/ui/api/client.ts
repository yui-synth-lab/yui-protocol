// UI からの REST API 呼び出しを集約するクライアント層（Phase 4）。
// エンドポイント URL とリクエスト形式の知識はこのファイルにのみ置く。
import type { Agent, Session, Language } from '../../types/index.js';

/** セッション一覧 API が返すサマリー（フル Session ではない） */
export interface SessionSummaryDto {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: Session['status'];
  language: Language;
  version: '1.0' | '2.0';
  agentIds: string[];
  messageCount: number;
  agentCount: number;
}

export async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents');
  return response.json();
}

export async function fetchSessionSummaries(): Promise<SessionSummaryDto[]> {
  const response = await fetch('/api/sessions');
  return response.json();
}

export async function createSession(params: {
  title: string;
  agentIds: string[];
  language: string;
  version: '1.0' | '2.0';
}): Promise<Session> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

/** フルセッションを取得する。404 等の場合は null */
export async function fetchSession(sessionId: string): Promise<Session | null> {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

/** 新しいシーケンスを開始する。成功可否を返す */
export async function startNewSequence(sessionId: string, userPrompt: string): Promise<boolean> {
  const response = await fetch(`/api/sessions/${sessionId}/start-new-sequence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt })
  });
  return response.ok;
}

/** v2.0 動的対話を開始する。失敗時はエラーメッセージを throw */
export async function startDynamicDialogue(sessionId: string, prompt: string, language: Language): Promise<void> {
  const response = await fetch(`/api/v2/sessions/${sessionId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, language })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start dynamic dialogue');
  }
}
