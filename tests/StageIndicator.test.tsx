import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StageIndicator from '../src/ui/StageIndicator';
import { DialogueStage, StageHistory } from '../src/types/index';

describe('StageIndicator', () => {
  const mockStageHistory: StageHistory[] = [
    {
      stage: 'individual-thought',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      agentResponses: []
    },
    {
      stage: 'mutual-reflection',
      startTime: new Date('2024-01-01T10:05:00Z'),
      endTime: new Date('2024-01-01T10:10:00Z'),
      agentResponses: []
    }
  ];

  const mockInProgressHistory: StageHistory[] = [
    {
      stage: 'individual-thought',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      agentResponses: []
    },
    {
      stage: 'mutual-reflection',
      startTime: new Date('2024-01-01T10:05:00Z'),
      // No endTime means stage is in progress
      agentResponses: []
    }
  ];

  it('renders stage progress correctly', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Check for the progress text using a function matcher
    expect(screen.getByText((content, element) => {
      return element?.textContent === '2/5';
    })).toBeDefined();
  });

  it('shows completed stages with checkmark', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Check for checkmarks in completed stages
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
  });

  it('shows current stage with animation when not complete', () => {
    render(
      <StageIndicator 
        stageHistory={mockStageHistory} 
        currentStage="conflict-resolution"
        complete={false}
      />
    );
    
    // The current stage should have the stage icon, not a checkmark
    expect(screen.getByText('⚖️')).toBeDefined();
  });

  it('shows completed stages without animation when complete', () => {
    render(
      <StageIndicator 
        stageHistory={mockStageHistory} 
        currentStage="conflict-resolution"
        complete={true}
      />
    );
    
    // When complete, all stages should show checkmarks if they have endTime
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
  });

  it('shows in-progress stage with animation', () => {
    render(
      <StageIndicator 
        stageHistory={mockInProgressHistory} 
        currentStage="mutual-reflection"
      />
    );
    
    // Should show progress text using a function matcher
    expect(screen.getByText((content, element) => {
      return element?.textContent === '1/5';
    })).toBeDefined();
  });

  it('shows pending stages with stage icons', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Should show all 5 stages
    // Completed stages show checkmarks, pending stages show icons
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
    expect(screen.getByText('⚖️')).toBeDefined(); // conflict-resolution (pending)
    expect(screen.getByText('🔗')).toBeDefined(); // synthesis-attempt (pending)
    expect(screen.getByText('📤')).toBeDefined(); // output-generation (pending)
  });

  it('handles empty stage history', () => {
    render(<StageIndicator stageHistory={[]} />);
    
    // Check for the progress text using a function matcher
    expect(screen.getByText((content, element) => {
      return element?.textContent === '0/5';
    })).toBeDefined();
  });

  it('shows correct number of checkmarks for completed stages', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Should have exactly 2 checkmarks for 2 completed stages
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
  });

  it('shows correct number of stage icons for pending stages', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Should have 3 stage icons for 3 pending stages
    const stageIcons = screen.getAllByText(/[⚖️🔗📤]/);
    expect(stageIcons).toHaveLength(3);
  });

  it('handles complete session with all stages finished', () => {
    const completeHistory: StageHistory[] = [
      {
        stage: 'individual-thought',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:05:00Z'),
        agentResponses: []
      },
      {
        stage: 'mutual-reflection',
        startTime: new Date('2024-01-01T10:05:00Z'),
        endTime: new Date('2024-01-01T10:10:00Z'),
        agentResponses: []
      },
      {
        stage: 'conflict-resolution',
        startTime: new Date('2024-01-01T10:10:00Z'),
        endTime: new Date('2024-01-01T10:15:00Z'),
        agentResponses: []
      },
      {
        stage: 'synthesis-attempt',
        startTime: new Date('2024-01-01T10:15:00Z'),
        endTime: new Date('2024-01-01T10:20:00Z'),
        agentResponses: []
      },
      {
        stage: 'output-generation',
        startTime: new Date('2024-01-01T10:20:00Z'),
        endTime: new Date('2024-01-01T10:25:00Z'),
        agentResponses: []
      }
    ];

    render(
      <StageIndicator 
        stageHistory={completeHistory} 
        complete={true}
      />
    );
    
    // Check for the progress text using a function matcher
    expect(screen.getByText((content, element) => {
      return element?.textContent === '5/5';
    })).toBeDefined();
    
    // All stages should show checkmarks
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(5);
  });
}); 