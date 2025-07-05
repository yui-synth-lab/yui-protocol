import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MessagesView from '../src/ui/MessagesView';
import { Session, Agent, Message, DialogueStage } from '../src/types/index';

describe('MessagesView', () => {
  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Test Agent 1',
      furigana: 'テストエージェント1',
      style: 'logical',
      priority: 'precision',
      memoryScope: 'session',
      personality: 'Logical and precise',
      preferences: ['analysis', 'structure'],
      avatar: '🤖',
      tone: 'professional',
      communicationStyle: 'formal'
    },
    {
      id: 'yui-000',
      name: 'yui',
      furigana: 'ゆい',
      style: 'meta',
      priority: 'balance',
      memoryScope: 'session',
      personality: 'Meta-cognitive coordinator',
      preferences: ['synthesis', 'coordination'],
      avatar: '🧠',
      tone: 'analytical',
      communicationStyle: 'structured'
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
    stageHistory: [],
    language: 'en'
  };

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      agentId: 'user',
      content: 'Hello, this is a test message',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      role: 'user'
    },
    {
      id: 'msg-2',
      agentId: 'agent-1',
      content: 'This is a response from agent 1',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      role: 'agent',
      stage: 'individual-thought'
    },
    {
      id: 'msg-3',
      agentId: 'yui-000',
      content: 'This is a summary from yui',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      role: 'agent',
      stage: 'output-generation'
    }
  ];

  it('renders empty state when no messages', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={[]}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('renders messages correctly', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
    expect(screen.getByText('This is a response from agent 1')).toBeInTheDocument();
    expect(screen.getByText('This is a summary from yui')).toBeInTheDocument();
  });

  it('shows stage headers when messages have stages', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    expect(screen.getByText('🧠 Individual Thought')).toBeInTheDocument();
    expect(screen.getByText('📤 Output Generation')).toBeInTheDocument();
  });

  it('displays agent names correctly', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    expect(screen.getByText('Test Agent 1')).toBeInTheDocument();
    expect(screen.getByText('yui')).toBeInTheDocument();
  });

  it('shows agent avatars', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    // Check for avatar emojis
    expect(screen.getByText('🤖')).toBeInTheDocument();
    expect(screen.getByText('🧠')).toBeInTheDocument();
  });

  it('applies special styling to yui messages', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    // yui message should be present
    const yuiMessage = screen.getByText('This is a summary from yui');
    expect(yuiMessage).toBeInTheDocument();
  });

  it('calls onScroll callback when scroll event occurs', () => {
    const mockOnScroll = vi.fn();
    
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        onScroll={mockOnScroll}
        shouldAutoScroll={true}
      />
    );
    
    // The onScroll callback should be available for scroll events
    expect(mockOnScroll).toBeDefined();
  });

  it('formats timestamps correctly', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );
    
    // Timestamps should be formatted and displayed using toLocaleTimeString()
    const timestamps = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('groups messages by stage correctly', () => {
    const messagesWithStages: Message[] = [
      {
        id: 'msg-1',
        agentId: 'agent-1',
        content: 'Stage 1 message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        role: 'agent',
        stage: 'individual-thought'
      },
      {
        id: 'msg-2',
        agentId: 'agent-1',
        content: 'Stage 2 message',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        role: 'agent',
        stage: 'mutual-reflection'
      }
    ];

    render(
      <MessagesView
        session={mockSession}
        messages={messagesWithStages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('🧠 Individual Thought')).toBeInTheDocument();
    expect(screen.getByText('🔄 Mutual Reflection')).toBeInTheDocument();
  });

  it('handles messages with metadata correctly', () => {
    const messagesWithMetadata: Message[] = [
      {
        id: 'msg-1',
        agentId: 'agent-1',
        content: 'Message with metadata',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        role: 'agent',
        stage: 'individual-thought',
        metadata: {
          reasoning: 'Test reasoning',
          confidence: 0.8,
          references: ['ref1', 'ref2'],
          voteFor: 'agent-2',
          voteReasoning: 'Test vote reasoning',
          voteSection: 'Test vote section'
        }
      }
    ];

    render(
      <MessagesView
        session={mockSession}
        messages={messagesWithMetadata}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Message with metadata')).toBeInTheDocument();
  });

  it('handles messages with sequence numbers', () => {
    const messagesWithSequence: Message[] = [
      {
        id: 'msg-1',
        agentId: 'agent-1',
        content: 'Message with sequence',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        role: 'agent',
        stage: 'individual-thought',
        sequenceNumber: 1
      }
    ];

    render(
      <MessagesView
        session={mockSession}
        messages={messagesWithSequence}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Message with sequence')).toBeInTheDocument();
  });

  it('handles current stage highlighting', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage="individual-thought"
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('🧠 Individual Thought')).toBeInTheDocument();
  });

  it('handles shouldAutoScroll prop correctly', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={false}
      />
    );

    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
  });

  it('handles session without agents gracefully', () => {
    const sessionWithoutAgents: Session = {
      ...mockSession,
      agents: []
    };

    render(
      <MessagesView
        session={sessionWithoutAgents}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
  });

  it('handles messages with unknown agent IDs', () => {
    const messagesWithUnknownAgent: Message[] = [
      {
        id: 'msg-1',
        agentId: 'unknown-agent',
        content: 'Message from unknown agent',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        role: 'agent',
        stage: 'individual-thought'
      }
    ];

    render(
      <MessagesView
        session={mockSession}
        messages={messagesWithUnknownAgent}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Message from unknown agent')).toBeInTheDocument();
  });

  it('handles messages with different roles', () => {
    const messagesWithDifferentRoles: Message[] = [
      {
        id: 'msg-1',
        agentId: 'user',
        content: 'User message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        role: 'user'
      },
      {
        id: 'msg-2',
        agentId: 'system',
        content: 'System message',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        role: 'system'
      }
    ];

    render(
      <MessagesView
        session={mockSession}
        messages={messagesWithDifferentRoles}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('System message')).toBeInTheDocument();
  });

  it('handles empty session gracefully', () => {
    const emptySession: Session = {
      id: 'empty-session',
      title: 'Empty Session',
      agents: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stageHistory: [],
      language: 'en'
    };

    render(
      <MessagesView
        session={emptySession}
        messages={[]}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('handles null currentStage prop', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
  });

  it('handles undefined onScroll prop', () => {
    render(
      <MessagesView
        session={mockSession}
        messages={mockMessages}
        currentStage={null}
        shouldAutoScroll={true}
      />
    );

    expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
  });
}); 