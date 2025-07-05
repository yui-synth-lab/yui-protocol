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
            <div
              key={agent.id}
              className="flex items-start p-4 mb-2 rounded-xl shadow-lg border-l-8"
              style={{
                borderLeftColor: agent.color || '#ccc',
                background: `linear-gradient(135deg, ${agent.color || '#374151'}22 0%, #23272f 100%)`,
                boxShadow: `0 4px 16px 0 ${agent.color || '#222'}33`,
              }}
            >
              <span className="text-2xl mr-4 mt-1 flex-shrink-0 drop-shadow-sm">
                {agent.avatar}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base tracking-wide flex items-center gap-2" style={{ color: agent.color || '#fff', textShadow: '0 1px 4px #0008' }}>
                  {agent.name}
                  {agent.furigana && (
                    <span className="ml-1 text-xs font-medium text-gray-300/80" style={{ letterSpacing: '0.05em' }}>（{agent.furigana}）</span>
                  )}
                </div>
                <div className="text-xs mt-2 font-normal text-gray-100">
                  {agent.personality}
                </div>
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