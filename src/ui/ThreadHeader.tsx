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
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">{session.title}</h2>
          <p className="text-sm text-gray-400">
            {session.agents.length} agents • Created {formatTimestamp(session.createdAt)}
          </p>
        </div>
        
        {/* Stage progress indicator */}
        {session.stageHistory.length > 0 && (
          <StageIndicator 
            stageHistory={session.stageHistory} 
            currentStage={currentStage}
          />
        )}
      </div>
    </div>
  );
};

export default ThreadHeader; 