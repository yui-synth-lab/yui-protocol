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
  references?: string[];
  reasoning?: string;
  assumptions?: string[];
  approach?: string;
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
    stageData?: StageData;
    voteFor?: string;
    voteReasoning?: string;
    voteSection?: string;
    outputFileName?: string;
    sequenceOutputFiles?: { [sequenceNumber: number]: string };
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
  sequenceOutputFiles?: { [sequenceNumber: number]: string };
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
  stageData?: StageData;
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

// Additional types for realtime-router
export interface StageData {
  agentId: string;
  content: string;
  reasoning?: string;
  confidence?: number;
  summary?: string;
  reflections?: {
    targetAgentId: string;
    reaction: string;
    agreement: boolean;
    questions: string[];
  }[];
  assumptions?: string[];
  approach?: string;
  conflicts?: Conflict[];
  analysis?: string;
  resolution?: string;
}

export interface AgentInstance {
  getAgent(): Agent;
  setLanguage(language: Language): void;
  setSessionId(sessionId: string): void;
  setIsSummarizer(isSummarizer: boolean): void;
  stage1IndividualThought(prompt: string, context: Message[]): Promise<AgentResponse>;
  stage2MutualReflection(prompt: string, individualThoughts: IndividualThought[], context: Message[], AgentList: Agent[]): Promise<AgentResponse>;
  stage3ConflictResolution(conflicts: Conflict[], context: Message[]): Promise<AgentResponse>;
  stage4SynthesisAttempt(synthesisData: SynthesisData, context: Message[]): Promise<AgentResponse>;
  stage5OutputGeneration(finalData: FinalData, context: Message[]): Promise<AgentResponse>;
  stage5_1Finalize(votingResults: VotingResults, responses: AgentResponse[], context: Message[]): Promise<AgentResponse>;
}

export interface SynthesisData {
  query: string;
  individualThoughts: string[];
  mutualReflections: string[];
  conflictResolutions: string[];
  context: string;
}

export interface FinalData {
  query: string;
  finalData: {
    individualThoughts: string[];
    mutualReflections: string[];
    conflictResolutions: string[];
    synthesisAttempts: string[];
  };
  context: string;
}

export interface VotingResults {
  [agentId: string]: string;
}

export interface StageSummarizerOptions {
  language?: Language;
  maxSummaryLength?: number;
  includeConfidence?: boolean;
}

export interface DelayOptions {
  // エージェント間の応答間隔
  agentResponseDelayMS?: number;
  // ステージサマリー生成前の待機時間
  stageSummarizerDelayMS?: number;
  // 最終サマリー生成前の待機時間
  finalSummaryDelayMS?: number;
  // デフォルト値
  defaultDelayMS?: number;
}

export type ProgressUpdate = { message?: Message; session?: Session };

export interface ProgressCallback {
  (update: ProgressUpdate): void;
}

export interface StageExecutionResult {
  stage: DialogueStage;
  agentResponses: AgentResponse[];
  duration: number;
}

export interface SummaryExecutionResult {
  responses: AgentResponse[];
}

export interface FinalizeExecutionResult {
  responses: AgentResponse[];
}

export interface ConflictDescriptionTemplates {
  diversePerspectives: string;
  agentApproaches: string;
  approachAnalysis: string;
  potentialConflicts: string;
  mutualUnderstanding: string;
  complementarySolutions: string;
  conflictDetails: string;
  rootCauseAnalysis: string;
  resolutionDirection: string;
  discussionFocus: string;
  understandingDifferences: string;
  conceptualTensions: string;
  valueConflicts: string;
  ideaContradictions: string;
  synthesisOpportunities: string;
  frameworkIntegration: string;
  conceptualResolution: string;
  ideaSynthesis: string;
  perspectiveIntegration: string;
  coreInsights: string;
  fundamentalQuestions: string;
  emergingDirections: string;
  unresolvedTensions: string;
  synthesisPossibilities: string;
  multiplePerspectives: string;
  noSignificantConflicts: string;
}

export interface ApproachAnalysis {
  agentId: string;
  approach: string;
  style: Agent['style'];
}

export interface PotentialConflict {
  type: string;
  description: string;
  agents: string[];
} 