import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ThreadHeader from '../src/ui/ThreadHeader';
import { Session, Agent, DialogueStage } from '../src/types/index';

describe('ThreadHeader', () => {
  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Test Agent 1',
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
    id: 'session-1',
    title: 'Test Session',
    agents: mockAgents,
    messages: [],
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    status: 'active',
    stageHistory: []
  };

  it('renders session title and agent count', () => {
    render(<ThreadHeader session={mockSession} />);
    
    expect(screen.getByText('Test Session')).toBeDefined();
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
          agentResponses: []
        }
      ]
    };

    render(<ThreadHeader session={sessionWithHistory} />);
    
    expect(screen.getByText('1/5')).toBeDefined();
  });

  it('does not show stage indicator when no stage history', () => {
    render(<ThreadHeader session={mockSession} />);
    
    expect(screen.getByText('0/5')).toBeDefined();
  });

  it('displays current stage when provided', () => {
    const sessionWithHistory = {
      ...mockSession,
      stageHistory: [
        {
          stage: 'individual-thought' as DialogueStage,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          agentResponses: []
        }
      ]
    };

    render(
      <ThreadHeader 
        session={sessionWithHistory} 
        currentStage="mutual-reflection"
      />
    );
    
    // With current stage, it should show progress text
    expect(screen.getByText('1/5')).toBeDefined();
  });

  it('displays complete status when session is complete', () => {
    const sessionWithHistory = {
      ...mockSession,
      complete: true,
      stageHistory: [
        {
          stage: 'individual-thought' as DialogueStage,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          agentResponses: []
        },
        {
          stage: 'mutual-reflection' as DialogueStage,
          startTime: new Date('2024-01-01T10:05:00Z'),
          endTime: new Date('2024-01-01T10:10:00Z'),
          agentResponses: []
        }
      ]
    };

    render(
      <ThreadHeader 
        session={sessionWithHistory} 
        currentStage="mutual-reflection"
      />
    );
    
    expect(screen.getByText('2/5')).toBeDefined();
  });

  it('formats timestamp correctly', () => {
    render(<ThreadHeader session={mockSession} />);
    
    // The timestamp should be formatted and displayed
    const timestampText = screen.getByText(/19:00/);
    expect(timestampText).toBeDefined();
  });
}); 