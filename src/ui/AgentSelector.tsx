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
      
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-start p-2 bg-gray-800">
              <span className="text-xl mr-2 mt-0.5">{agent.avatar}</span>
              <div className="flex-1">
                <h4 className="font-medium text-gray-100 text-sm">{agent.name}</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-xs bg-blue-950 text-blue-200 px-1 py-0.5">
                    {getStyleLabel(agent.style)}
                  </span>
                  <span className="text-xs bg-green-950 text-green-200 px-1 py-0.5">
                    {getPriorityLabel(agent.priority)}
                  </span>
                  <span className="text-xs bg-purple-950 text-purple-200 px-1 py-0.5">
                    {getMemoryScopeLabel(agent.memoryScope)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{agent.personality.substring(0, 60)}...</p>
              </div>
            </div>
          ))}
        </div>

        {agents.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            No agents selected for this session.
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700 flex-shrink-0">
        <h4 className="text-xs font-medium text-gray-300 mb-1">Yui Protocol Agent Types</h4>
        <div className="text-xs text-gray-500 space-y-0.5">
          <p><strong>Styles:</strong> Logical, Critical, Intuitive, Meta, Emotive, Analytical</p>
          <p><strong>Priorities:</strong> Precision, Breadth, Depth, Balance</p>
          <p><strong>Memory:</strong> Local, Session, Cross-Session</p>
        </div>
      </div>
    </div>
  );
};

export default AgentSelector; 