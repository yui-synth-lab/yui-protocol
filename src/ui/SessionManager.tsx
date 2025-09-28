import React, { useState, useEffect } from 'react';
import { Session, Agent } from '../types/index';

interface SessionManagerProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onCreateSession: (title: string, agentIds: string[], language: 'ja' | 'en', version: '1.0' | '2.0') => void;
  availableAgents: Agent[];
}

const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  currentSession,
  onSelectSession,
  onCreateSession,
  availableAgents
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(
    availableAgents.map(agent => agent.id) // Default to all agents selected
  );
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [version, setVersion] = useState<'1.0' | '2.0'>('2.0');

  // Reset to all agents selected when form is shown
  useEffect(() => {
    if (showCreateForm) {
      setSelectedAgentIds(availableAgents.map(agent => agent.id));
    }
  }, [showCreateForm, availableAgents]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;
    onCreateSession(newSessionTitle, availableAgents.map(agent => agent.id), language, version);
    setNewSessionTitle('');
    setShowCreateForm(false);
  };

  return (
    <div className="bg-gray-900 shadow-sm p-4 flex flex-col max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-100">Sessions</h3>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (showCreateForm) {
              // Reset form when closing
              setNewSessionTitle('');
              setSelectedAgentIds(availableAgents.map(agent => agent.id));
            }
          }}
          className="text-xs bg-blue-800 text-white px-3 py-2 hover:bg-blue-900 rounded"
        >
          {showCreateForm ? 'Cancel' : 'New'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateSession} className="mb-3 space-y-3 flex-shrink-0">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Session Title
            </label>
            <input
              type="text"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-700 bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-800 focus:border-transparent rounded"
              placeholder="Enter session title..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as 'ja' | 'en')}
              className="w-full px-3 py-2 text-sm border border-gray-700 bg-gray-800 text-gray-100 focus:ring-2 focus:ring-blue-800 focus:border-transparent rounded"
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Protocol Version
            </label>
            <div className="flex gap-2">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="radio"
                  value="1.0"
                  checked={version === '1.0'}
                  onChange={(e) => setVersion(e.target.value as '1.0')}
                  className="sr-only"
                />
                <div className={`w-full px-3 py-2 text-xs font-medium text-center rounded transition-colors border ${
                  version === '1.0'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}>
                  v1.0
                  <div className="text-xs opacity-75">Fixed Stages</div>
                </div>
              </label>
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="radio"
                  value="2.0"
                  checked={version === '2.0'}
                  onChange={(e) => setVersion(e.target.value as '2.0')}
                  className="sr-only"
                />
                <div className={`w-full px-3 py-2 text-xs font-medium text-center rounded transition-colors border ${
                  version === '2.0'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}>
                  v2.0
                  <div className="text-xs opacity-75">Dynamic</div>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!newSessionTitle.trim()}
            className="w-full bg-blue-800 text-white py-2 text-sm hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            Create Session
          </button>
        </form>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No sessions yet.</p>
          ) : (
            sessions.map((session) => {
              // Ensure we have the correct message count for this session
              // Use defensive programming to prevent cross-session contamination
              const messageCount = session.messages && Array.isArray(session.messages) 
                ? session.messages.length 
                : 0;
              const agentCount = session.agents && Array.isArray(session.agents) 
                ? session.agents.length 
                : 0;
              
              // Create a stable key that doesn't change unless the session actually changes
              const sessionKey = session.id;
              
              return (
                <button
                  key={sessionKey}
                  onClick={() => onSelectSession(session)}
                  className={`w-full text-left p-3 transition-colors rounded ${
                    currentSession?.id === session.id
                      ? 'bg-blue-950 border border-blue-800'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-100 text-sm truncate">{session.title}</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {agentCount} agents • {messageCount} messages
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionManager; 