import React from 'react';
import { DialogueStage, StageHistory } from '../types/index';

interface StageIndicatorProps {
  currentStage?: DialogueStage | null;
  complete?: boolean;
  stageHistory?: StageHistory[];
}

const StageIndicator: React.FC<StageIndicatorProps> = ({
  currentStage,
  complete = false,
  stageHistory = [],
}) => {
  // Main stages for UI display (summary stages are hidden)
  const stages: DialogueStage[] = [
    'individual-thought',
    'mutual-reflection',
    'conflict-resolution',
    'synthesis-attempt',
    'output-generation',
    'finalize'
  ];

  const getStageInfo = (stage: DialogueStage) => {
    const stageInfo = {
      'individual-thought': { label: 'Individual', icon: '🧠', color: 'blue' },
      'mutual-reflection': { label: 'Reflection', icon: '🔄', color: 'green' },
      'mutual-reflection-summary': { label: 'Summary', icon: '📝', color: 'gray' },
      'conflict-resolution': { label: 'Conflict', icon: '⚖️', color: 'yellow' },
      'conflict-resolution-summary': { label: 'Summary', icon: '📝', color: 'gray' },
      'synthesis-attempt': { label: 'Synthesis', icon: '🔗', color: 'purple' },
      'synthesis-attempt-summary': { label: 'Summary', icon: '📝', color: 'gray' },
      'output-generation': { label: 'Output', icon: '📤', color: 'indigo' },
      'finalize': { label: 'Finalize', icon: '✅', color: 'green' }
    };
    return stageInfo[stage];
  };



  // Refactor: isStageCompleted only checks stageHistory, no call to getStageStatus
  const isStageCompleted = (stage: DialogueStage) => {
    if (stageHistory && stageHistory.length > 0) {
      // If the stage exists in stageHistory and has endTime, it's completed
      const found = stageHistory.find(h => h.stage === stage);
      return !!(found && found.endTime);
    } else {
      return false;
    }
  };

  // Refactor: getStageStatus uses isStageCompleted, but does not call itself or isStageCompleted in a way that causes recursion
  const getStageStatus = (stage: DialogueStage) => {
    if (isStageCompleted(stage)) return 'completed';
    if (currentStage === stage) return 'current';
    if (currentStage && stages.indexOf(stage) < stages.indexOf(currentStage)) return 'completed';
    if (complete) return 'completed';
    return 'pending';
  };

  const getColorClasses = (status: string, color: string) => {
    const colorMap = {
      blue: {
        completed: 'bg-blue-600',
        current: 'bg-blue-500 animate-pulse',
        pending: 'bg-gray-600'
      },
      green: {
        completed: 'bg-green-600',
        current: 'bg-green-500 animate-pulse',
        pending: 'bg-gray-600'
      },
      yellow: {
        completed: 'bg-yellow-600',
        current: 'bg-yellow-500 animate-pulse',
        pending: 'bg-gray-600'
      },
      purple: {
        completed: 'bg-purple-600',
        current: 'bg-purple-500 animate-pulse',
        pending: 'bg-gray-600'
      },
      indigo: {
        completed: 'bg-indigo-600',
        current: 'bg-indigo-500 animate-pulse',
        pending: 'bg-gray-600'
      }
    };
    return colorMap[color as keyof typeof colorMap][status as keyof typeof colorMap.blue];
  };

  const getCompletedStagesCount = () => {
    if (stageHistory && stageHistory.length > 0) {
      // Count stages in stageHistory that have endTime (completed)
      return stageHistory.filter(h => h.endTime).length;
    } else if (currentStage) {
      return stages.indexOf(currentStage) + 1;
    } else {
      return 0;
    }
  };

  const getTotalStagesCount = () => {
    // Always return the total number of main stages, not the stageHistory length
    return stages.length;
  };

  // Always render the stage indicator, even if stageHistory is empty
  // This prevents the indicator from disappearing during state updates
  return (
    <div className="flex items-center space-x-1 px-2 py-1 min-h-[24px]">
      <span className="text-xs text-gray-400 mr-2">
        {getCompletedStagesCount()}/{getTotalStagesCount()}
      </span>
      {stages.map((stage, index) => {
        const stageInfo = getStageInfo(stage);
        const status = getStageStatus(stage);
        const colorClasses = getColorClasses(status, stageInfo.color);

        return (
          <div key={stage} className="flex items-center">
            <div className={`
              w-4 h-4 rounded-full flex items-center justify-center text-xs
              ${colorClasses}
              ${status === 'completed' ? 'text-white' : 'text-gray-300'}
              transition-all duration-200 ease-in-out
            `}>
              {status === 'completed' ? '✓' : stageInfo.icon}
            </div>
            {index < stages.length - 1 && (
              <div className={`
                w-2 h-0.5 mx-1 transition-colors duration-200 ease-in-out
                ${isStageCompleted(stage) ? 'bg-blue-500' : 'bg-gray-600'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StageIndicator; 