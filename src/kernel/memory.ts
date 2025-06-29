import { Session, Message, Agent } from '../types/index.js';

export interface MemoryStore {
  saveSession(session: Session): Promise<void>;
  loadSession(sessionId: string): Promise<Session | null>;
  getAllSessions(): Promise<Session[]>;
  deleteSession(sessionId: string): Promise<boolean>;
  saveMessage(sessionId: string, message: Message): Promise<void>;
}

export class InMemoryStore implements MemoryStore {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, Message[]> = new Map();

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
    this.messages.set(session.id, session.messages);
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const messages = this.messages.get(sessionId) || [];
    return {
      ...session,
      messages
    };
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map(session => ({
      ...session,
      messages: this.messages.get(session.id) || []
    }));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const deleted = this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    return deleted;
  }

  async saveMessage(sessionId: string, message: Message): Promise<void> {
    const messages = this.messages.get(sessionId) || [];
    messages.push(message);
    this.messages.set(sessionId, messages);
  }
}

export class FileSystemStore implements MemoryStore {
  private filePath: string;

  constructor(filePath: string = './data/sessions.json') {
    this.filePath = filePath;
  }

  async saveSession(session: Session): Promise<void> {
    // Implementation for file-based storage
    // This would write to a JSON file
    console.log('Saving session to file:', session.id);
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    // Implementation for loading from file
    console.log('Loading session from file:', sessionId);
    return null;
  }

  async getAllSessions(): Promise<Session[]> {
    // Implementation for loading all sessions
    console.log('Loading all sessions from file');
    return [];
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    // Implementation for deleting session
    console.log('Deleting session from file:', sessionId);
    return true;
  }

  async saveMessage(sessionId: string, message: Message): Promise<void> {
    // Implementation for saving message
    console.log('Saving message to file:', sessionId, message.id);
  }
} 