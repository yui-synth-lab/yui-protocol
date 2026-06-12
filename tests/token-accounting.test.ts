import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionLogger, SimplifiedInteractionLog } from '../src/kernel/interaction-logger';
import { DialogueStage } from '../src/types';

describe('Token accounting (M1)', () => {
  let logger: InteractionLogger;
  let mockFs: any;

  const makeLog = (overrides: Partial<SimplifiedInteractionLog> = {}): SimplifiedInteractionLog => ({
    id: `log-${Math.random()}`,
    sessionId: 'session-1',
    stage: 'individual-thought' as DialogueStage,
    agentId: 'yui-000',
    agentName: 'Yui',
    timestamp: new Date(),
    prompt: 'prompt',
    output: 'output',
    duration: 100,
    status: 'success',
    ...overrides
  });

  beforeEach(() => {
    mockFs = {
      access: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('[]'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ isDirectory: () => true })
    };
    logger = new InteractionLogger('./test-logs', mockFs as any);
  });

  it('aggregates tokensUsed per session', async () => {
    await logger.saveInteractionLog(makeLog({ tokensUsed: 100 }));
    await logger.saveInteractionLog(makeLog({ tokensUsed: 250 }));

    const stats = logger.getSessionTokenStats('session-1');
    expect(stats).toBeDefined();
    expect(stats!.totalTokens).toBe(350);
    expect(stats!.totalCalls).toBe(2);
    expect(stats!.failedCalls).toBe(0);
  });

  it('aggregates by agent, stage, and model', async () => {
    await logger.saveInteractionLog(makeLog({
      agentId: 'yui-000',
      stage: 'individual-thought' as DialogueStage,
      tokensUsed: 100,
      provider: 'openai',
      model: 'gpt-test'
    }));
    await logger.saveInteractionLog(makeLog({
      agentId: 'eiro-001',
      stage: 'mutual-reflection' as DialogueStage,
      tokensUsed: 200,
      provider: 'anthropic',
      model: 'claude-test'
    }));
    await logger.saveInteractionLog(makeLog({
      agentId: 'yui-000',
      stage: 'mutual-reflection' as DialogueStage,
      tokensUsed: 50,
      provider: 'openai',
      model: 'gpt-test'
    }));

    const stats = logger.getSessionTokenStats('session-1')!;
    expect(stats.byAgent['yui-000']).toEqual({ tokens: 150, calls: 2 });
    expect(stats.byAgent['eiro-001']).toEqual({ tokens: 200, calls: 1 });
    expect(stats.byStage['individual-thought']).toEqual({ tokens: 100, calls: 1 });
    expect(stats.byStage['mutual-reflection']).toEqual({ tokens: 250, calls: 2 });
    expect(stats.byModel['openai/gpt-test']).toEqual({ tokens: 150, calls: 2 });
    expect(stats.byModel['anthropic/claude-test']).toEqual({ tokens: 200, calls: 1 });
  });

  it('counts calls without tokensUsed (provider did not report usage)', async () => {
    await logger.saveInteractionLog(makeLog({}));

    const stats = logger.getSessionTokenStats('session-1')!;
    expect(stats.totalCalls).toBe(1);
    expect(stats.totalTokens).toBe(0);
  });

  it('counts failed calls', async () => {
    await logger.saveInteractionLog(makeLog({ status: 'error', error: 'boom', tokensUsed: 30 }));

    const stats = logger.getSessionTokenStats('session-1')!;
    expect(stats.failedCalls).toBe(1);
    expect(stats.totalTokens).toBe(30);
  });

  it('separates stats per session and lists all sessions', async () => {
    await logger.saveInteractionLog(makeLog({ sessionId: 'session-1', tokensUsed: 10 }));
    await logger.saveInteractionLog(makeLog({ sessionId: 'session-2', tokensUsed: 20 }));

    expect(logger.getSessionTokenStats('session-1')!.totalTokens).toBe(10);
    expect(logger.getSessionTokenStats('session-2')!.totalTokens).toBe(20);
    const all = logger.getAllTokenStats();
    expect(all.map(s => s.sessionId).sort()).toEqual(['session-1', 'session-2']);
  });

  it('returns undefined for unknown session', () => {
    expect(logger.getSessionTokenStats('nope')).toBeUndefined();
  });

  it('still records token usage when file persistence fails', async () => {
    mockFs.mkdir.mockRejectedValue(new Error('disk full'));
    await logger.saveInteractionLog(makeLog({ tokensUsed: 42 }));

    const stats = logger.getSessionTokenStats('session-1')!;
    expect(stats.totalTokens).toBe(42);
  });
});
