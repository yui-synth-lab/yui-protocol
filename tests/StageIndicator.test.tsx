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

  it('renders stage progress correctly', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    expect(screen.getByText('2/5 stages completed')).toBeInTheDocument();
  });

  it('shows completed stages with checkmark', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Check for checkmarks in completed stages
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
  });

  it('shows current stage with animation', () => {
    render(
      <StageIndicator 
        stageHistory={mockStageHistory} 
        currentStage="conflict-resolution"
      />
    );
    
    // The current stage should have the stage icon, not a checkmark
    expect(screen.getByText('⚖️')).toBeInTheDocument();
  });

  it('shows pending stages with stage icons', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Should show all 5 stages
    // Completed stages show checkmarks, pending stages show icons
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);
    expect(screen.getByText('⚖️')).toBeInTheDocument(); // conflict-resolution (pending)
    expect(screen.getByText('🔗')).toBeInTheDocument(); // synthesis-attempt (pending)
    expect(screen.getByText('📤')).toBeInTheDocument(); // output-generation (pending)
  });

  it('handles empty stage history', () => {
    render(<StageIndicator stageHistory={[]} />);
    
    expect(screen.getByText('0/5 stages completed')).toBeInTheDocument();
  });

  it('shows stage labels on larger screens', () => {
    render(<StageIndicator stageHistory={mockStageHistory} />);
    
    // Stage labels should be present (they're hidden on small screens with hidden sm:block)
    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getByText('Mutual')).toBeInTheDocument();
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
}); 