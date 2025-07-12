import React, { useState, useEffect, useRef } from 'react';
import { Session, Message, DialogueStage, Language } from '../types/index.js';
import MessagesView from './MessagesView.js';
import StageIndicator from './StageIndicator.js';
import { io, Socket } from 'socket.io-client';

interface ThreadViewProps {
  session: Session;
  onSessionUpdate: (session: Session) => void;
  testOverrides?: {
    isCreatingSession?: boolean;
    realtimeSessionId?: string;
  };
}

const ThreadView: React.FC<ThreadViewProps> = ({ session, onSessionUpdate, testOverrides }) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>(session.messages);
  const [currentStage, setCurrentStage] = useState<DialogueStage | null>(null);
  const [language, setLanguage] = useState<Language>(session.language || 'en');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テスト用オーバーライド
  const isCreatingSession = testOverrides?.isCreatingSession ?? false;
  const realtimeSessionId = testOverrides?.realtimeSessionId ?? session.id;

  // Initialize WebSocket connection
  useEffect(() => {
    // WebSocketサーバーのURLを動的に決定
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname;
    const wsPort = 3001; // サーバー側のポートに合わせてください
    const wsUrl = `${wsProtocol}://${wsHost}:${wsPort}`;
    const newSocket = io(wsUrl);
    
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected to server');
      setIsConnected(true);
      
      // Join the session room
      newSocket.emit('join-session', session.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('stage-start', (data: { sessionId: string; stage: string; timestamp: string }) => {
      console.log(`[WebSocket] Stage started: ${data.stage}`);
      setCurrentStage(data.stage as DialogueStage);
    });

    newSocket.on('stage-progress', (data: { sessionId: string; stage: string; message: Message; timestamp: string }) => {
      console.log(`[WebSocket] Stage progress: ${data.stage}`, data.message);
      setMessages(prev => [...prev, data.message]);
    });

    newSocket.on('stage-complete', (data: { sessionId: string; stage: string; result: any; timestamp: string }) => {
      console.log(`[WebSocket] Stage completed: ${data.stage}`, data.result);
      setCurrentStage(data.stage as DialogueStage);
      reloadSessionData();
    });

    newSocket.on('stage-error', (data: { sessionId: string; stage: string; error: string; timestamp: string }) => {
      console.error(`[WebSocket] Stage error: ${data.stage}`, data.error);
      setIsProcessing(false);
    });

    newSocket.on('session-complete', (data: { sessionId: string; timestamp: string }) => {
      console.log(`[WebSocket] Session completed: ${data.sessionId}`);
      setIsProcessing(false);
      setCurrentStage(null);
      reloadSessionData();
    });

    newSocket.on('session-error', (data: { sessionId: string; error: string }) => {
      console.error(`[WebSocket] Session error: ${data.sessionId}`, data.error);
      setIsProcessing(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [session.id]);

  // Update messages when session changes
  useEffect(() => {
    console.log(`[UI] Session change effect triggered - session.id: ${session.id}`);
    console.log(`[UI] Session sequenceNumber: ${session.sequenceNumber}`);
    console.log(`[UI] Session messages count: ${session.messages.length}`);
    
    setMessages(session.messages);
    setCurrentStage(session.currentStage || null);
    setLanguage(session.language || 'en');

    setIsProcessing(false);
    setUserPrompt('');

    console.log(`[UI] Session change reset completed for new session`);
  }, [session.id, session.messages, session.currentStage, session.language]);

  // Check if all stages are completed
  useEffect(() => {
    const completedStages = session.stageHistory?.filter(h => h.endTime) || [];
    const hasProgress = completedStages.length > 0 || (session.messages && session.messages.length > 1);
    const isCompleted = session?.status === 'completed' || completedStages.length >= 8;
    setShowContinueButton(hasProgress && !isCompleted);
  }, [session.messages, session.stageHistory, session.status]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, [userPrompt]);

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const notifySessionUpdate = (updatedSession: Session) => {
    onSessionUpdate(updatedSession);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing || !socket || !isConnected) return;

    const promptToSend = userPrompt.trim();
    setUserPrompt('');
    setIsProcessing(true);
    setShouldAutoScroll(true);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: promptToSend,
      timestamp: new Date(),
      role: 'user'
    };

    // 新しいシーケンス開始時は仮想的にメッセージを追加しない
    if (session.status !== 'completed') {
      setMessages(prev => [...prev, userMessage]);
    }

    try {
      // 新しいシーケンスが必要な場合はAPI経由で開始
      if (session.status === 'completed') {
        const response = await fetch(`/api/sessions/${session.id}/start-new-sequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userPrompt: promptToSend })
        });
        if (response.ok) {
          const data = await response.json();
          // セッション情報をリロード
          await reloadSessionData();
        } else {
          throw new Error('Failed to start new sequence');
        }
      }
      // Start session execution via WebSocket
      socket.emit('start-session-execution', {
        sessionId: session.id,
        userPrompt: promptToSend
      });
      console.log(`[UI] Started session execution for session: ${session.id}`);
    } catch (error) {
      console.error('Error starting session execution:', error);
      setIsProcessing(false);
    } finally {
      resetTextareaHeight();
    }
  };

  const handleSendPrompt = async (prompt: string) => {
    if (!prompt.trim() || isProcessing || !socket || !isConnected) return;
    setUserPrompt('');
    setIsProcessing(true);
    setShouldAutoScroll(true);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: prompt,
      timestamp: new Date(),
      role: 'user'
    };

    if (session.status !== 'completed') {
      setMessages(prev => [...prev, userMessage]);
    }

    try {
      if (session.status === 'completed') {
        const response = await fetch(`/api/sessions/${session.id}/start-new-sequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userPrompt: prompt })
        });
        if (response.ok) {
          const data = await response.json();
          await reloadSessionData();
        } else {
          throw new Error('Failed to start new sequence');
        }
      }
      socket.emit('start-session-execution', {
        sessionId: session.id,
        userPrompt: prompt
      });
      console.log(`[UI] Started session execution for session: ${session.id}`);
    } catch (error) {
      console.error('Error starting session execution:', error);
      setIsProcessing(false);
    } finally {
      resetTextareaHeight();
    }
  };

  const reloadSessionData = async () => {
    try {
      console.log(`[UI] Reloading session data for: ${session.id}`);

      const response = await fetch(`/api/sessions/${session.id}`);
      if (response.ok) {
        const sessionData = await response.json();
        notifySessionUpdate(sessionData);
      }
    } catch (error) {
      console.error(`[UI] Error reloading session data:`, error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const stages: DialogueStage[] = [
    'individual-thought',
    'mutual-reflection',
    'mutual-reflection-summary',
    'conflict-resolution',
    'conflict-resolution-summary',
    'synthesis-attempt',
    'synthesis-attempt-summary',
    'output-generation',
    'finalize'
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4 bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">{session.title}</h1>
            <p className="text-sm text-gray-300">
              {session.agents.map(agent => agent.name).join(', ')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-300">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Indicator - Fixed below header */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4 bg-gray-800">
        <StageIndicator
          stageHistory={session.stageHistory}
          currentStage={currentStage}
          complete={session.status === 'completed'}
          sequenceNumber={session.sequenceNumber || 1}
        />
      </div>

      {/* Messages - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-gray-900">
        <MessagesView
          session={session}
          messages={messages}
          currentStage={currentStage}
          shouldAutoScroll={shouldAutoScroll}
          onScroll={setShouldAutoScroll}
        />
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-gray-700 p-4 bg-gray-800">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <textarea
            ref={textareaRef}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt... (Enter to send, Shift+Enter for new line)"
            className="flex-1 resize-none border border-gray-600 rounded-lg px-3 py-2 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isProcessing || !isConnected}
          />
          <button
            type="submit"
            disabled={!userPrompt.trim() || isProcessing || !isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </form>
        
        {showContinueButton && (
          <div className="mt-2">
            <button
              onClick={() => handleSendPrompt('Continue from previous session')}
              disabled={isProcessing || !isConnected}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadView;