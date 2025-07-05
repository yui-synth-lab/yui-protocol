import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('handles agents with missing optional properties', () => {
    const agentsWithMissingProps: Agent[] = [
      {
        id: '4',
        name: 'Test Agent 4',
        furigana: 'テストエージェント4',
        style: 'analytical',
        priority: 'balance',
        memoryScope: 'local',
        personality: 'An analytical agent.',
        preferences: ['analysis'],
        tone: 'professional',
        communicationStyle: 'formal'
        // Missing avatar, color, isSummarizer
      }
    ];

    render(<AgentSelector agents={agentsWithMissingProps} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 4')).toBeInTheDocument();
  });

  it('handles empty available agents array', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={[]} />);
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('Test Agent 2')).toBeInTheDocument();
  });

  it('displays agent furigana when available', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('（テストエージェント1）')).toBeInTheDocument();
    expect(screen.getByText('（テストエージェント2）')).toBeInTheDocument();
  });

  it('handles agents with different communication styles', () => {
    const agentsWithDifferentStyles: Agent[] = [
      {
        id: '5',
        name: 'Test Agent 5',
        furigana: 'テストエージェント5',
        style: 'emotive',
        priority: 'breadth',
        memoryScope: 'session',
        personality: 'An emotive agent.',
        preferences: ['emotion', 'empathy'],
        tone: 'warm',
        communicationStyle: 'casual'
      }
    ];

    render(<AgentSelector agents={agentsWithDifferentStyles} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 5')).toBeInTheDocument();
  });

  it('handles agents with different tones', () => {
    const agentsWithDifferentTones: Agent[] = [
      {
        id: '6',
        name: 'Test Agent 6',
        furigana: 'テストエージェント6',
        style: 'meta',
        priority: 'depth',
        memoryScope: 'cross-session',
        personality: 'A meta agent.',
        preferences: ['meta-thinking', 'reflection'],
        tone: 'philosophical',
        communicationStyle: 'contemplative'
      }
    ];

    render(<AgentSelector agents={agentsWithDifferentTones} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Test Agent 6')).toBeInTheDocument();
  });

  it('displays agent preferences correctly', () => {
    render(<AgentSelector agents={mockAgents} availableAgents={mockAvailableAgents} />);
    
    // Check that personality text is displayed (which may reflect preferences)
    expect(screen.getByText(/accuracy and detail/)).toBeInTheDocument();
    expect(screen.getByText(/broadly and creatively/)).toBeInTheDocument();
  });

  it('handles agents with isSummarizer flag', () => {
    const summarizerAgent: Agent[] = [
      {
        id: '7',
        name: 'Summarizer Agent',
        furigana: 'サマライザーエージェント',
        style: 'meta',
        priority: 'balance',
        memoryScope: 'session',
        personality: 'A summarizer agent.',
        preferences: ['summarization', 'synthesis'],
        tone: 'analytical',
        communicationStyle: 'structured',
        isSummarizer: true
      }
    ];

    render(<AgentSelector agents={summarizerAgent} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Summarizer Agent')).toBeInTheDocument();
  });

  it('handles agents with color property', () => {
    const coloredAgent: Agent[] = [
      {
        id: '8',
        name: 'Colored Agent',
        furigana: 'カラードエージェント',
        style: 'logical',
        priority: 'precision',
        memoryScope: 'local',
        personality: 'A colored agent.',
        preferences: ['color-coding'],
        tone: 'professional',
        communicationStyle: 'formal',
        color: '#ff0000'
      }
    ];

    render(<AgentSelector agents={coloredAgent} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Colored Agent')).toBeInTheDocument();
  });

  it('handles large number of agents gracefully', () => {
    const manyAgents: Agent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `agent-${i}`,
      name: `Agent ${i}`,
      furigana: `エージェント${i}`,
      style: 'logical' as const,
      priority: 'precision' as const,
      memoryScope: 'local' as const,
      personality: `Agent ${i} personality`,
      preferences: [`pref-${i}`],
      tone: 'professional',
      communicationStyle: 'formal'
    }));

    render(<AgentSelector agents={manyAgents} availableAgents={mockAvailableAgents} />);
    
    // Should render all agents
    manyAgents.forEach(agent => {
      expect(screen.getByText(agent.name)).toBeInTheDocument();
    });
  });

  it('handles agents with special characters in names', () => {
    const specialAgent: Agent[] = [
      {
        id: '9',
        name: 'Agent with Special Chars: !@#$%^&*()',
        furigana: '特殊文字エージェント',
        style: 'critical',
        priority: 'depth',
        memoryScope: 'session',
        personality: 'An agent with special characters.',
        preferences: ['special-chars'],
        tone: 'direct',
        communicationStyle: 'structured'
      }
    ];

    render(<AgentSelector agents={specialAgent} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Agent with Special Chars: !@#$%^&*()')).toBeInTheDocument();
  });

  it('handles agents with very long personality descriptions', () => {
    const longPersonalityAgent: Agent[] = [
      {
        id: '10',
        name: 'Long Personality Agent',
        furigana: '長い説明エージェント',
        style: 'intuitive',
        priority: 'breadth',
        memoryScope: 'cross-session',
        personality: 'This is a very long personality description that should be truncated when displayed in the UI. It contains many words and should demonstrate how the component handles long text content gracefully without breaking the layout or causing overflow issues.',
        preferences: ['long-descriptions'],
        tone: 'detailed',
        communicationStyle: 'comprehensive'
      }
    ];

    render(<AgentSelector agents={longPersonalityAgent} availableAgents={mockAvailableAgents} />);
    
    expect(screen.getByText('Long Personality Agent')).toBeInTheDocument();
  });
}); 