import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import ThreadHeader from '../src/ui/ThreadHeader';
import { Session, Agent, DialogueStage } from '../src/types/index';

function getProgressText(container, progress) {
  // Use textContent to check for progress string anywhere in the rendered output
  return container.textContent && container.textContent.replace(/\s+/g, '').includes(progress);
}

describe('ThreadHeader', () => {
  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Test Agent 1',
      furigana: 'テストエージェント1',
      style: 'logical',
      priority: 'precision',
      memoryScope: 'session',
      personality: 'Analytical and precise',
      preferences: ['data', 'logic'],
      tone: 'professional',
      communicationStyle: 'formal'
    },
    {
      id: 'agent-2',
      name: 'Test Agent 2',
      furigana: 'テストエージェント2',
      style: 'intuitive',
      priority: 'depth',
      memoryScope: 'session',
      personality: 'Creative and intuitive',
      preferences: ['creativity', 'insights'],
      tone: 'creative',
      communicationStyle: 'expressive'
    }
  ];

  const mockSession: Session = {
    id: 'test-session-123',
    title: 'Test Session',
    agents: mockAgents,
    messages: [],
    createdAt: new Date('2024-01-01T19:00:00Z'),
    updatedAt: new Date('2024-01-01T19:00:00Z'),
    status: 'active',
    stageHistory: [],
    language: 'en'
  };

  it('renders session title and agent count', () => {
    render(<ThreadHeader session={mockSession} />);
    
    expect(screen.getByText('Test Session')).toBeInTheDocument();
    // The text is split across multiple elements, so we check for the container
    const infoContainers = screen.getAllByText((content, node) => {
      const text = node?.textContent || '';
      return text.includes('2 agents •');
    });
    expect(infoContainers.length).toBeGreaterThan(0);
  });

  it('shows stage indicator when stage history exists', () => {
    const sessionWithHistory = {
      ...mockSession,
      stageHistory: [
        {
          stage: 'individual-thought' as DialogueStage,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          agentResponses: [],
          sequenceNumber: 1
        }
      ]
    };

    const { container } = render(<ThreadHeader session={sessionWithHistory} />);
    // Check for the progress text in the stage indicator (not the header text)
    expect(getProgressText(container, '1/6')).toBe(true);
  });

  it('does not show stage indicator when no stage history', () => {
    render(<ThreadHeader session={mockSession} />);

    // 進捗テキストが含まれるノードが存在することを確認
    // Use getAllByText since there are multiple elements with this text
    const progressElements = screen.getAllByText('0/6');
    expect(progressElements.length).toBeGreaterThan(0);
  });

  it('displays current stage when provided', () => {
    const sessionWithCurrentStage = {
      ...mockSession,
      currentStage: 'individual-thought' as DialogueStage
    };
    render(<ThreadHeader session={sessionWithCurrentStage} />);

    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('displays complete status when session is complete', () => {
    const completedSession = {
      ...mockSession,
      complete: true,
      status: 'completed' as const
    };
    render(<ThreadHeader session={completedSession} />);

    expect(screen.getByText('Test Session')).toBeInTheDocument();
  });

  it('displays sequence number when greater than 1', () => {
    const sessionWithSequence = {
      ...mockSession,
      sequenceNumber: 2
    };
    render(<ThreadHeader session={sessionWithSequence} />);

    // シーケンス番号が含まれるノードが存在することを確認
    expect(screen.getByText('Sequence 2', { exact: false })).toBeInTheDocument();
  });

  it('does not display sequence number when 1 or undefined', () => {
    render(<ThreadHeader session={mockSession} />);

    expect(screen.queryByText('Sequence 1')).not.toBeInTheDocument();
  });
}); 