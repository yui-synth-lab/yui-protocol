import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StageIndicator from '../src/ui/StageIndicator';
import { DialogueStage, StageHistory } from '../src/types/index';

function getProgressText(container, progress) {
  // Use textContent to check for progress string anywhere in the rendered output
  return container.textContent && container.textContent.replace(/\s+/g, '').includes(progress);
}

function getCheckmarkCount(container) {
  // Count all elements with textContent '✓' (checkmark)
  return Array.from(container.querySelectorAll('.w-4.h-4')).filter(el => ((el as HTMLElement).textContent || '').trim() === '✓').length;
}

function getPendingIconCount(container) {
  // Count all elements with .w-4.h-4 that are not checkmarks
  return Array.from(container.querySelectorAll('.w-4.h-4')).filter(el => ((el as HTMLElement).textContent || '').trim() !== '✓').length;
}

function getIconCount(container) {
  // Only count stage icons (w-4 h-4)
  return container.querySelectorAll('.w-4.h-4').length;
}

describe('StageIndicator', () => {
  // Two completed stages for most tests
  const mockStageHistory: StageHistory[] = [
    {
      stage: 'individual-thought',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'mutual-reflection',
      startTime: new Date('2024-01-01T10:05:00Z'),
      endTime: new Date('2024-01-01T10:10:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    }
  ];
  // All completed stages for the 'all stages finished' test
  const allStagesCompleteHistory: StageHistory[] = [
    {
      stage: 'individual-thought',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'mutual-reflection',
      startTime: new Date('2024-01-01T10:05:00Z'),
      endTime: new Date('2024-01-01T10:10:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'conflict-resolution',
      startTime: new Date('2024-01-01T10:10:00Z'),
      endTime: new Date('2024-01-01T10:15:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'synthesis-attempt',
      startTime: new Date('2024-01-01T10:15:00Z'),
      endTime: new Date('2024-01-01T10:20:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'output-generation',
      startTime: new Date('2024-01-01T10:20:00Z'),
      endTime: new Date('2024-01-01T10:25:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'finalize',
      startTime: new Date('2024-01-01T10:25:00Z'),
      endTime: new Date('2024-01-01T10:30:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    }
  ];

  const mockInProgressHistory: StageHistory[] = [
    {
      stage: 'individual-thought',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:05:00Z'),
      agentResponses: [],
      sequenceNumber: 1
    },
    {
      stage: 'mutual-reflection',
      startTime: new Date('2024-01-01T10:05:00Z'),
      // No endTime means stage is in progress
      agentResponses: [],
      sequenceNumber: 1
    }
  ];

  it('renders stage progress correctly', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} />);
    expect(getProgressText(container, '2/6')).toBe(true);
  });

  it('shows completed stages with checkmark', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} currentStage="mutual-reflection" />);
    expect(getCheckmarkCount(container)).toBe(2);
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
    expect(screen.getByText('⚖️')).toBeInTheDocument();
  });

  it('shows completed stages without animation when complete', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} complete={true} currentStage="mutual-reflection" />);
    // When complete=true, all stages should be checkmarks
    expect(getCheckmarkCount(container)).toBe(6);
  });

  it('shows in-progress stage with animation', () => {
    const { container } = render(
      <StageIndicator 
        stageHistory={mockInProgressHistory} 
        currentStage="mutual-reflection"
      />
    );
    expect(getProgressText(container, '1/6')).toBe(true);
  });

  it('shows pending stages with stage icons', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} currentStage="mutual-reflection" />);
    
    // Should show all 5 stages
    // Completed stages show checkmarks, pending stages show icons
    expect(getCheckmarkCount(container)).toBe(2);
    // Icon presence is now checked by iconCount
  });

  it('handles empty stage history', () => {
    const { container } = render(<StageIndicator stageHistory={[]} />);
    expect(getProgressText(container, '0/6')).toBe(true);
  });

  it('shows correct number of checkmarks for completed stages', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} currentStage="mutual-reflection" />);
    expect(getCheckmarkCount(container)).toBe(2);
  });

  it('shows correct number of stage icons for pending stages', () => {
    const { container } = render(<StageIndicator stageHistory={mockStageHistory} currentStage="mutual-reflection" />);
    // There are 6 stages, 2 completed, so 4 pending icons (not checkmarks)
    const iconCount = getPendingIconCount(container);
    expect(iconCount).toBe(4);
  });

  it('handles complete session with all stages finished', () => {
    const { container } = render(
      <StageIndicator 
        stageHistory={allStagesCompleteHistory} 
        complete={true}
      />
    );
    // When complete=true, all stages should be checkmarks and progress should be 6/6
    expect(getProgressText(container, '6/6')).toBe(true);
    expect(getCheckmarkCount(container)).toBe(6);
  });
}); 