import { Language } from '../templates/prompts.js';

export type { Language };

export interface Agent {
  id: string;
  name: string;
  furigana: string;
  style: "logical" | "critical" | "intuitive" | "meta" | "emotive" | "analytical";
  priority: "precision" | "breadth" | "depth" | "balance";
  memoryScope: "local" | "session" | "cross-session";
  personality: string;
  preferences: string[];
  tone: string;
  communicationStyle: string;
  avatar?: string;
  color?: string;
  isSummarizer?: boolean;
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  stage?: DialogueStage;
  sequenceNumber?: number;
  metadata?: {
    reasoning?: string;
    confidence?: number;
    references?: string[];
    stageData?: any;
    voteFor?: string;
    voteReasoning?: string;
    voteSection?: string;
  };
}

export interface Session {
  id: string;
  title: string;
  agents: Agent[];
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'paused';
  currentStage?: DialogueStage;
  stageHistory: StageHistory[];
  stageSummaries?: StageSummary[];
  complete?: boolean;
  outputFileName?: string;
  sequenceNumber?: number;
  language: Language;
}

export interface AgentResponse {
  agentId: string;
  content: string;
  summary?: string;
  reasoning?: string;
  confidence?: number;
  references?: string[];
  stage?: DialogueStage;
  stageData?: any;
  metadata?: {
    voteFor?: string;
    voteReasoning?: string;
    voteSection?: string;
  };
}

export interface CollaborationResult {
  sessionId: string;
  finalDecision?: string;
  consensus?: number;
  reasoningTrace: Message[];
  summary?: string;
  stageResults: StageResult[];
}

// Yui Protocol specific types
export type DialogueStage = 
  | 'individual-thought'
  | 'mutual-reflection'
  | 'mutual-reflection-summary'
  | 'conflict-resolution'
  | 'conflict-resolution-summary'
  | 'synthesis-attempt'
  | 'synthesis-attempt-summary'
  | 'output-generation'
  | 'finalize';

export interface StageHistory {
  stage: DialogueStage;
  startTime: Date;
  endTime?: Date;
  agentResponses: AgentResponse[];
  conflicts?: Conflict[];
  synthesis?: SynthesisAttempt;
  sequenceNumber?: number;
}

export interface StageResult {
  stage: DialogueStage;
  agentResponses: AgentResponse[];
  conflicts?: Conflict[];
  synthesis?: SynthesisAttempt;
  duration: number;
}

export interface Conflict {
  id: string;
  agents: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

export interface ConflictResolution {
  conflicts: Conflict[];
  votes: { [agentId: string]: string };
  arguments: { [agentId: string]: string };
}

export interface SynthesisAttempt {
  consensus: number;
  unifiedPerspective?: string;
  remainingDisagreements?: string[];
  confidence: number;
}

export interface IndividualThought {
  agentId: string;
  content: string;
  summary?: string;
  reasoning: string;
  assumptions: string[];
  approach: string;
}

export interface MutualReflection {
  agentId: string;
  content: string;
  summary?: string;
  reflections: {
    targetAgentId: string;
    reaction: string;
    agreement: boolean;
    questions: string[];
  }[];
}

export interface DialogueLog {
  sessionId: string;
  timestamp: Date;
  query: string;
  stages: {
    stage1: IndividualThought[];
    stage2: MutualReflection[];
    stage3: ConflictResolution;
    stage4: SynthesisAttempt;
    stage5: AgentResponse;
  };
  metadata: {
    participants: Agent[];
    duration: number;
    consensusLevel: number;
  };
}

export interface StageSummary {
  stage: DialogueStage;
  summary: {
    speaker: string;
    position: string;
  }[];
  timestamp: Date;
  stageNumber: number;
  sequenceNumber?: number;
}

export interface SummaryStage {
  stage: DialogueStage;
  summary: string;
  timestamp: Date;
  stageNumber: number;
  sequenceNumber?: number;
} 