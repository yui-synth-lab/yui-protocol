import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionManager from '../src/ui/SessionManager';
import { Session, Agent } from '../src/types';

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Agent 1',
    furigana: 'エージェント1',
    style: 'logical',
    priority: 'precision',
    memoryScope: 'local',
    personality: 'Logical agent',
    preferences: [],
    tone: 'professional',
    communicationStyle: 'formal',
    avatar: '🧠'
  },
  {
    id: '2',
    name: 'Agent 2',
    furigana: 'エージェント2',
    style: 'intuitive',
    priority: 'breadth',
    memoryScope: 'session',
    personality: 'Intuitive agent',
    preferences: [],
    tone: 'creative',
    communicationStyle: 'expressive',
    avatar: '🎨'
  }
];

const mockSessions: Session[] = [
  {
    id: 's1',
    title: 'Session 1',
    agents: [mockAgents[0]],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    stageHistory: [],
    language: 'en'
  },
  {
    id: 's2',
    title: 'Session 2',
    agents: [mockAgents[1]],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'completed',
    stageHistory: [],
    language: 'en'
  }
];

describe('SessionManager', () => {
  it('renders session list and new button', () => {
    render(
      <SessionManager
        sessions={mockSessions}
        currentSession={mockSessions[0]}
        onSelectSession={() => {}}
        onCreateSession={() => {}}
        availableAgents={mockAgents}
      />
    );
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('shows "No sessions yet." when session list is empty', () => {
    render(
      <SessionManager
        sessions={[]}
        currentSession={null}
        onSelectSession={() => {}}
        onCreateSession={() => {}}
        availableAgents={mockAgents}
      />
    );
    expect(screen.getByText('No sessions yet.')).toBeInTheDocument();
  });

  it('shows create session form when New is clicked', () => {
    render(
      <SessionManager
        sessions={mockSessions}
        currentSession={mockSessions[0]}
        onSelectSession={() => {}}
        onCreateSession={() => {}}
        availableAgents={mockAgents}
      />
    );
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByText('Session Title')).toBeInTheDocument();
    expect(screen.getByText('Create Session')).toBeInTheDocument();
  });

  it('calls onCreateSession with correct data', () => {
    const onCreateSession = vi.fn();
    render(
      <SessionManager
        sessions={mockSessions}
        currentSession={mockSessions[0]}
        onSelectSession={() => {}}
        onCreateSession={onCreateSession}
        availableAgents={mockAgents}
      />
    );
    fireEvent.click(screen.getByText('New'));
    fireEvent.change(screen.getByPlaceholderText('Enter session title...'), { target: { value: 'New Session' } });
    fireEvent.click(screen.getByText('Create Session'));
    expect(onCreateSession).toHaveBeenCalledWith('New Session', expect.any(Array), expect.any(String));
  });

  it('calls onSelectSession when a session is clicked', () => {
    const onSelectSession = vi.fn();
    render(
      <SessionManager
        sessions={mockSessions}
        currentSession={mockSessions[0]}
        onSelectSession={onSelectSession}
        onCreateSession={() => {}}
        availableAgents={mockAgents}
      />
    );
    fireEvent.click(screen.getByText('Session 2'));
    expect(onSelectSession).toHaveBeenCalledWith(mockSessions[1]);
  });
}); 