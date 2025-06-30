import React from 'react';
import { Agent } from '../types/index';

interface AgentSelectorProps {
  agents: Agent[];
  availableAgents: Agent[];
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ agents, availableAgents }) => {
  const getStyleLabel = (style: string) => {
    const styleLabels = {
      'logical': '🧠 Logical',
      'critical': '⚡ Critical',
      'intuitive': '🎨 Intuitive',
      'meta': '🔍 Meta',
      'emotive': '💭 Emotive',
      'analytical': '🔮 Analytical'
    };
    return styleLabels[style as keyof typeof styleLabels] || style;
  };

  const getPriorityLabel = (priority: string) => {
    const priorityLabels = {
      'precision': '🎯 Precision',
      'breadth': '🌐 Breadth',
      'depth': '🔍 Depth',
      'balance': '⚖️ Balance'
    };
    return priorityLabels[priority as keyof typeof priorityLabels] || priority;
  };

  const getMemoryScopeLabel = (memoryScope: string) => {
    const memoryLabels = {
      'local': '📝 Local',
      'session': '📚 Session',
      'cross-session': '🌍 Cross-Session'
    };
    return memoryLabels[memoryScope as keyof typeof memoryLabels] || memoryScope;
  };

  return (
    <div className="bg-gray-900 shadow-sm p-4 h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-100 mb-3 flex-shrink-0">Active Agents</h3>
      
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-start p-3 bg-gray-800 rounded">
              <span className="text-xl mr-3 mt-0.5 flex-shrink-0">{agent.avatar}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-100 text-sm truncate">{agent.name}</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs bg-blue-950 text-blue-200 px-2 py-1 rounded">
                    {getStyleLabel(agent.style)}
                  </span>
                  <span className="text-xs bg-green-950 text-green-200 px-2 py-1 rounded">
                    {getPriorityLabel(agent.priority)}
                  </span>
                  <span className="text-xs bg-purple-950 text-purple-200 px-2 py-1 rounded">
                    {getMemoryScopeLabel(agent.memoryScope)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">{agent.personality}</p>
              </div>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            No agents selected for this session.
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700 flex-shrink-0">
        <h4 className="text-xs font-medium text-gray-300 mb-2">Yui Protocol Agent Types</h4>
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Styles:</strong> Logical, Critical, Intuitive, Meta, Emotive, Analytical</p>
          <p><strong>Priorities:</strong> Precision, Breadth, Depth, Balance</p>
          <p><strong>Memory:</strong> Local, Session, Cross-Session</p>
        </div>
      </div>
    </div>
  );
};

export default AgentSelector; 