import { Session, Agent } from '../../types/index.js';
import { SessionStorage } from '../session-storage.js';
import { IAgentManager } from '../interfaces.js';

export class SessionManager {
  private sessionStorage: SessionStorage;
  private agentManager: IAgentManager;
  private sessions: Map<string, Session> = new Map();

  constructor(sessionStorage: SessionStorage, agentManager: IAgentManager) {
    this.sessionStorage = sessionStorage;
    this.agentManager = agentManager;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async createSession(title: string, agentIds: string[], language: string): Promise<Session> {
    const session: Session = {
      id: Math.random().toString(36).slice(2),
      title,
      agents: agentIds.map((id) => this.agentManager.getAgent(id)?.getAgent() as Agent),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stageHistory: [],
      language: language as any
    };
    this.sessions.set(session.id, session);
    await this.saveSession(session);
    return session;
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    await this.sessionStorage.saveSession(session);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.sessions.delete(sessionId);
    return this.sessionStorage.deleteSession(sessionId);
  }

  async resetSession(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    session.messages = [];
    session.stageHistory = [];
    session.updatedAt = new Date();
    await this.saveSession(session);
    return session;
  }

  async startNewSequence(sessionId: string): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    session.sequenceNumber = (session.sequenceNumber || 1) + 1;
    session.updatedAt = new Date();
    await this.saveSession(session);
    return session;
  }
} 