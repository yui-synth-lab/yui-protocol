// v1.0 の固定ステージ進行ルール。
// 従来 server/index.ts（HTTP層）にハードコードされていた進行判定を orchestration 層へ移設（Phase 4）。
import type { DialogueStage, Session } from '../../types/index.js';

/** v1.0 の実行順ステージ列（5主要ステージ + 3要約ステージ + finalize） */
export const V1_STAGE_SEQUENCE: DialogueStage[] = [
  'individual-thought',
  'mutual-reflection',
  'mutual-reflection-summary',
  'conflict-resolution',
  'conflict-resolution-summary',
  'synthesis-attempt',
  'synthesis-attempt-summary',
  'output-generation',
  'finalize'
];

/** 完了済みステージ数（endTime が記録されたもの） */
export function countCompletedStages(session: Session): number {
  return session.stageHistory?.filter(h => h.endTime).length ?? 0;
}

/**
 * シーケンス完了判定。
 * 従来の挙動を維持: 5主要 + 3要約 = 8 ステージ完了でシーケンス完了とみなす
 * （finalize は完了判定に数えない）。
 */
export function isV1SequenceComplete(session: Session): boolean {
  return countCompletedStages(session) >= 8;
}

/** 現在の進捗から残りの実行ステージを返す */
export function remainingV1Stages(session: Session): DialogueStage[] {
  return V1_STAGE_SEQUENCE.slice(countCompletedStages(session));
}
