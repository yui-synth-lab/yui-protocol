import React from 'react';
import { DialogueStage, StageHistory } from '../types/index';

interface StageIndicatorProps {
  stageHistory: StageHistory[];
  currentStage?: DialogueStage | null;
}

const StageIndicator: React.FC<StageIndicatorProps> = ({ stageHistory, currentStage }) => {
  const stages: DialogueStage[] = [
    'individual-thought',
    'mutual-reflection', 
    'conflict-resolution',
    'synthesis-attempt',
    'output-generation'
  ];

  const getStageInfo = (stage: DialogueStage) => {
    const stageInfo = {
      'individual-thought': { label: 'Individual Thought', icon: '🧠', color: 'blue' },
      'mutual-reflection': { label: 'Mutual Reflection', icon: '🔄', color: 'green' },
      'conflict-resolution': { label: 'Conflict Resolution', icon: '⚖️', color: 'yellow' },
      'synthesis-attempt': { label: 'Synthesis Attempt', icon: '🔗', color: 'purple' },
      'output-generation': { label: 'Output Generation', icon: '📤', color: 'indigo' }
    };
    return stageInfo[stage];
  };

  const isStageCompleted = (stage: DialogueStage) => {
    return stageHistory.some(h => h.stage === stage);
  };

  const isCurrentStage = (stage: DialogueStage) => {
    return currentStage === stage;
  };

  const getStageStatus = (stage: DialogueStage) => {
    if (isCurrentStage(stage)) return 'current';
    if (isStageCompleted(stage)) return 'completed';
    return 'pending';
  };

  const getColorClasses = (status: string, color: string) => {
    const colorMap = {
      blue: {
        completed: 'bg-blue-800 border-blue-800',
        current: 'bg-blue-900 border-blue-800 text-blue-200',
        pending: 'bg-gray-800 border-gray-700 text-gray-500'
      },
      green: {
        completed: 'bg-green-800 border-green-800',
        current: 'bg-green-900 border-green-800 text-green-200',
        pending: 'bg-gray-800 border-gray-700 text-gray-500'
      },
      yellow: {
        completed: 'bg-yellow-800 border-yellow-800',
        current: 'bg-yellow-900 border-yellow-800 text-yellow-200',
        pending: 'bg-gray-800 border-gray-700 text-gray-500'
      },
      purple: {
        completed: 'bg-purple-800 border-purple-800',
        current: 'bg-purple-900 border-purple-800 text-purple-200',
        pending: 'bg-gray-800 border-gray-700 text-gray-500'
      },
      indigo: {
        completed: 'bg-indigo-800 border-indigo-800',
        current: 'bg-indigo-900 border-indigo-800 text-indigo-200',
        pending: 'bg-gray-800 border-gray-700 text-gray-500'
      }
    };
    return colorMap[color as keyof typeof colorMap][status as keyof typeof colorMap.blue];
  };

  return (
    <div className="text-right">
      <p className="text-sm text-gray-600 mb-2">
        {stageHistory.length}/5 stages completed
      </p>
      <div className="flex items-center space-x-2">
        {stages.map((stage, index) => {
          const stageInfo = getStageInfo(stage);
          const status = getStageStatus(stage);
          const colorClasses = getColorClasses(status, stageInfo.color);
          
          return (
            <div key={stage} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 border-2 flex items-center justify-center text-sm font-medium
                  ${colorClasses}
                  ${status === 'current' ? 'animate-pulse' : ''}
                `}>
                  {status === 'completed' ? '✓' : stageInfo.icon}
                </div>
                <span className="text-xs text-gray-500 mt-1 hidden sm:block">
                  {stageInfo.label.split(' ')[0]}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className={`
                  w-4 h-0.5 mx-1
                  ${isStageCompleted(stage) ? 'bg-blue-500' : 'bg-gray-300'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StageIndicator; 