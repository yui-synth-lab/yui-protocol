import React from 'react';
import { Session, DialogueStage } from '../types/index';
import StageIndicator from './StageIndicator';

interface ThreadHeaderProps {
  session: Session;
  currentStage?: DialogueStage | null;
}

const ThreadHeader: React.FC<ThreadHeaderProps> = ({ session, currentStage }) => {
  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-gray-900 border-b border-gray-700 px-4 py-2">
      <div className="flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 truncate">{session.title}</h2>
          <p className="text-xs text-gray-400">
            {session.agents.length} agents • {formatTimestamp(session.createdAt)}
          </p>
        </div>
        
        {/* Stage progress indicator - always show */}
        <StageIndicator 
          stageHistory={session.stageHistory || []} 
          currentStage={currentStage}
          complete={session.complete}
        />
      </div>
    </div>
  );
};

export default ThreadHeader; 