import * as fs from 'fs';
import path from 'path';
import { Session } from '../types/index.js';

// Shared utility function to remove circular references
export function removeCircularReferences(obj: any, seen = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object') {
        // Handle primitive types including Symbol
        if (typeof obj === 'symbol') {
            return obj.toString();
        }
        return obj;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    
    // Handle functions
    if (typeof obj === 'function') {
        return '[Function]';
    }
    
    // Handle RegExp
    if (obj instanceof RegExp) {
        return '[RegExp]';
    }
    
    // Handle Error
    if (obj instanceof Error) {
        return '[Error]';
    }
    
    // Handle Map
    if (obj instanceof Map) {
        return '[Map]';
    }
    
    // Handle Set
    if (obj instanceof Set) {
        return '[Set]';
    }
    
    if (seen.has(obj)) {
        return '[Circular Reference]';
    }
    
    seen.add(obj);
    
    if (Array.isArray(obj)) {
        return obj.map(item => removeCircularReferences(item, seen));
    }
    
    const result: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = removeCircularReferences(obj[key], seen);
        }
    }
    
    return result;
}

export class SessionStorage {
  private storageDir: string;

  constructor(storageDir: string = './sessions') {
    this.storageDir = storageDir;
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.promises.access(this.storageDir);
    } catch {
      await fs.promises.mkdir(this.storageDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }

  public async saveSession(session: Session): Promise<void> {
    await this.ensureStorageDir();
    try {
      const filePath = this.getSessionFilePath(session.id);
      // Remove circular references before serializing
      const cleanedSession = removeCircularReferences(session);
      const sessionData = JSON.stringify(cleanedSession, null, 2);
      await fs.promises.writeFile(filePath, sessionData, 'utf8');
    } catch (error) {
      console.error(`Error saving session ${session.id}:`, error);
      throw new Error(`Failed to save session: ${error}`);
    }
  }

  public async loadSession(sessionId: string): Promise<Session | null> {
    await this.ensureStorageDir();
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const sessionData = await fs.promises.readFile(filePath, 'utf8');
      let session;
      try {
        session = JSON.parse(sessionData);
      } catch (jsonError) {
        console.error(`Error parsing session JSON for ${sessionId}:`, jsonError);
        return null;
      }
      // Convert date strings back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      if (session.messages) {
        session.messages = session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      // Set default sequenceNumber if not present (for backward compatibility)
      if (session.sequenceNumber === undefined) {
        session.sequenceNumber = 1;
      }
      return session;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error(`Error loading session ${sessionId}:`, error);
      throw new Error(`Failed to load session: ${error}`);
    }
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureStorageDir();
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false; // File doesn't exist
      }
      console.error(`Error deleting session ${sessionId}:`, error);
      throw new Error(`Failed to delete session: ${error}`);
    }
  }

  public async getAllSessions(): Promise<Session[]> {
    await this.ensureStorageDir();
    try {
      const files = await fs.promises.readdir(this.storageDir);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const sessions: Session[] = [];
      for (const file of sessionFiles) {
        const sessionId = file.replace('.json', '');
        const session = await this.loadSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
      
      // Sort by updatedAt (newest first)
      return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error loading all sessions:', error);
      return [];
    }
  }

  public async sessionExists(sessionId: string): Promise<boolean> {
    await this.ensureStorageDir();
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
} 