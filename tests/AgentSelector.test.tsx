import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentSelector from '../src/ui/AgentSelector';
import { Agent } from '../src/types';

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Test Agent 1',
    style: 'logical',
    priority: 'precision',
    memoryScope: 'local',
    personality: 'A logical and precise agent that focuses on accuracy and detail.',
    preferences: ['accuracy', 'detail'],
    avatar: '🧠'
  },
  {
    id: '2',
    name: 'Test Agent 2',
    style: 'intuitive',
    priority: 'breadth',
    memoryScope: 'session',
    personality: 'An intuitive agent that thinks broadly and creatively.',
    preferences: ['creativity', 'broad-thinking'],
    avatar: '🎨'
  }
];

const mockAvailableAgents: Agent[] = [
  ...mockAgents,
  {
    id: '3',
    name: 'Test Agent 3',
    style: 'critical',
    priority: 'depth',
    memoryScope: 'cross-session',
    personality: 'A critical agent that delves deep into analysis.',
    preferences: ['analysis', 'depth'],
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
    
    expect(screen.getByText('🧠 Logical')).toBeInTheDocument();
    expect(screen.getByText('🎨 Intuitive')).toBeInTheDocument();
  });

  it('displays agent priority labels correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('🎯 Precision')).toBeInTheDocument();
    expect(screen.getByText('🌐 Breadth')).toBeInTheDocument();
  });

  it('displays agent memory scope labels correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('📝 Local')).toBeInTheDocument();
    expect(screen.getByText('📚 Session')).toBeInTheDocument();
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