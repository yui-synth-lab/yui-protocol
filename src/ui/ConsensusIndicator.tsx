import React, { useState } from 'react';

import { AgentConsensusData } from '../types/index.js';

interface ConsensusIndicatorProps {
  consensusData?: AgentConsensusData[];
  overallConsensus: number;
  isExpanded?: boolean;
}

const ConsensusIndicator: React.FC<ConsensusIndicatorProps> = ({
  consensusData = [],
  overallConsensus,
  isExpanded = false
}) => {
  const [expanded, setExpanded] = useState(isExpanded);

  const getConsensusColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConsensusBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (consensusData.length === 0) {
    return (
      <div className="text-xs text-purple-300">
        Consensus: {overallConsensus.toFixed(1)}/10
      </div>
    );
  }

  return (
    <div className="border border-purple-600 rounded-lg bg-purple-900/50 p-3 text-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-200 font-medium">Consensus Status</span>
          <span className={`font-bold ${getConsensusColor(overallConsensus)}`}>
            {overallConsensus.toFixed(1)}/10
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getConsensusBarColor(overallConsensus)}`}
              style={{ width: `${(overallConsensus / 10) * 100}%` }}
            />
          </div>
          <span className="text-purple-400 text-xs">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {consensusData.map((agent, index) => (
            <div key={`${agent.agentId}-${index}`} className="bg-gray-800/50 rounded p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-200 font-medium">{agent.agentName}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getConsensusColor(agent.satisfaction)}`}>
                    {agent.satisfaction}/10
                  </span>
                  <div className="flex gap-1">
                    {agent.additionalPoints && (
                      <span className="px-1 py-0.5 bg-blue-600 text-white text-xs rounded">
                        +Points
                      </span>
                    )}
                    {agent.readyToMove ? (
                      <span className="px-1 py-0.5 bg-green-600 text-white text-xs rounded">
                        Ready
                      </span>
                    ) : (
                      <span className="px-1 py-0.5 bg-yellow-600 text-white text-xs rounded">
                        Not Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              {agent.reasoning && (
                <div className="text-xs text-gray-300 mb-2">
                  <span className="text-purple-400">Reasoning:</span> {agent.reasoning}
                </div>
              )}

              {/* Questions */}
              {agent.questions.length > 0 && (
                <div className="text-xs">
                  <span className="text-purple-400">Questions:</span>
                  <ul className="mt-1 space-y-1">
                    {agent.questions.map((question, qIndex) => (
                      <li key={qIndex} className="text-gray-300 pl-2 border-l-2 border-purple-500">
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* Summary Stats */}
          <div className="pt-2 border-t border-purple-700">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="text-center">
                <div className="text-purple-400">Ready</div>
                <div className="text-white font-bold">
                  {consensusData.filter(a => a.readyToMove).length}/{consensusData.length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-purple-400">Avg Satisfaction</div>
                <div className={`font-bold ${getConsensusColor(consensusData.reduce((sum, a) => sum + a.satisfaction, 0) / consensusData.length)}`}>
                  {(consensusData.reduce((sum, a) => sum + a.satisfaction, 0) / consensusData.length).toFixed(1)}/10
                </div>
              </div>
              <div className="text-center">
                <div className="text-purple-400">Questions</div>
                <div className="text-white font-bold">
                  {consensusData.reduce((sum, a) => sum + a.questions.length, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsensusIndicator;