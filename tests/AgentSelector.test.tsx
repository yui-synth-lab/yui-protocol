import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentSelector from '../src/ui/AgentSelector';
import { Agent } from '../src/types';

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Test Agent 1',
    furigana: 'テストエージェント1',
    style: 'logical',
    priority: 'precision',
    memoryScope: 'local',
    personality: 'A logical and precise agent that focuses on accuracy and detail.',
    preferences: ['accuracy', 'detail'],
    tone: 'professional',
    communicationStyle: 'formal',
    avatar: '🧠'
  },
  {
    id: '2',
    name: 'Test Agent 2',
    furigana: 'テストエージェント2',
    style: 'intuitive',
    priority: 'breadth',
    memoryScope: 'session',
    personality: 'An intuitive agent that thinks broadly and creatively.',
    preferences: ['creativity', 'broad-thinking'],
    tone: 'friendly',
    communicationStyle: 'conversational',
    avatar: '🎨'
  }
];

const mockAvailableAgents: Agent[] = [
  ...mockAgents,
  {
    id: '3',
    name: 'Test Agent 3',
    furigana: 'テストエージェント3',
    style: 'critical',
    priority: 'depth',
    memoryScope: 'cross-session',
    personality: 'A critical agent that delves deep into analysis.',
    preferences: ['analysis', 'depth'],
    tone: 'direct',
    communicationStyle: 'structured',
    avatar: '⚡'
  }
];

describe('AgentSelector', () => {
  it('renders the component with title', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
  });

  it('displays all provided agents', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
  });

  it('displays agent avatars', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('🧠')).toBeInTheDocument();
    expect(screen.getByText('🎨')).toBeInTheDocument();
  });

  it('displays agent style labels correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
  });

  it('displays agent priority labels correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
  });

  it('displays agent memory scope labels correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
  });

  it('displays truncated personality text', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText(/A logical and precise agent that focuses on accuracy and det/)).toBeInTheDocument();
  });

  it('shows "No agents selected" message when agents array is empty', () => {
    render(<AgentSelector agents={[]} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('No agents selected for this session.')).toBeInTheDocument();
  });

  it('displays protocol information section', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Yui Protocol Agent Types')).toBeInTheDocument();
    expect(screen.getByText(/Styles:/)).toBeInTheDocument();
    expect(screen.getByText(/Priorities:/)).toBeInTheDocument();
    expect(screen.getByText(/Memory:/)).toBeInTheDocument();
  });

  it('displays all style types in the protocol information', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText(/Logical, Critical, Intuitive, Meta, Emotive, Analytical/)).toBeInTheDocument();
  });

  it('displays all priority types in the protocol information', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText(/Precision, Breadth, Depth, Balance/)).toBeInTheDocument();
  });

  it('displays all memory types in the protocol information', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText(/Local, Session, Cross-Session/)).toBeInTheDocument();
  });
}); 