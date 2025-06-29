import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionStorage } from '../src/kernel/session-storage.js';
import { Session, Agent, Message } from '../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
    },
    existsSync: vi.fn(),
  },
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
  existsSync: vi.fn(),
}));

describe('SessionStorage', () => {
  let sessionStorage: SessionStorage;
  let mockSession: Session;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    // 必ずaccess/mkdir/writeFile/unlink/readdir/readFileもモック
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readdir).mockResolvedValue([]);
    vi.mocked(fs.promises.readFile).mockResolvedValue('');
    // ensureStorageDirを何もしないモックに
    vi.spyOn(SessionStorage.prototype as any, 'ensureStorageDir').mockImplementation(() => Promise.resolve());

    sessionStorage = new SessionStorage();
    
    // Create a mock session
    mockSession = {
      id: 'test-session-123',
      title: 'Test Session',
      agents: [
        {
          id: 'agent-1',
          name: 'Test Agent',
          style: 'logical',
          priority: 'precision',
          memoryScope: 'session',
          personality: 'Test personality',
          preferences: ['test']
        } as Agent
      ],
      messages: [
        {
          id: 'msg-1',
          agentId: 'user',
          content: 'Test message',
          timestamp: new Date('2023-01-01T00:00:00.000Z'),
          role: 'user'
        } as Message
      ],
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      status: 'active',
      stageHistory: []
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveSession', () => {
    it('should save a session to file', async () => {
      const mockWriteFile = vi.mocked(fs.promises.writeFile);
      mockWriteFile.mockClear();
      mockWriteFile.mockResolvedValue(undefined);
      await sessionStorage.saveSession(mockSession);
      const callArgs = mockWriteFile.mock.calls[0];
      expect(path.basename(callArgs[0] as string)).toBe('test-session-123.json');
      const writtenContent = callArgs[1] as string;
      const parsedContent = JSON.parse(writtenContent);
      expect(parsedContent.id).toBe('test-session-123');
      expect(parsedContent.title).toBe('Test Session');
    });

    it('should handle write errors', async () => {
      const mockWriteFile = vi.mocked(fs.promises.writeFile);
      mockWriteFile.mockClear();
      mockWriteFile.mockRejectedValue(new Error('Write failed'));
      await expect(sessionStorage.saveSession(mockSession)).rejects.toThrow('Write failed');
    });
  });

  describe('loadSession', () => {
    it('should load a session from file', async () => {
      const mockReadFile = vi.mocked(fs.promises.readFile);
      mockReadFile.mockClear();
      const sessionJson = JSON.stringify(mockSession);
      mockReadFile.mockResolvedValue(sessionJson);
      const loadedSession = await sessionStorage.loadSession('test-session-123');
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('test-session-123.json'),
        'utf8'
      );
      expect(loadedSession).toEqual(mockSession);
    });

    it('should return null for non-existent session', async () => {
      const mockReadFile = vi.mocked(fs.promises.readFile);
      
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      const loadedSession = await sessionStorage.loadSession('non-existent');

      expect(loadedSession).toBeNull();
    });

    it('should handle invalid JSON', async () => {
      const mockReadFile = vi.mocked(fs.promises.readFile);
      
      mockReadFile.mockResolvedValue('invalid json');

      const loadedSession = await sessionStorage.loadSession('test-session-123');

      expect(loadedSession).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', async () => {
      const mockReaddir = vi.mocked(fs.promises.readdir);
      const mockReadFile = vi.mocked(fs.promises.readFile);
      mockReaddir.mockClear();
      mockReadFile.mockClear();
      mockReaddir.mockResolvedValue(['session1.json', 'session2.json'] as any);
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({ ...mockSession, id: 'session1' }))
        .mockResolvedValueOnce(JSON.stringify({ ...mockSession, id: 'session2' }));
      const sessions = await sessionStorage.getAllSessions();
      expect(mockReaddir).toHaveBeenCalledWith('./sessions');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session1');
      expect(sessions[1].id).toBe('session2');
    });

    it('should return empty array when sessions directory does not exist', async () => {
      const mockExistsSync = vi.mocked(fs.existsSync);
      
      mockExistsSync.mockReturnValue(false);

      const sessions = await sessionStorage.getAllSessions();

      expect(sessions).toEqual([]);
    });

    it('should handle readdir errors', async () => {
      const mockReaddir = vi.mocked(fs.promises.readdir);
      const mockExistsSync = vi.mocked(fs.existsSync);

      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockRejectedValue(new Error('Read failed'));

      const sessions = await sessionStorage.getAllSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session file', async () => {
      const mockUnlink = vi.mocked(fs.promises.unlink);
      mockUnlink.mockClear();
      mockUnlink.mockResolvedValue(undefined);
      const result = await sessionStorage.deleteSession('test-session-123');
      expect(mockUnlink).toHaveBeenCalledWith(
        expect.stringContaining('test-session-123.json')
      );
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const mockUnlink = vi.mocked(fs.promises.unlink);
      mockUnlink.mockClear();
      const error = new Error('Delete failed');
      (error as any).code = 'ENOENT';
      mockUnlink.mockRejectedValue(error);
      const result = await sessionStorage.deleteSession('test-session-123');
      expect(result).toBe(false);
    });
  });

  describe('sessionExists', () => {
    it('should check if session file exists', async () => {
      const mockAccess = vi.mocked(fs.promises.access);
      mockAccess.mockResolvedValue(undefined);
      const exists = await sessionStorage.sessionExists('test-session-123');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const mockAccess = vi.mocked(fs.promises.access);
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      mockAccess.mockRejectedValue(error);
      const exists = await sessionStorage.sessionExists('non-existent');
      expect(exists).toBe(false);
    });
  });
}); 