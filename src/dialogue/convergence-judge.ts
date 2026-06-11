import type { ConsensusIndicator } from '../types/consensus.js';

export type ConvergenceReason = 'natural_consensus' | 'max_rounds' | 'facilitator_decision' | 'high_satisfaction';

/**
 * 収束判定の設定。デフォルト値は従来 dynamic-router にハードコードされていた値
 * （7.0 / 8.0 / round>=3 / round>=2）に合わせてある。
 * config/v2-settings.json の consensus セクションから接続される。
 */
export interface ConvergenceJudgeConfig {
  /** overallConsensus がこの値以上（かつ最小ラウンド到達）で収束 */
  convergenceThreshold: number;
  /** コンセンサス収束に必要な最小ラウンド数 */
  minRoundsForConvergence: number;
  /** 平均満足度がこの値以上（かつ過半数が readyToMove）で収束 */
  highSatisfactionThreshold: number;
  /** 満足度収束に必要な最小ラウンド数 */
  minRoundsForSatisfactionConvergence: number;
  /** M7: セッション単位の LLM 呼び出しバジェット。未設定なら無効（挙動不変） */
  maxLlmCallsPerSession?: number;
}

export const DEFAULT_CONVERGENCE_CONFIG: ConvergenceJudgeConfig = {
  convergenceThreshold: 7.0,
  minRoundsForConvergence: 3,
  highSatisfactionThreshold: 8.0,
  minRoundsForSatisfactionConvergence: 2
};

export interface ConvergenceDecision {
  converged: boolean;
  reason?: ConvergenceReason;
  readyToMoveCount: number;
  averageSatisfaction: number;
  totalAgentsChecked: number;
  /** バジェット超過による強制収束かどうか（M7） */
  budgetExceeded: boolean;
}

/**
 * v2.0 対話の収束判定。dynamic-router の対話ループから抽出した純粋ロジック。
 */
export class ConvergenceJudge {
  private config: ConvergenceJudgeConfig;

  constructor(config?: Partial<ConvergenceJudgeConfig>) {
    this.config = { ...DEFAULT_CONVERGENCE_CONFIG, ...config };
  }

  judge(
    consensusData: ConsensusIndicator[],
    dialogueState: { shouldContinue: boolean; overallConsensus: number },
    round: number,
    llmCallsSoFar?: number
  ): ConvergenceDecision {
    const totalAgentsChecked = consensusData.length;
    const readyToMoveCount = consensusData.filter(c => c.readyToMove).length;
    const averageSatisfaction = totalAgentsChecked > 0
      ? consensusData.reduce((sum, c) => sum + c.satisfactionLevel, 0) / totalAgentsChecked
      : 0;
    const majorityThreshold = Math.ceil(totalAgentsChecked / 2);

    const budgetExceeded =
      this.config.maxLlmCallsPerSession !== undefined &&
      llmCallsSoFar !== undefined &&
      llmCallsSoFar >= this.config.maxLlmCallsPerSession;

    const consensusConverged =
      dialogueState.overallConsensus >= this.config.convergenceThreshold &&
      round >= this.config.minRoundsForConvergence;

    const satisfactionConverged =
      averageSatisfaction >= this.config.highSatisfactionThreshold &&
      readyToMoveCount >= majorityThreshold &&
      round >= this.config.minRoundsForSatisfactionConvergence;

    // 初回ラウンド等でコンセンサスデータがない場合は収束しない（バジェット超過を除く）
    const converged = budgetExceeded ||
      (totalAgentsChecked > 0 && (!dialogueState.shouldContinue || consensusConverged || satisfactionConverged));

    if (!converged) {
      return { converged: false, readyToMoveCount, averageSatisfaction, totalAgentsChecked, budgetExceeded: false };
    }

    // 収束理由の判定（従来ロジックの優先順位を維持し、バジェット超過を追加）
    let reason: ConvergenceReason;
    if (satisfactionConverged) {
      reason = 'natural_consensus';
    } else if (budgetExceeded) {
      reason = 'facilitator_decision';
    } else if (!dialogueState.shouldContinue) {
      reason = 'facilitator_decision';
    } else if (consensusConverged) {
      reason = 'high_satisfaction';
    } else {
      reason = 'natural_consensus';
    }

    return { converged: true, reason, readyToMoveCount, averageSatisfaction, totalAgentsChecked, budgetExceeded };
  }
}
