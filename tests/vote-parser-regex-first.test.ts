import { describe, it, expect } from 'vitest';
import { analyzeVotesByRegex, formatVoteAnalysisMarkdown } from '../src/dialogue/voting/vote-parser';

const agents = [
  { id: 'yui-000', name: '結心' },
  { id: 'eiro-001', name: '慧露' },
  { id: 'kanshi-001', name: '観至' }
];

describe('analyzeVotesByRegex (M4 regex-first)', () => {
  it('resolves all votes when every response has a clear vote', () => {
    const responses = [
      { agentId: 'yui-000', content: '投票: eiro-001\n理由: 論理的なまとめが期待できるため' },
      { agentId: 'kanshi-001', content: 'Vote: eiro-001\nReason: systematic synthesis' }
    ];
    const result = analyzeVotesByRegex(responses, agents);
    expect(result.resolvedAll).toBe(true);
    expect(result.analyses).toHaveLength(2);
    expect(result.analyses[0].votedAgent).toBe('eiro-001');
    expect(result.analyses[1].votedAgent).toBe('eiro-001');
  });

  it('does not claim resolution when a vote is unclear', () => {
    const responses = [
      { agentId: 'yui-000', content: '投票: eiro-001\n理由: 適任' },
      { agentId: 'kanshi-001', content: 'みなさんの議論は素晴らしかったです。' }
    ];
    const result = analyzeVotesByRegex(responses, agents);
    expect(result.resolvedAll).toBe(false);
    expect(result.analyses[1].votedAgent).toBeNull();
  });

  it('returns resolvedAll=false for empty input', () => {
    const result = analyzeVotesByRegex([], agents);
    expect(result.resolvedAll).toBe(false);
    expect(result.analyses).toHaveLength(0);
  });

  it('excludes self-votes', () => {
    const responses = [
      { agentId: 'eiro-001', content: '投票: eiro-001\n理由: 自分が最適' }
    ];
    const result = analyzeVotesByRegex(responses, agents);
    expect(result.analyses[0].votedAgent).not.toBe('eiro-001');
  });
});

describe('formatVoteAnalysisMarkdown', () => {
  it('matches the stage-summarizer markdown format', () => {
    const analyses = [
      { agentId: 'yui-000', votedAgent: 'eiro-001', reasoning: '論理的', timestamp: new Date() },
      { agentId: 'kanshi-001', votedAgent: null, reasoning: null, timestamp: new Date() }
    ];
    const md = formatVoteAnalysisMarkdown(analyses, agents);
    expect(md).toContain('- 結心 (yui-000): 慧露 (eiro-001) - 論理的');
    expect(md).toContain('- 観至 (kanshi-001): No clear vote');
  });
});
