import React, { useState, useEffect } from 'react';
import { Session, Agent } from '../types/index';

interface SessionManagerProps {
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onCreateSession: (title: string, agentIds: string[]) => void;
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

  // Reset to all agents selected when form is shown
  useEffect(() => {
    if (showCreateForm) {
      setSelectedAgentIds(availableAgents.map(agent => agent.id));
    }
  }, [showCreateForm, availableAgents]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim() || selectedAgentIds.length === 0) return;

    console.log('Creating session with:', {
      title: newSessionTitle,
      selectedAgentIds: selectedAgentIds,
      availableAgents: availableAgents.map(a => ({ id: a.id, name: a.name }))
    });

    onCreateSession(newSessionTitle, selectedAgentIds);
    setNewSessionTitle('');
    setSelectedAgentIds(availableAgents.map(agent => agent.id)); // Reset to all agents
    setShowCreateForm(false);
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <div className="bg-gray-900 shadow-sm p-4 flex flex-col">
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
              Select Agents
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {availableAgents.map((agent) => (
                <label key={agent.id} className="flex items-center p-2 hover:bg-gray-800 rounded">
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.includes(agent.id)}
                    onChange={() => toggleAgentSelection(agent.id)}
                    className="mr-3 accent-blue-800 w-4 h-4"
                  />
                  <span className="text-sm text-gray-100">
                    {agent.avatar} {agent.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!newSessionTitle.trim() || selectedAgentIds.length === 0}
            className="w-full bg-blue-800 text-white py-2 text-sm hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            Create Session
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No sessions yet.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
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
                      {session.agents.length} agents • {session.messages.length} messages
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionManager; 