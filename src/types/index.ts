import { Language } from '../templates/prompts.js';

export type { Language };

export interface Agent {
  id: string;
  name: string;
  style: "logical" | "critical" | "intuitive" | "meta" | "emotive" | "analytical";
  priority: "precision" | "breadth" | "depth" | "balance";
  memoryScope: "local" | "session" | "cross-session";
  personality: string;
  preferences: string[];
  tone: string;
  communicationStyle: string;
  avatar?: string;
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  stage?: DialogueStage;
  metadata?: {
    reasoning?: string;
    confidence?: number;
    references?: string[];
    stageData?: any;
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
}

export interface AgentResponse {
  agentId: string;
  content: string;
  reasoning?: string;
  confidence?: number;
  references?: string[];
  stage?: DialogueStage;
  stageData?: any;
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
  | 'conflict-resolution'
  | 'synthesis-attempt'
  | 'output-generation';

export interface StageHistory {
  stage: DialogueStage;
  startTime: Date;
  endTime?: Date;
  agentResponses: AgentResponse[];
  conflicts?: Conflict[];
  synthesis?: SynthesisAttempt;
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
  reasoning: string;
  assumptions: string[];
  approach: string;
}

export interface MutualReflection {
  agentId: string;
  content: string;
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

// Detailed AI interaction logging types
export interface AIInteractionLog {
  id: string;
  sessionId: string;
  stage: DialogueStage;
  agentId: string;
  agentName: string;
  timestamp: Date;
  input: {
    prompt: string;
    context: Message[];
    stageData?: any;
    language: Language;
  };
  output: {
    content: string;
    reasoning?: string;
    confidence?: number;
    stageData?: any;
    metadata?: Record<string, any>;
  };
  duration: number; // in milliseconds
  status: 'success' | 'error' | 'timeout';
  error?: string;
}

export interface SessionInteractionSummary {
  sessionId: string;
  title: string;
  createdAt: Date;
  completedAt?: Date;
  totalInteractions: number;
  agents: {
    agentId: string;
    agentName: string;
    interactions: number;
    totalDuration: number;
    averageConfidence: number;
  }[];
  stages: {
    stage: DialogueStage;
    interactions: number;
    averageDuration: number;
    conflicts?: number;
  }[];
  language: Language;
}

// Simplified interaction log for hierarchical storage
export interface SimplifiedInteractionLog {
  id: string;
  sessionId: string;
  stage: DialogueStage;
  agentId: string;
  agentName: string;
  timestamp: Date;
  prompt: string;
  output: string;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
} 