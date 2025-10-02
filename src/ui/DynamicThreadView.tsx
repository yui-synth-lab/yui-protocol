import React, { useState, useRef, useEffect } from 'react';
import { Session, Agent, Message, AgentConsensusData } from '../types/index.js';
import MessagesView from './MessagesView.js';
import ConsensusIndicator from './ConsensusIndicator.js';
import { io, Socket } from 'socket.io-client';

interface DynamicThreadViewProps {
  session: Session;
  availableAgents: Agent[];
  onSessionUpdate: (session: Session) => void;
}

const DynamicThreadView: React.FC<DynamicThreadViewProps> = ({
  session,
  availableAgents,
  onSessionUpdate
}) => {
  console.log('[DynamicThreadView] Rendering with session:', session?.id, 'agents:', availableAgents?.length);
  const [userPrompt, setUserPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [consensusLevel, setConsensusLevel] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [participationBalance, setParticipationBalance] = useState<Record<string, number>>({});
  const [topicShift, setTopicShift] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>(session.messages || []);
  const [consensusData, setConsensusData] = useState<AgentConsensusData[]>([]);
  const [showAgentsOnly, setShowAgentsOnly] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update participation balance from messages
  useEffect(() => {
    if (messages && messages.length > 0) {

      // Calculate participation balance for recent messages (last 8 messages)
      const recentMessages = messages.slice(-8);
      const balance: Record<string, number> = {};

      // Initialize all agents with 0
      const allAgentIds = ['eiro-001', 'yui-000', 'hekito-001', 'yoga-001', 'kanshi-001'];
      allAgentIds.forEach(agentId => {
        balance[agentId] = 0;
      });

      // Count recent participation
      recentMessages.forEach(msg => {
        if (msg.agentId !== 'user' && msg.role === 'agent' && allAgentIds.includes(msg.agentId)) {
          balance[msg.agentId] = balance[msg.agentId] + 1;
        }
      });

      setParticipationBalance(balance);

      console.log(`[DynamicThreadView] Messages count: ${messages.length}, Recent messages: ${recentMessages.length}`);
      console.log(`[DynamicThreadView] Participation balance updated:`, balance);
      console.log(`[DynamicThreadView] Recent agent messages:`, recentMessages.filter(m => m.role === 'agent').map(m => `${m.agentId}: ${m.content.slice(0, 50)}...`));

      // Check for topic shift indicators
      const hasTopicShift = recentMessages.some(m => m.metadata?.topic_shift === true);
      setTopicShift(hasTopicShift);
    }
  }, [messages, currentRound]);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname;
    const wsPort = 3001;
    const wsUrl = `${wsProtocol}://${wsHost}:${wsPort}`;
    const newSocket = io(wsUrl);

    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected to server for v2.0');
      setIsConnected(true);
      newSocket.emit('join-session', session.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from server');
      setIsConnected(false);
    });

    // v2.0 specific events
    newSocket.on('v2-round-start', (data: { sessionId: string; round: number; timestamp: string }) => {
      console.log(`[WebSocket] v2.0 Round ${data.round} started`);
      setCurrentRound(data.round);
    });

    newSocket.on('v2-consensus-update', (data: { sessionId: string; consensusLevel: number; round: number }) => {
      console.log(`[WebSocket] Consensus level: ${data.consensusLevel}`);
      setConsensusLevel(data.consensusLevel);
      // Update consensus data from session when new data arrives
      updateConsensusFromSession();
    });


    newSocket.on('v2-message', (data: { sessionId: string; message: Message; round: number }) => {
      console.log(`[WebSocket] New v2.0 message:`, data.message);
      setMessages(prev => [...prev, data.message]);
    });

    newSocket.on('v2-complete', (data: { sessionId: string; session: Session; totalRounds: number; finalConsensus: number }) => {
      console.log(`[WebSocket] v2.0 dialogue complete after ${data.totalRounds} rounds`);
      setIsProcessing(false);
      setMessages(data.session.messages || []);
      onSessionUpdate(data.session);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [session.id, onSessionUpdate]);

  // Update messages when session changes
  useEffect(() => {
    setMessages(session.messages || []);
    updateConsensusFromSession();
  }, [session.messages, session.consensusHistory]);

  // Update consensus data from session
  const updateConsensusFromSession = (updatedSession?: Session) => {
    const sessionToUse = updatedSession || session;
    if (sessionToUse.consensusHistory && sessionToUse.consensusHistory.length > 0) {
      const latestSnapshot = sessionToUse.consensusHistory[sessionToUse.consensusHistory.length - 1];
      setConsensusData(latestSnapshot.agentConsensus);
      setConsensusLevel(latestSnapshot.overallConsensus);
    }
  };

  const startDynamicDialogue = async () => {
    if (!userPrompt.trim() || isProcessing || !socket) return;

    // Block input completely if session is concluded
    if (session.status === 'concluded') {
      return;
    }

    setIsProcessing(true);
    setCurrentRound(0);
    setConsensusLevel(0);
    setConsensusData([]);

    // Immediately add user message to UI
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: userPrompt,
      timestamp: new Date(),
      role: 'user',
      sequenceNumber: 1
    };
    setMessages([userMessage]); // Show user message immediately

    try {
      // Start the dynamic dialogue via API
      const response = await fetch(`/api/v2/sessions/${session.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userPrompt,
          language: session.language || 'en'
        }),
      });

      if (response.ok) {
        console.log('[DynamicThreadView] Dynamic dialogue started, listening for WebSocket updates...');
        setUserPrompt('');
        // Don't call onSessionUpdate here - wait for WebSocket completion
      } else {
        const error = await response.json();
        console.error('Error starting dynamic dialogue:', error);
        alert(`Error: ${error.error || 'Failed to start dynamic dialogue'}`);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error starting dynamic dialogue:', error);
      alert('Failed to start dynamic dialogue. Please try again.');
      setIsProcessing(false);
    }
    // Don't set isProcessing(false) here - wait for WebSocket completion
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      startDynamicDialogue();
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  console.log('[DynamicThreadView] About to render. Session ID:', session?.id, 'Messages:', messages?.length);

  // Error boundary check
  if (!session) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-red-400">
        <h2>Error: No session provided</h2>
        <p>DynamicThreadView requires a valid session</p>
      </div>
    );
  }

  if (!availableAgents || availableAgents.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-yellow-400">
        <h2>Loading...</h2>
        <p>Waiting for available agents</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header with filter button */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300 font-medium">{session.title}</div>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          </div>
          <button
            onClick={() => setShowAgentsOnly(!showAgentsOnly)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showAgentsOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={showAgentsOnly ? 'Show all messages' : 'Show AI agents only'}
          >
            {showAgentsOnly ? '🤖 Agents Only' : '👥 All Messages'}
          </button>
        </div>
      </div>

      {/* Compact Status Bar */}
      {(isProcessing || currentRound > 0) && (
        <div className="bg-purple-900 border-b border-purple-700 px-4 py-2">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-4">
              {isProcessing ? (
                <span className="flex items-center gap-2 text-purple-200">
                  <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></div>
                  Round {currentRound}
                </span>
              ) : (
                <span className="text-purple-200">Round {currentRound} Complete</span>
              )}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            </div>
            <button
              onClick={() => setShowAgentsOnly(!showAgentsOnly)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showAgentsOnly
                  ? 'bg-blue-600 text-white'
                  : 'bg-purple-800 text-purple-200 hover:bg-purple-700'
              }`}
              title={showAgentsOnly ? 'Show all messages' : 'Show AI agents only'}
            >
              {showAgentsOnly ? '🤖 Agents Only' : '👥 All Messages'}
            </button>
          </div>

          {/* Detailed Consensus Indicator */}
          {(consensusLevel > 0 || consensusData.length > 0) && (
            <ConsensusIndicator
              consensusData={consensusData}
              overallConsensus={consensusLevel}
              isExpanded={false}
            />
          )}
        </div>
      )}

      {/* Messages - Now takes majority of screen space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <MessagesView
          session={session}
          messages={messages}
          availableAgents={availableAgents}
          currentStage={null}
          shouldAutoScroll={true}
          protocolVersion="2.0"
          showAgentsOnly={showAgentsOnly}
        />
      </div>

      {/* Compact Input Area */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">Dynamic Dialogue v2.0</div>
          <button
            onClick={() => setShowAgentsOnly(!showAgentsOnly)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showAgentsOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={showAgentsOnly ? 'Show all messages' : 'Show AI agents only'}
          >
            {showAgentsOnly ? '🤖 Agents Only' : '👥 All Messages'}
          </button>
        </div>
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={userPrompt}
            onChange={(e) => {
              setUserPrompt(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyPress}
            placeholder={
              session.status === 'concluded'
                ? "対話は完了しました。新しい入力はできません。"
                : "Enter your question or topic for dynamic dialogue..."
            }
            className={`flex-1 px-3 py-2 border text-gray-100 rounded resize-none min-h-[40px] max-h-[120px] focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              session.status === 'concluded'
                ? 'bg-gray-800 border-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 border-gray-600'
            }`}
            disabled={isProcessing || session.status === 'concluded'}
          />
          <button
            onClick={startDynamicDialogue}
            disabled={!userPrompt.trim() || isProcessing || session.status === 'concluded'}
            className={`px-4 py-2 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              session.status === 'concluded'
                ? 'bg-gray-600'
                : session.status === 'completed'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {session.status === 'concluded'
              ? '完了'
              : isProcessing
              ? 'Processing...'
              : session.status === 'completed'
                ? 'Continue'
                : 'Start'
            }
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>v2.0: Dynamic consensus-based dialogue</span>
          {session.status !== 'concluded' && <span>Cmd/Ctrl + Enter to submit</span>}
        </div>
        {session.status === 'concluded' && (
          <div className="mt-1 text-xs text-green-400 font-medium">
            ✅ 対話完了 - この議論は終了しました
          </div>
        )}
        {session.status === 'completed' && (
          <div className="mt-1 text-xs text-orange-400 font-medium">
            ✅ 対話完了 - 継続する場合は新しい議論になります
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicThreadView;