import { Agent, AgentInstance, Session, Language, Message, AgentResponse } from '../types/index.js';

export interface IAgentManager {
  getAgent(agentId: string): AgentInstance | undefined;
  getAvailableAgents(): Agent[];
  initializeAgents(): void;
}

export interface ISessionManager {
  getSession(sessionId: string): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;
  createSession(title: string, agentIds: string[], language: Language): Promise<Session>;
  saveSession(session: Session): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  resetSession(sessionId: string): Promise<Session>;
  startNewSequence(sessionId: string): Promise<Session>;
}

export interface IRealtimeRouter {
  executeStageRealtime(
    sessionId: string,
    userPrompt: string,
    stage: string,
    language: Language,
    onProgress?: (message: Message) => void
  ): Promise<{ stage: string; agentResponses: AgentResponse[]; duration: number }>;
  getSession(sessionId: string): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;
  createSession(title: string, agentIds: string[], language: Language): Promise<Session>;
  deleteSession(sessionId: string): Promise<boolean>;
  resetSession(sessionId: string): Promise<Session>;
  startNewSequence(sessionId: string): Promise<Session>;
  getAvailableAgents(): Agent[];
  setDefaultLanguage(language: Language): void;
  getDefaultLanguage(): Language;
  saveSession(session: Session): Promise<void>;
} 