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

export interface FacilitatorAction {
  type: 'deep_dive' | 'clarification' | 'perspective_shift' | 'summarize' | 'conclude' | 'redirect';
  target?: string; // エージェントIDまたはトピック
  reason: string;
  priority: number; // 1-10
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