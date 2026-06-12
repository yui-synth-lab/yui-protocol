import { describe, it, expect } from 'vitest';
import { ConvergenceJudge } from '../src/dialogue/convergence-judge';
import { ConsensusIndicator } from '../src/types/consensus';

const indicator = (satisfactionLevel: number, readyToMove: boolean): ConsensusIndicator => ({
  agentId: `agent-${Math.random()}`,
  satisfactionLevel,
  hasAdditionalPoints: false,
  questionsForOthers: [],
  readyToMove,
  reasoning: 'test'
});

describe('ConvergenceJudge', () => {
  const defaultJudge = new ConvergenceJudge();

  it('does not converge when no consensus data exists (first round)', () => {
    const decision = defaultJudge.judge([], { shouldContinue: false, overallConsensus: 10 }, 1);
    expect(decision.converged).toBe(false);
  });

  it('converges when the facilitator decides to stop', () => {
    const data = [indicator(5, false), indicator(5, false)];
    const decision = defaultJudge.judge(data, { shouldContinue: false, overallConsensus: 5 }, 1);
    expect(decision.converged).toBe(true);
    expect(decision.reason).toBe('facilitator_decision');
  });

  it('converges on high overall consensus only after the minimum round (default 3)', () => {
    const data = [indicator(7, false), indicator(7, false)];
    const early = defaultJudge.judge(data, { shouldContinue: true, overallConsensus: 7.5 }, 2);
    expect(early.converged).toBe(false);

    const later = defaultJudge.judge(data, { shouldContinue: true, overallConsensus: 7.5 }, 3);
    expect(later.converged).toBe(true);
    expect(later.reason).toBe('high_satisfaction');
  });

  it('converges on high satisfaction with majority ready, from round 2', () => {
    const data = [indicator(9, true), indicator(8, true), indicator(8, false)];
    const decision = defaultJudge.judge(data, { shouldContinue: true, overallConsensus: 5 }, 2);
    expect(decision.converged).toBe(true);
    expect(decision.reason).toBe('natural_consensus');
    expect(decision.averageSatisfaction).toBeCloseTo(25 / 3);
    expect(decision.readyToMoveCount).toBe(2);
  });

  it('does not converge below thresholds', () => {
    const data = [indicator(5, false), indicator(6, true)];
    const decision = defaultJudge.judge(data, { shouldContinue: true, overallConsensus: 6 }, 10);
    expect(decision.converged).toBe(false);
  });

  it('respects a configured convergenceThreshold', () => {
    const strictJudge = new ConvergenceJudge({ convergenceThreshold: 9.0 });
    const data = [indicator(7, false)];
    const decision = strictJudge.judge(data, { shouldContinue: true, overallConsensus: 8.5 }, 5);
    expect(decision.converged).toBe(false);

    const lenientJudge = new ConvergenceJudge({ convergenceThreshold: 6.0 });
    const decision2 = lenientJudge.judge(data, { shouldContinue: true, overallConsensus: 6.5 }, 5);
    expect(decision2.converged).toBe(true);
  });

  it('forces convergence when the LLM call budget is exceeded (M7)', () => {
    const budgetJudge = new ConvergenceJudge({ maxLlmCallsPerSession: 50 });
    const data = [indicator(3, false)];
    const decision = budgetJudge.judge(data, { shouldContinue: true, overallConsensus: 3 }, 2, 50);
    expect(decision.converged).toBe(true);
    expect(decision.budgetExceeded).toBe(true);
    expect(decision.reason).toBe('facilitator_decision');
  });

  it('budget forces convergence even with no consensus data', () => {
    const budgetJudge = new ConvergenceJudge({ maxLlmCallsPerSession: 10 });
    const decision = budgetJudge.judge([], { shouldContinue: true, overallConsensus: 0 }, 1, 15);
    expect(decision.converged).toBe(true);
    expect(decision.budgetExceeded).toBe(true);
  });

  it('budget has no effect when not configured (default behavior preserved)', () => {
    const data = [indicator(3, false)];
    const decision = defaultJudge.judge(data, { shouldContinue: true, overallConsensus: 3 }, 2, 9999);
    expect(decision.converged).toBe(false);
  });
});
