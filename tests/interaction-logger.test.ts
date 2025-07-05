import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionLogger, SimplifiedInteractionLog } from '../src/kernel/interaction-logger';
import { DialogueStage } from '../src/types';

describe('InteractionLogger', () => {
  let logger: InteractionLogger;
  let mockFs: any;

  beforeEach(() => {
    // シンプルなモックfsを作成
    mockFs = {
      access: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('[]'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true }),
      rm: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue({}),
      appendFile: vi.fn().mockResolvedValue(undefined),
      chmod: vi.fn().mockResolvedValue(undefined),
      chown: vi.fn().mockResolvedValue(undefined),
      lchmod: vi.fn().mockResolvedValue(undefined),
      lchown: vi.fn().mockResolvedValue(undefined),
      link: vi.fn().mockResolvedValue(undefined),
      lstat: vi.fn().mockResolvedValue({}),
      mkdtemp: vi.fn().mockResolvedValue(''),
      realpath: vi.fn().mockResolvedValue(''),
      rename: vi.fn().mockResolvedValue(undefined),
      rmdir: vi.fn().mockResolvedValue(undefined),
      symlink: vi.fn().mockResolvedValue(undefined),
      truncate: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      utimes: vi.fn().mockResolvedValue(undefined),
      lutimes: vi.fn().mockResolvedValue(undefined),
      watch: vi.fn().mockReturnValue({}),
      constants: {},
    };
    
    logger = new InteractionLogger('./test-logs', mockFs as any);
  });

  describe('constructor', () => {
    it('should create logger with default log directory', () => {
      const defaultLogger = new InteractionLogger();
      expect(defaultLogger).toBeInstanceOf(InteractionLogger);
    });

    it('should create logger with custom log directory', () => {
      const customLogger = new InteractionLogger('./custom-logs');
      expect(customLogger).toBeInstanceOf(InteractionLogger);
    });

    it('should create logger with custom file system', () => {
      const customLogger = new InteractionLogger('./custom-logs', mockFs as any);
      expect(customLogger).toBeInstanceOf(InteractionLogger);
    });
  });

  describe('saveInteractionLog', () => {
    const mockLog: SimplifiedInteractionLog = {
      id: 'test-id',
      sessionId: 'session-1',
      stage: 'individual-thought' as DialogueStage,
      agentId: 'agent-1',
      agentName: 'Test Agent',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      prompt: 'Test prompt',
      output: 'Test output',
      duration: 1000,
      status: 'success'
    };

    it('should save interaction log successfully', async () => {
      await logger.saveInteractionLog(mockLog);

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-logs\\session-1'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-logs\\session-1\\individual-thought'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-logs\\session-1\\individual-thought\\agent-1.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should append to existing file', async () => {
      const existingLogs = [mockLog];
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLogs));

      const newLog = { ...mockLog, id: 'test-id-2' };
      await logger.saveInteractionLog(newLog);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-logs\\session-1\\individual-thought\\agent-1.json'),
        'utf8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-logs\\session-1\\individual-thought\\agent-1.json'),
        JSON.stringify([mockLog, newLog], null, 2),
        'utf8'
      );
    });

    it('should handle errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await logger.saveInteractionLog(mockLog);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[InteractionLogger] Error saving interaction log:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getSessionLogs', () => {
    it('should return empty array for non-existent session', async () => {
      mockFs.access.mockRejectedValue(new Error('Directory not found'));

      const logs = await logger.getSessionLogs('non-existent-session');

      expect(logs).toEqual([]);
    });

    it('should return logs for existing session', async () => {
      const mockLog: SimplifiedInteractionLog = {
        id: 'test-id',
        sessionId: 'session-1',
        stage: 'individual-thought' as DialogueStage,
        agentId: 'agent-1',
        agentName: 'Test Agent',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        prompt: 'Test prompt',
        output: 'Test output',
        duration: 1000,
        status: 'success'
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir
        .mockResolvedValueOnce(['individual-thought'])
        .mockResolvedValueOnce(['agent-1.json']);
      mockFs.readFile.mockResolvedValue(JSON.stringify([mockLog]));

      const logs = await logger.getSessionLogs('session-1');

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('test-id');
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getAgentLogs', () => {
    it('should return logs for specific agent', async () => {
      const mockLog: SimplifiedInteractionLog = {
        id: 'test-id',
        sessionId: 'session-1',
        stage: 'individual-thought' as DialogueStage,
        agentId: 'agent-1',
        agentName: 'Test Agent',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        prompt: 'Test prompt',
        output: 'Test output',
        duration: 1000,
        status: 'success'
      };

      mockFs.readdir
        .mockResolvedValueOnce(['session-1'])
        .mockResolvedValueOnce(['individual-thought']);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify([mockLog]));

      const logs = await logger.getAgentLogs('agent-1');

      expect(logs).toHaveLength(1);
      expect(logs[0].agentId).toBe('agent-1');
    });
  });

  describe('getStageLogs', () => {
    it('should return logs for specific stage', async () => {
      const mockLog: SimplifiedInteractionLog = {
        id: 'test-id',
        sessionId: 'session-1',
        stage: 'individual-thought' as DialogueStage,
        agentId: 'agent-1',
        agentName: 'Test Agent',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        prompt: 'Test prompt',
        output: 'Test output',
        duration: 1000,
        status: 'success'
      };

      mockFs.readdir
        .mockResolvedValueOnce(['session-1'])
        .mockResolvedValueOnce(['agent-1.json']);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify([mockLog]));

      const logs = await logger.getStageLogs('individual-thought');

      expect(logs).toHaveLength(1);
      expect(logs[0].stage).toBe('individual-thought');
    });
  });
}); 