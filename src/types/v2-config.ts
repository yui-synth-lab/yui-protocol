// V2.0 動的対話システムの設定型定義

export interface MemoryConfig {
  maxRecentMessages: number;     // 短期記憶の最大メッセージ数
  tokenThreshold: number;        // 圧縮を開始するトークン閾値
  compressionRatio: number;      // 圧縮率 (0.0-1.0)
  personalityAware: boolean;     // 個性反映圧縮
}

export interface ConsensusConfig {
  convergenceThreshold: number;  // 収束判定の閾値（overallConsensus がこの値以上で収束候補）
  maxRounds: number;            // 最大ラウンド数
  minSatisfactionLevel: number; // 最低満足度レベル
  minRoundsForConvergence?: number;              // コンセンサス収束に必要な最小ラウンド（既定: 3）
  highSatisfactionThreshold?: number;            // 平均満足度の収束しきい値（既定: 8.0）
  minRoundsForSatisfactionConvergence?: number;  // 満足度収束に必要な最小ラウンド（既定: 2）
  maxLlmCallsPerSession?: number;                // M7: セッション単位のLLM呼び出しバジェット（未設定で無効）
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

// コスト最適化（M2/M3）: タスク階層別のモデル設定。未設定なら従来どおり本体モデルを使用
export interface ModelTierConfig {
  provider: string;
  model: string;
  maxTokens?: number;   // タスク別出力上限（M3）。既定 500
}

export interface ModelTiersConfig {
  mechanical?: ModelTierConfig; // コンセンサス確認・投票など様式化タスク
  summary?: ModelTierConfig;    // 要約・メモリ圧縮
}

// コスト最適化（M4 ほか）: 未設定なら従来挙動
export interface CostOptimizationConfig {
  regexFirstVoteAnalysis?: boolean; // M4: 正規表現で全票確定時はAI投票解析をスキップ
}

export interface V2Settings {
  memory: MemoryConfig;
  consensus: ConsensusConfig;
  facilitator: FacilitatorConfig;
  modelTiers?: ModelTiersConfig;
  costOptimization?: CostOptimizationConfig;
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