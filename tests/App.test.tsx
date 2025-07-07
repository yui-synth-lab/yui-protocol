import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/ui/App';

// Mock fetch
global.fetch = vi.fn();

// Mock the components
vi.mock('../src/ui/SessionManager', () => ({
  default: ({ onSessionSelect = () => {} }: any) => (
    <div data-testid="session-manager">
      <button onClick={() => onSessionSelect({ id: 'test-session' })}>Select Session</button>
    </div>
  )
}));

vi.mock('../src/ui/ThreadView', () => ({
  default: ({ sessionId }: any) => (
    <div data-testid="thread-view">
      <span>Session: {sessionId}</span>
    </div>
  )
}));

vi.mock('../src/ui/StageIndicator', () => ({
  default: ({ stage }: any) => (
    <div data-testid="stage-indicator">
      <span>Stage: {stage}</span>
    </div>
  )
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => []
    });
  });

  it('renders main title and process info', async () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Yui Protocol')).toBeInTheDocument();
    });
    expect(screen.getByText('Multi-AI Collaborative Reasoning through Structured Dialogue')).toBeInTheDocument();
    expect(screen.getByText('5-Stage Dialectic Process')).toBeInTheDocument();
  });

  it('renders session manager when no session is selected', async () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('No Session Selected')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument();
  });

  it('renders with correct initial state', async () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('No Session Selected')).toBeInTheDocument();
    });
    
    // Check that thread view is not rendered initially
    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument();
    
    // Check that stage indicator is not rendered initially
    expect(screen.queryByTestId('stage-indicator')).not.toBeInTheDocument();
  });
}); 