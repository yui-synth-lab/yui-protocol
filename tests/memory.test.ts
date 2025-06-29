import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryStore, FileSystemStore, MemoryStore } from '../src/kernel/memory.js';
import { Session, Message, Agent } from '../src/types/index.js';

describe('MemoryStore', () => {
  describe('InMemoryStore', () => {
    let store: InMemoryStore;
    let testSession: Session;
    let testMessage: Message;
    let testAgent: Agent;

    beforeEach(() => {
      store = new InMemoryStore();
      testAgent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        style: 'analytical',
        personality: 'Analytical and precise',
        priority: 'precision',
        memoryScope: 'session',
        preferences: ['reasoning', 'analysis']
      };
      testSession = {
        id: 'test-session-123',
        title: 'Test Session',
        agents: [testAgent],
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        stageHistory: []
      };
      testMessage = {
        id: 'test-message-1',
        agentId: 'test-agent-1',
        content: 'Test message content',
        timestamp: new Date(),
        role: 'user'
      };
    });

    describe('saveSession', () => {
      it('should save a session successfully', async () => {
        await store.saveSession(testSession);
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession).toEqual(testSession);
      });

      it('should update existing session', async () => {
        await store.saveSession(testSession);
        
        const updatedSession = { ...testSession, title: 'Updated Title' };
        await store.saveSession(updatedSession);
        
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession?.title).toBe('Updated Title');
      });
    });

    describe('loadSession', () => {
      it('should load an existing session', async () => {
        await store.saveSession(testSession);
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession).toEqual(testSession);
      });

      it('should return null for non-existent session', async () => {
        const loadedSession = await store.loadSession('non-existent');
        expect(loadedSession).toBeNull();
      });
    });

    describe('getAllSessions', () => {
      it('should return all saved sessions', async () => {
        const session1 = { ...testSession, id: 'session-1' };
        const session2 = { ...testSession, id: 'session-2' };
        
        await store.saveSession(session1);
        await store.saveSession(session2);
        
        const allSessions = await store.getAllSessions();
        expect(allSessions).toHaveLength(2);
        expect(allSessions.map(s => s.id)).toContain('session-1');
        expect(allSessions.map(s => s.id)).toContain('session-2');
      });

      it('should return empty array when no sessions exist', async () => {
        const allSessions = await store.getAllSessions();
        expect(allSessions).toEqual([]);
      });
    });

    describe('deleteSession', () => {
      it('should delete an existing session', async () => {
        await store.saveSession(testSession);
        const deleted = await store.deleteSession(testSession.id);
        expect(deleted).toBe(true);
        
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession).toBeNull();
      });

      it('should return false for non-existent session', async () => {
        const deleted = await store.deleteSession('non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('saveMessage', () => {
      it('should save a message to a session', async () => {
        await store.saveSession(testSession);
        await store.saveMessage(testSession.id, testMessage);
        
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession?.messages).toHaveLength(1);
        expect(loadedSession?.messages[0]).toEqual(testMessage);
      });

      it('should append multiple messages to a session', async () => {
        await store.saveSession(testSession);
        const message1 = { ...testMessage, id: 'msg-1' };
        const message2 = { ...testMessage, id: 'msg-2' };
        
        await store.saveMessage(testSession.id, message1);
        await store.saveMessage(testSession.id, message2);
        
        const loadedSession = await store.loadSession(testSession.id);
        expect(loadedSession?.messages).toHaveLength(2);
        expect(loadedSession?.messages[0].id).toBe('msg-1');
        expect(loadedSession?.messages[1].id).toBe('msg-2');
      });

      it('should handle saving message to non-existent session', async () => {
        // Should not throw error, but message won't be saved
        await expect(store.saveMessage('non-existent', testMessage)).resolves.not.toThrow();
      });
    });
  });

  describe('FileSystemStore', () => {
    let store: FileSystemStore;

    beforeEach(() => {
      store = new FileSystemStore('./test-data/sessions.json');
    });

    describe('saveSession', () => {
      it('should log saving session to file', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const testSession: Session = {
          id: 'test-session-123',
          title: 'Test Session',
          agents: [],
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active',
          stageHistory: []
        };

        await store.saveSession(testSession);
        expect(consoleSpy).toHaveBeenCalledWith('Saving session to file:', testSession.id);
        consoleSpy.mockRestore();
      });
    });

    describe('loadSession', () => {
      it('should log loading session from file', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await store.loadSession('test-session-123');
        
        expect(consoleSpy).toHaveBeenCalledWith('Loading session from file:', 'test-session-123');
        expect(result).toBeNull();
        consoleSpy.mockRestore();
      });
    });

    describe('getAllSessions', () => {
      it('should log loading all sessions and return empty array', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await store.getAllSessions();
        
        expect(consoleSpy).toHaveBeenCalledWith('Loading all sessions from file');
        expect(result).toEqual([]);
        consoleSpy.mockRestore();
      });
    });

    describe('deleteSession', () => {
      it('should log deleting session and return true', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await store.deleteSession('test-session-123');
        
        expect(consoleSpy).toHaveBeenCalledWith('Deleting session from file:', 'test-session-123');
        expect(result).toBe(true);
        consoleSpy.mockRestore();
      });
    });

    describe('saveMessage', () => {
      it('should log saving message to file', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const testMessage: Message = {
          id: 'test-message-1',
          agentId: 'test-agent-1',
          content: 'Test message content',
          timestamp: new Date(),
          role: 'user'
        };

        await store.saveMessage('test-session-123', testMessage);
        expect(consoleSpy).toHaveBeenCalledWith('Saving message to file:', 'test-session-123', testMessage.id);
        consoleSpy.mockRestore();
      });
    });
  });
}); 