import { Message } from './index.js';

export interface ConsensusIndicator {
  agentId: string;
  satisfactionLevel: number;     // 1-10
  hasAdditionalPoints: boolean;
  questionsForOthers: string[];
  readyToMove: boolean;
  reasoning: string;             // 納得度の理由
}

export interface DialogueState {
  currentTopic: string;
  roundNumber: number;
  participantStates: ConsensusIndicator[];
  overallConsensus: number;
  suggestedActions: FacilitatorAction[];
  shouldContinue: boolean;
  recommendedActionCount?: number; // 1ラウンドで実行すべきアクション数（1-3）
}

/**
 * 動的インストラクション - 文脈に応じてAIが生成するメタ指示
 * 「問いを閉じず、矛盾を資源とする」プロジェクト哲学を反映
 */
export interface DynamicInstruction {
  content: string;           // 実際の指示テキスト
  tone: 'exploratory' | 'deconstructive' | 'integrative';
  ragDissonance?: {          // RAG類似性で発火した場合
    sourceSessionId: string;
    sourceConclusionSummary: string;
    similarityScore: number;
    deconstructionHint: string;
  };
  metadata?: {
    triggerReason: 'easy_consensus' | 'dialogue_gap' | 'rag_similarity' | 'topic_stagnation';
    generatedAt: Date;
  };
}

export interface FacilitatorAction {
  type: 'deep_dive' | 'clarification' | 'perspective_shift' | 'summarize' | 'conclude' | 'redirect';
  target?: string; // エージェントIDまたはトピック
  reason: string;
  priority: number; // 1-10
  dynamicInstruction?: DynamicInstruction; // v2.0: AI生成のメタ指示
}

export interface FacilitatorLog {
  sessionId: string;
  roundNumber: number;
  timestamp: Date;
  action: 'analysis' | 'decision' | 'intervention';
  decision: {
    type: string;
    reasoning: string;
    dataAnalyzed: {
      consensusLevels: Record<string, number>;
      overallConsensus: number;
      shouldContinue: boolean;
      topicDrift?: boolean;
    };
    suggestedActions: FacilitatorAction[];
    selectedAction?: FacilitatorAction;
  };
  executionDetails?: {
    success: boolean;
    errorMessage?: string;
    agentResponses?: string[];
  };
}

export interface DynamicRound {
  roundId: number;
  topic: string;
  messages: Message[];
  consensusData: ConsensusIndicator[];
  facilitatorActions: FacilitatorAction[];
  duration: number; // ms
}