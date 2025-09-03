import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ThreadView from '../src/ui/ThreadView.js';
import { Session, DialogueStage } from '../src/types/index.js';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

const mockSession: Session = {
  id: 's1',
  title: 'Test Session',
  agents: [
    { id: 'agent1', name: 'Agent 1', furigana: 'エージェント1', style: 'logical', priority: 'precision', memoryScope: 'local', personality: 'Logical', preferences: [], tone: 'Professional', communicationStyle: 'Direct' },
    { id: 'agent2', name: 'Agent 2', furigana: 'エージェント2', style: 'critical', priority: 'depth', memoryScope: 'session', personality: 'Critical', preferences: [], tone: 'Analytical', communicationStyle: 'Detailed' }
  ],
  messages: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  status: 'active',
  stageHistory: [],
  language: 'en',
  sequenceNumber: 1
};

const mockOnSessionUpdate = vi.fn();

describe('ThreadView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSession)
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders session title and agents', () => {
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    expect(screen.getByText('Test Session')).toBeInTheDocument();
    expect(screen.getByText('Agent 1, Agent 2')).toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Initially should show disconnected
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('renders input form', () => {
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    expect(screen.getByPlaceholderText('Enter your prompt... (Enter to send, Shift+Enter for new line)')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('disables input when processing', async () => {
    const user = userEvent.setup();
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    
    const { io } = await import('socket.io-client');
    (io as any).mockReturnValue(mockSocket);
    
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    if (connectCallback) {
      connectCallback();
    }
    
    // Wait for connection to be established
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    const textarea = screen.getByPlaceholderText('Enter your prompt... (Enter to send, Shift+Enter for new line)');
    const sendButton = screen.getByText('Send');
    
    await user.type(textarea, 'Test message');
    await user.click(sendButton);
    
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('prevents submission with empty message', async () => {
    const user = userEvent.setup();
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
    
    await user.click(sendButton);
    // Should not trigger any processing
  });

  it('prevents submission with whitespace-only message', async () => {
    const user = userEvent.setup();
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    const textarea = screen.getByPlaceholderText('Enter your prompt... (Enter to send, Shift+Enter for new line)');
    const sendButton = screen.getByText('Send');
    
    await user.type(textarea, '   ');
    expect(sendButton).toBeDisabled();
  });

  it('submits message via WebSocket when connected', async () => {
    const user = userEvent.setup();
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    
    const { io } = await import('socket.io-client');
    (io as any).mockReturnValue(mockSocket);
    
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    if (connectCallback) {
      connectCallback();
    }
    
    // Wait for connection to be established
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
    
    const textarea = screen.getByPlaceholderText('Enter your prompt... (Enter to send, Shift+Enter for new line)');
    await user.type(textarea, 'Test prompt');
    
    const sendButton = screen.getByText('Send');
    await user.click(sendButton);
    
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('start-session-execution', {
        sessionId: 's1',
        userPrompt: 'Test prompt'
      });
    });
  });

  it('handles WebSocket stage events', async () => {
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    
    const { io } = await import('socket.io-client');
    (io as any).mockReturnValue(mockSocket);
    
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    if (connectCallback) {
      connectCallback();
    }
    
    // Simulate stage start
    const stageStartCallback = mockSocket.on.mock.calls.find(call => call[0] === 'stage-start')?.[1];
    if (stageStartCallback) {
      stageStartCallback({ sessionId: 's1', stage: 'individual-thought', timestamp: new Date().toISOString() });
    }
    
    // Simulate stage progress
    const stageProgressCallback = mockSocket.on.mock.calls.find(call => call[0] === 'stage-progress')?.[1];
    if (stageProgressCallback) {
      const mockMessage = {
        id: 'msg1',
        agentId: 'agent1',
        content: 'Test response',
        timestamp: new Date(),
        role: 'agent' as const,
        stage: 'individual-thought' as DialogueStage
      };
      stageProgressCallback({ sessionId: 's1', stage: 'individual-thought', message: mockMessage, timestamp: new Date().toISOString() });
    }
    
    // Simulate stage complete
    const stageCompleteCallback = mockSocket.on.mock.calls.find(call => call[0] === 'stage-complete')?.[1];
    if (stageCompleteCallback) {
      stageCompleteCallback({ sessionId: 's1', stage: 'individual-thought', result: {}, timestamp: new Date().toISOString() });
    }
  });

  it('shows continue button for incomplete sessions', () => {
    const incompleteSession = {
      ...mockSession,
      messages: [{ id: 'msg1', agentId: 'user', content: 'Test', timestamp: new Date(), role: 'user' as const }],
      stageHistory: [
        {
          stage: 'individual-thought' as DialogueStage,
          startTime: new Date('2024-01-01T10:01:00Z'),
          endTime: new Date('2024-01-01T10:02:00Z'),
          agentResponses: []
        }
      ]
    };
    
    render(<ThreadView session={incompleteSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    expect(screen.getByText('Continue Session')).toBeInTheDocument();
  });

  it('handles continue session button click', async () => {
    const user = userEvent.setup();
    const incompleteSession = {
      ...mockSession,
      messages: [{ id: 'msg1', agentId: 'user', content: 'Test', timestamp: new Date(), role: 'user' as const }],
      stageHistory: [
        {
          stage: 'individual-thought' as DialogueStage,
          startTime: new Date('2024-01-01T10:01:00Z'),
          endTime: new Date('2024-01-01T10:02:00Z'),
          agentResponses: []
        }
      ]
    };
    
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    
    const { io } = await import('socket.io-client');
    (io as any).mockReturnValue(mockSocket);
    
    render(<ThreadView session={incompleteSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    if (connectCallback) {
      connectCallback();
    }
    
    const continueButton = screen.getByText('Continue Session');
    await user.click(continueButton);
    
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('start-session-execution', {
        sessionId: 's1',
        userPrompt: 'Continue from previous session'
      });
    });
  });

  it('handles WebSocket errors gracefully', async () => {
    const mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    
    const { io } = await import('socket.io-client');
    (io as any).mockReturnValue(mockSocket);
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    // Simulate stage error
    const stageErrorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'stage-error')?.[1];
    if (stageErrorCallback) {
      stageErrorCallback({ sessionId: 's1', stage: 'individual-thought', error: 'Test error', timestamp: new Date().toISOString() });
    }
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('updates messages when session changes', async () => {
    const sessionWithMessages = {
      ...mockSession,
      messages: [
        { id: 'msg1', agentId: 'user', content: 'Hello', timestamp: new Date(), role: 'user' as const },
        { id: 'msg2', agentId: 'agent1', content: 'Hi there', timestamp: new Date(), role: 'agent' as const }
      ]
    };
    
    const { rerender } = render(<ThreadView session={mockSession} onSessionUpdate={mockOnSessionUpdate} />);
    
    rerender(<ThreadView session={sessionWithMessages} onSessionUpdate={mockOnSessionUpdate} />);
    
    // メッセージが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
  });
}); 