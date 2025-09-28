// V2.0 動的対話システムの設定型定義

export interface MemoryConfig {
  maxRecentMessages: number;     // 短期記憶の最大メッセージ数
  tokenThreshold: number;        // 圧縮を開始するトークン閾値
  compressionRatio: number;      // 圧縮率 (0.0-1.0)
  personalityAware: boolean;     // 個性反映圧縮
}

export interface ConsensusConfig {
  convergenceThreshold: number;  // 収束判定の閾値
  maxRounds: number;            // 最大ラウンド数
  minSatisfactionLevel: number; // 最低満足度レベル
}

export interface FacilitatorConfig {
  actionPriority: {
    deep_dive: number;
    clarification: number;
    perspective_shift: number;
    summarize: number;
    conclude: number;
  };
  interventionCooldown: number;  // 介入のクールダウン（ラウンド数）
}

export interface V2Settings {
  memory: MemoryConfig;
  consensus: ConsensusConfig;
  facilitator: FacilitatorConfig;
}

// デフォルト設定
export const DEFAULT_V2_SETTINGS: V2Settings = {
  memory: {
    maxRecentMessages: 5,
    tokenThreshold: 8000,
    compressionRatio: 0.3,
    personalityAware: true
  },
  consensus: {
    convergenceThreshold: 7.5,
    maxRounds: 20,
    minSatisfactionLevel: 6
  },
  facilitator: {
    actionPriority: {
      deep_dive: 8,
      clarification: 7,
      perspective_shift: 6,
      summarize: 5,
      conclude: 9
    },
    interventionCooldown: 2
  }
};