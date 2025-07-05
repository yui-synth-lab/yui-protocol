import React from 'react';
import { Session, DialogueStage } from '../types/index';
import StageIndicator from './StageIndicator';

interface ThreadHeaderProps {
  session: Session;
}

const ThreadHeader: React.FC<ThreadHeaderProps> = ({ session }) => {
  const completedStages = session.stageHistory.filter(h => h.endTime).length;
  const totalStages = 6;
  const currentSequenceNumber = session.sequenceNumber || 1;

  return (
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-xl font-bold text-white">{session.title}</h2>
            <p className="text-sm text-gray-400">
              {session.agents.length} agents • {completedStages}/{totalStages} stages completed
              {currentSequenceNumber > 1 && ` • Sequence ${currentSequenceNumber}`}
            </p>
          </div>
        </div>
        
        <StageIndicator 
          stageHistory={session.stageHistory} 
          currentStage={session.currentStage}
          complete={session.complete}
          sequenceNumber={session.sequenceNumber}
        />
      </div>
    </div>
  );
};

export default ThreadHeader; 