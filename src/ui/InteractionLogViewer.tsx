import React, { useState, useEffect } from 'react';
import { SimplifiedInteractionLog, SessionInteractionSummary, DialogueStage } from '../types/index.js';

interface InteractionLogViewerProps {
  sessionId?: string;
  agentId?: string;
  stage?: DialogueStage;
}

const InteractionLogViewer: React.FC<InteractionLogViewerProps> = ({ sessionId, agentId, stage }) => {
  const [logs, setLogs] = useState<SimplifiedInteractionLog[]>([]);
  const [summaries, setSummaries] = useState<SessionInteractionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'logs' | 'summaries'>('logs');
  const [selectedLog, setSelectedLog] = useState<SimplifiedInteractionLog | null>(null);

  useEffect(() => {
    if (viewMode === 'logs') {
      loadLogs();
    } else {
      loadSummaries();
    }
  }, [sessionId, agentId, stage, viewMode]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let url = '';
      if (sessionId) {
        url = `/api/logs/sessions/${sessionId}`;
      } else if (agentId) {
        url = `/api/logs/agents/${agentId}`;
      } else if (stage) {
        url = `/api/logs/stages/${stage}`;
      } else {
        setLogs([]);
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logs/summaries');
      if (response.ok) {
        const data = await response.json();
        setSummaries(data);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: number): string => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'timeout': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStageColor = (stage: DialogueStage): string => {
    switch (stage) {
      case 'individual-thought': return 'bg-blue-100 text-blue-800';
      case 'mutual-reflection': return 'bg-purple-100 text-purple-800';
      case 'conflict-resolution': return 'bg-red-100 text-red-800';
      case 'synthesis-attempt': return 'bg-green-100 text-green-800';
      case 'output-generation': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-900">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100">
          {sessionId ? `Session ${sessionId} Logs` :
           agentId ? `Agent ${agentId} Logs` :
           stage ? `Stage ${stage} Logs` :
           'Interaction Logs'}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('logs')}
            className={`px-4 py-2 ${viewMode === 'logs' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-300'}`}
          >
            Detailed Logs
          </button>
          <button
            onClick={() => setViewMode('summaries')}
            className={`px-4 py-2 ${viewMode === 'summaries' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-300'}`}
          >
            Summaries
          </button>
        </div>
      </div>

      {viewMode === 'logs' ? (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No logs found</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border border-gray-700 p-4 hover:bg-gray-800 cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-100">{log.agentName}</span>
                    <span className={`px-2 py-1 text-xs ${getStageColor(log.stage)}`}>
                      {log.stage}
                    </span>
                    <span className={`text-sm ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Input:</span>
                    <p className="text-gray-400 mt-1">{log.prompt.substring(0, 100)}...</p>
                  </div>
                  <div>
                    <span className="font-medium">Output:</span>
                    <p className="text-gray-400 mt-1">{log.output.substring(0, 100)}...</p>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <p className="text-gray-400 mt-1">{formatDuration(log.duration)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  className="mt-2 text-blue-400 hover:text-blue-200 text-sm"
                >
                  {selectedLog?.id === log.id ? 'Hide Details' : 'Show Details'}
                </button>
                {selectedLog?.id === log.id && (
                  <div className="mt-4 p-4 bg-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2 text-gray-200">Input Details</h4>
                        <div className="text-sm space-y-2">
                          <p><strong>Prompt:</strong> <span className="text-gray-100">{log.prompt}</span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-gray-200">Output Details</h4>
                        <div className="text-sm space-y-2">
                          <p><strong>Content:</strong> <span className="text-gray-100">{log.output}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No summaries found</p>
          ) : (
            summaries.map((summary) => (
              <div key={summary.sessionId} className="border border-gray-700 p-4 bg-gray-800">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">{summary.title}</h3>
                    <p className="text-sm text-gray-500">Session ID: {summary.sessionId}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(summary.createdAt)}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{summary.totalInteractions}</div>
                    <div className="text-sm text-gray-400">Total Interactions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{summary.agents.length}</div>
                    <div className="text-sm text-gray-400">Agents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{summary.stages.length}</div>
                    <div className="text-sm text-gray-400">Stages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">{summary.language}</div>
                    <div className="text-sm text-gray-400">Language</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-200">Agent Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {summary.agents.map((agent) => (
                      <div key={agent.agentId} className="bg-gray-900 p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-100">{agent.agentName}</span>
                          <span className="text-sm text-gray-500">{agent.interactions} times</span>
                        </div>
                        <div className="text-sm text-gray-400">
                          Avg Confidence: {(agent.averageConfidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InteractionLogViewer; 