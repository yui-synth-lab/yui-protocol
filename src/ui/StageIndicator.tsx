import React from 'react';
import { DialogueStage, StageHistory } from '../types/index';

interface StageIndicatorProps {
  stageHistory: StageHistory[];
  currentStage?: DialogueStage | null;
  complete?: boolean;
}

const StageIndicator: React.FC<StageIndicatorProps> = ({ stageHistory, currentStage, complete = false }) => {
  const stages: DialogueStage[] = [
    'individual-thought',
    'mutual-reflection', 
    'conflict-resolution',
    'synthesis-attempt',
    'output-generation'
  ];

  const getStageInfo = (stage: DialogueStage) => {
    const stageInfo = {
      'individual-thought': { label: 'Individual', icon: '🧠', color: 'blue' },
      'mutual-reflection': { label: 'Reflection', icon: '🔄', color: 'green' },
      'conflict-resolution': { label: 'Conflict', icon: '⚖️', color: 'yellow' },
      'synthesis-attempt': { label: 'Synthesis', icon: '🔗', color: 'purple' },
      'output-generation': { label: 'Output', icon: '📤', color: 'indigo' }
    };
    return stageInfo[stage];
  };

  const isStageCompleted = (stage: DialogueStage) => {
    return stageHistory.some(h => h.stage === stage && h.endTime);
  };

  const isCurrentStage = (stage: DialogueStage) => {
    return currentStage === stage && !complete;
  };

  const getStageStatus = (stage: DialogueStage) => {
    if (complete && isStageCompleted(stage)) return 'completed';
    if (isCurrentStage(stage)) return 'current';
    if (isStageCompleted(stage)) return 'completed';
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
    return stageHistory.filter(h => h.endTime).length;
  };

  return (
    <div className="flex items-center space-x-1 px-2 py-1">
      <span className="text-xs text-gray-400 mr-2">
        {getCompletedStagesCount()}/5
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
            `}>
              {status === 'completed' ? '✓' : stageInfo.icon}
            </div>
            {index < stages.length - 1 && (
              <div className={`
                w-2 h-0.5 mx-1
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