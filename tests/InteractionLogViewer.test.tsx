import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InteractionLogViewer from '../src/ui/InteractionLogViewer';
import { SimplifiedInteractionLog, SessionInteractionSummary } from '../src/types';

const mockLogs: SimplifiedInteractionLog[] = [
  {
    id: 'log1',
    sessionId: 's1',
    stage: 'individual-thought',
    agentId: 'a1',
    agentName: 'Agent 1',
    timestamp: new Date(),
    prompt: 'Prompt 1',
    output: 'Output 1',
    duration: 1234,
    status: 'success',
    error: undefined
  }
];

const mockSummaries: SessionInteractionSummary[] = [
  {
    sessionId: 's1',
    title: 'Session 1',
    createdAt: new Date(),
    completedAt: undefined,
    totalInteractions: 1,
    agents: [
      {
        agentId: 'a1',
        agentName: 'Agent 1',
        interactions: 1,
        totalDuration: 1234,
        averageConfidence: 0.9
      }
    ],
    stages: [
      {
        stage: 'individual-thought',
        interactions: 1,
        averageDuration: 1234,
        conflicts: 0
      }
    ],
    language: 'en'
  }
];

global.fetch = vi.fn((url) => {
  if (typeof url === 'string' && url.includes('/api/logs/sessions/')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockLogs) });
  }
  if (typeof url === 'string' && url.includes('/api/logs/summaries')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummaries) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
}) as any;

describe('InteractionLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders logs for a session', async () => {
    render(<InteractionLogViewer sessionId="s1" />);
    await waitFor(() => expect(screen.getByText('Session s1 Logs')).toBeInTheDocument());
    expect(screen.getByText('Agent 1')).toBeInTheDocument();
    expect(screen.getByText('individual-thought')).toBeInTheDocument();
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('Prompt 1...')).toBeInTheDocument();
    expect(screen.getByText('Output 1...')).toBeInTheDocument();
  });

  it('shows "No logs found" if logs are empty', async () => {
    (fetch as any).mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
    render(<InteractionLogViewer sessionId="empty" />);
    await waitFor(() => expect(screen.getByText('No logs found')).toBeInTheDocument());
  });

  it('can switch to summaries view', async () => {
    render(<InteractionLogViewer sessionId="s1" />);
    await waitFor(() => expect(screen.getByText('Session s1 Logs')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Summaries'));
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    expect(screen.getByText('Total Interactions')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Stages')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
  });
}); 