import { Agent, AgentInstance, Session, Language, Message, AgentResponse } from '../types/index.js';

export interface IAgentManager {
  getAgent(agentId: string): AgentInstance | undefined;
  getAvailableAgents(): Agent[];
  initializeAgents(): Promise<void>;
}

export interface ISessionManager {
  getSession(sessionId: string): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;
  createSession(title: string, agentIds: string[], language: string, version?: '1.0' | '2.0'): Promise<Session>;
  saveSession(session: Session): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  resetSession(sessionId: string): Promise<Session>;
  startNewSequence(sessionId: string, userPrompt?: string): Promise<Session>;
  getSessionStorage(): any;
  getPreviousSequenceInfo(session: Session): {
    previousUserInput: string;
    previousAgentConclusions: { [agentId: string]: string };
  };
}

export interface IRealtimeRouter {
  executeStageRealtime(
    sessionId: string,
    userPrompt: string,
    stage: string,
    language: Language,
    onProgress?: (update: { message?: Message; session?: Session }) => void
  ): Promise<{ stage: string; agentResponses: AgentResponse[]; duration: number }>;
  getSession(sessionId: string): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;
  createSession(title: string, agentIds: string[], language: Language, version?: '1.0' | '2.0'): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
  resetSession(sessionId: string): Promise<Session>;
  startNewSequence(sessionId: string): Promise<Session>;
  getAvailableAgents(): Agent[];
  setDefaultLanguage(language: Language): void;
  getDefaultLanguage(): Language;
  saveSession(session: Session): Promise<void>;
} 