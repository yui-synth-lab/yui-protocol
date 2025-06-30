import React, { useState, useEffect, useRef } from 'react';
import { Session, Message, DialogueStage } from '../types/index';
import ThreadHeader from './ThreadHeader';
import MessagesView from './MessagesView';

type Language = 'en' | 'ja';

interface ThreadViewProps {
  session: Session;
  onSessionUpdate?: (updatedSession: Session) => Promise<void>;
  testOverrides?: {
    isCreatingSession?: boolean;
    realtimeSessionId?: string | null;
  };
}

const ThreadView: React.FC<ThreadViewProps> = ({ session, onSessionUpdate, testOverrides }) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>(session.messages);
  const [currentStage, setCurrentStage] = useState<DialogueStage | null>(null);
  const [language, setLanguage] = useState<Language>('ja');
  const [realtimeSessionIdState, setRealtimeSessionId] = useState<string | null>(null);
  const [isCreatingSessionState, setIsCreatingSession] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [isWaitingForFirstResponse, setIsWaitingForFirstResponse] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テスト用オーバーライド
  const isCreatingSession = testOverrides?.isCreatingSession ?? isCreatingSessionState;
  const realtimeSessionId = testOverrides?.realtimeSessionId ?? realtimeSessionIdState;

  useEffect(() => {
    if (JSON.stringify(session.messages) !== JSON.stringify(messages)) {
      console.log(`[UI] Updating messages from session: ${session.messages.length} messages`);
      if (messages.length === 0 || session.messages.length > messages.length) {
        setMessages(session.messages);
      } else {
        console.log(`[UI] Keeping current messages (${messages.length}) over session messages (${session.messages.length})`);
      }
    } else if (session.messages.length === 0 && messages.length > 0) {
      console.log(`[UI] Resetting messages to empty for session with no messages`);
      setMessages([]);
    }
    
    setCurrentStage(session.currentStage || null);
    
    // Check if all 5 stages are completed
    const completedStages = session.stageHistory?.filter(h => h.endTime) || [];
    const hasProgress = completedStages.length > 0 || (session.messages && session.messages.length > 1);
    
    const isCompleted = session?.status === 'completed' || completedStages.length >= 5;
    setShowContinueButton(hasProgress && !isCompleted);
  }, [session.messages, session.currentStage, session.id, session.stageHistory, session.status]);

  // Reset messages when session changes
  useEffect(() => {
    console.log(`[UI] Session change effect triggered - session.id: ${session.id}`);
    setMessages(session.messages);
    setCurrentStage(session.currentStage || null);
    
    setPendingUserMessage(null);
    setIsProcessing(false);
    setIsWaitingForFirstResponse(false);
    setUserPrompt('');
    
    setRealtimeSessionId(null);
    setIsCreatingSession(false);
    
    console.log(`[UI] Session change reset completed for new session`);
  }, [session.id]);

  // Only create if realtimeSessionId is null and not creating session
  useEffect(() => {
    if (!realtimeSessionId && !isCreatingSession) {
      createRealtimeSession();
    }
  }, [realtimeSessionId, isCreatingSession, session.id]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }
  }, [userPrompt]);

  const createRealtimeSession = async () => {
    if (isCreatingSession) {
      console.log('[UI] Already creating session, skipping...');
      return;
    }
    
    try {
      console.log('[UI] Starting realtime session creation for:', session.title);
      setIsCreatingSession(true);
      
      // Use session ID directly from URL/props
      setRealtimeSessionId(session.id);
      console.log('[UI] Using session ID for realtime:', session.id);
      
    } catch (error) {
      console.error('[UI] Error setting up realtime session:', error);
      setTimeout(() => {
        if (!realtimeSessionId) {
          console.log('[UI] Retrying realtime session setup...');
          createRealtimeSession();
        }
      }, 2000);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isProcessing || !realtimeSessionId) return;

    const promptToSend = userPrompt;
    setUserPrompt('');
    setIsProcessing(true);
    setIsWaitingForFirstResponse(true);
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: promptToSend,
      timestamp: new Date(),
      role: 'user'
    };
    
    setShouldAutoScroll(true);
    setPendingUserMessage(userMessage);
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      setTimeout(() => {
        debouncedNotifySessionUpdate({
          messages: newMessages,
          updatedAt: new Date()
        });
      }, 0);
      return newMessages;
    });
    
    try {
      // Check if all 5 stages are completed
      const completedStages = session.stageHistory?.filter(h => h.endTime) || [];
      const isAllStagesCompleted = completedStages.length >= 5;
      
      if (isAllStagesCompleted) {
        console.log(`[UI] All 5 stages completed, starting new process`);
        
        try {
          const resetResponse = await fetch(`/api/sessions/${realtimeSessionId}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (resetResponse.ok) {
            console.log(`[UI] Session reset successfully for new process`);
            await reloadSessionData();
          } else {
            console.warn(`[UI] Failed to reset session: ${resetResponse.status}`);
          }
        } catch (error) {
          console.error(`[UI] Error resetting session:`, error);
        }
        
        setCurrentStage(null);
        
        for (const stage of stages) {
          console.log(`[UI] Starting new process stage: ${stage}`);
          setCurrentStage(stage);
          try {
            await executeRealtimeStage(stage, promptToSend);
            console.log(`[UI] Completed new process stage: ${stage}`);
          } catch (error) {
            console.error(`[UI] Error in new process stage ${stage}:`, error);
          }
          if (stage !== 'output-generation') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        // Continue with remaining stages
        const currentProgress = completedStages.length;
        const remainingStages = stages.slice(currentProgress);

        console.log(`[UI] Current progress: ${currentProgress}/${stages.length}, remaining stages: ${remainingStages.join(', ')}`);

        for (const stage of remainingStages) {
          console.log(`[UI] Starting stage: ${stage}`);
          setCurrentStage(stage);
          try {
            await executeRealtimeStage(stage, promptToSend);
            console.log(`[UI] Completed stage: ${stage}`);
          } catch (error) {
            console.error(`[UI] Error in stage ${stage}:`, error);
          }
          if (stage !== 'output-generation') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      console.log(`[UI] All stages completed`);
    } catch (error) {
      console.error('Error in auto stage execution:', error);
    } finally {
      setIsProcessing(false);
      setIsWaitingForFirstResponse(false);
      setPendingUserMessage(null);
      resetTextareaHeight();
    }
  };

  const executeRealtimeStage = async (stage: DialogueStage, prompt: string) => {
    if (!realtimeSessionId) {
      console.error('[UI] No realtimeSessionId available for stage execution');
      return;
    }

    try {
      console.log(`[UI] Executing stage: ${stage} for session: ${realtimeSessionId}`);
      
      const response = await fetch(`/api/realtime/sessions/${realtimeSessionId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stage, language }),
      });

      console.log(`[UI] Stage API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[UI] Stage API error: ${response.status} - ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let stageCompleted = false;
      let firstResponseReceived = false;
      let messageCount = 0;
      let buffer = ''; // Buffer for incomplete SSE messages
      
      console.log(`[UI] Starting to read SSE stream for stage: ${stage}`);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[UI] SSE stream completed for stage: ${stage}`);
          break;
        }

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        console.log(`[UI] Processing ${lines.length} lines from SSE chunk, buffer size: ${buffer.length}`);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = line.slice(6).trim();
              if (!jsonData) continue; // Skip empty data lines
              
              // Additional validation for JSON data
              if (jsonData.length > 0 && (jsonData.startsWith('{') || jsonData.startsWith('['))) {
                const data = JSON.parse(jsonData);
                
                if (data.type === 'progress') {
                  messageCount++;
                  if (!firstResponseReceived) {
                    setIsWaitingForFirstResponse(false);
                    firstResponseReceived = true;
                  }
                  
                  setShouldAutoScroll(true);
                  
                  setMessages(prev => {
                    const newMessages = [...prev, data.message];
                    console.log(`[UI] Progress message ${messageCount} from ${data.message.agentId}, total messages: ${newMessages.length}`);
                    
                    // Batch session updates to reduce UI flicker
                    setTimeout(() => {
                      debouncedNotifySessionUpdate({
                        messages: newMessages,
                        updatedAt: new Date()
                      });
                    }, 50); // Reduced delay for better responsiveness
                    
                    return newMessages;
                  });
                } else if (data.type === 'complete') {
                  console.log(`[UI] Stage completed: ${data.result}`);
                  setCurrentStage(stage);
                  stageCompleted = true;
                  await reloadSessionData();
                  break;
                } else if (data.type === 'error') {
                  console.error('[UI] Realtime error:', data.error);
                  throw new Error(data.error);
                }
              } else {
                console.warn('[UI] Skipping invalid JSON data:', jsonData.substring(0, 100));
              }
            } catch (e) {
              console.error('[UI] Error parsing SSE data:', e, 'Raw line length:', line.length);
              console.error('[UI] Raw line preview:', line.substring(0, 200));
              // Continue processing other messages instead of breaking
            }
          }
        }
      }

      if (!stageCompleted) {
        console.log(`[UI] Stage ${stage} completed (no explicit completion signal), received ${messageCount} messages`);
        setCurrentStage(stage);
        await reloadSessionData();
      }

    } catch (error) {
      console.error(`[UI] Error in realtime stage execution for ${stage}:`, error);
      throw error;
    }
  };

  const reloadSessionData = async () => {
    if (!realtimeSessionId) return;
    
    try {
      console.log(`[UI] Reloading session data for: ${realtimeSessionId}`);
      const response = await fetch(`/api/realtime/sessions/${realtimeSessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        
        const serverMessages = sessionData.messages || [];
        const currentMessages = messages;
        
        const messageMap = new Map();
        
        currentMessages.forEach((msg: Message) => {
          messageMap.set(msg.id, msg);
        });
        
        serverMessages.forEach((msg: Message) => {
          if (!messageMap.has(msg.id)) {
            messageMap.set(msg.id, msg);
          }
        });
        
        const mergedMessages = Array.from(messageMap.values()).sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        console.log(`[UI] Merged messages: current=${currentMessages.length}, server=${serverMessages.length}, merged=${mergedMessages.length}`);
        
        setMessages(mergedMessages);
        setCurrentStage(sessionData.currentStage);
        
        notifySessionUpdate(sessionData);
      }
    } catch (error) {
      console.error('[UI] Error reloading session data:', error);
    }
  };

  const notifySessionUpdate = async (updatedSessionData: any) => {
    if (onSessionUpdate) {
      try {
        // Only update if there are actual changes
        const hasChanges = 
          updatedSessionData.messages?.length !== messages.length ||
          updatedSessionData.currentStage !== session.currentStage ||
          updatedSessionData.status !== session.status ||
          updatedSessionData.complete !== session.complete;
        
        if (hasChanges) {
          // Create a clean update object with only the necessary fields
          const updatedSession = {
            id: session.id,
            title: session.title,
            agents: session.agents,
            createdAt: session.createdAt,
            // Only update the fields that actually changed
            messages: updatedSessionData.messages || session.messages,
            updatedAt: updatedSessionData.updatedAt || new Date(),
            currentStage: updatedSessionData.currentStage !== undefined ? updatedSessionData.currentStage : session.currentStage,
            stageHistory: updatedSessionData.stageHistory || session.stageHistory,
            status: updatedSessionData.status || session.status,
            complete: updatedSessionData.complete !== undefined ? updatedSessionData.complete : session.complete
          };
          await onSessionUpdate(updatedSession);
        }
      } catch (error) {
        console.error('[UI] Error notifying parent of session update:', error);
      }
    }
  };

  const debouncedNotifySessionUpdate = React.useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      let pendingUpdate: any = null;
      
      return (updatedSessionData: any) => {
        // Merge pending updates with care to prevent cross-session contamination
        if (pendingUpdate) {
          pendingUpdate = {
            // Preserve the most recent values for each field
            messages: updatedSessionData.messages || pendingUpdate.messages,
            updatedAt: updatedSessionData.updatedAt || pendingUpdate.updatedAt,
            currentStage: updatedSessionData.currentStage !== undefined ? updatedSessionData.currentStage : pendingUpdate.currentStage,
            stageHistory: updatedSessionData.stageHistory || pendingUpdate.stageHistory,
            status: updatedSessionData.status || pendingUpdate.status,
            complete: updatedSessionData.complete !== undefined ? updatedSessionData.complete : pendingUpdate.complete
          };
        } else {
          pendingUpdate = updatedSessionData;
        }
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (pendingUpdate) {
            notifySessionUpdate(pendingUpdate);
            pendingUpdate = null;
          }
        }, 100);
      };
    }, [notifySessionUpdate])
  );

  const stages: DialogueStage[] = [
    'individual-thought',
    'mutual-reflection', 
    'conflict-resolution',
    'synthesis-attempt',
    'output-generation'
  ];

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = '40px';
    }
  };

  const handleSendPrompt = async (prompt: string) => {
    if (!prompt.trim() || isProcessing || isCreatingSession || !realtimeSessionId) return;
    setUserPrompt('');
    setIsProcessing(true);
    setIsWaitingForFirstResponse(true);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      content: prompt,
      timestamp: new Date(),
      role: 'user'
    };
    
    setShouldAutoScroll(true);
    setMessages(prev => [...prev, userMessage]);

    try {
      // Check if all 5 stages are completed
      const completedStages = session.stageHistory?.filter(h => h.endTime) || [];
      const isAllStagesCompleted = completedStages.length >= 5;
      
      if (isAllStagesCompleted) {
        console.log(`[UI] All 5 stages completed, starting new process`);
        
        try {
          const resetResponse = await fetch(`/api/sessions/${realtimeSessionId}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (resetResponse.ok) {
            console.log(`[UI] Session reset successfully for new process`);
            await reloadSessionData();
          } else {
            console.warn(`[UI] Failed to reset session: ${resetResponse.status}`);
          }
        } catch (error) {
          console.error(`[UI] Error resetting session:`, error);
        }
        
        setCurrentStage(null);
        
        for (const stage of stages) {
          console.log(`[UI] Starting new process stage: ${stage}`);
          setCurrentStage(stage);
          try {
            await executeRealtimeStage(stage, prompt);
            console.log(`[UI] Completed new process stage: ${stage}`);
          } catch (error) {
            console.error(`[UI] Error in new process stage ${stage}:`, error);
          }
          if (stage !== 'output-generation') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        // Continue with remaining stages
        const currentProgress = completedStages.length;
        const remainingStages = stages.slice(currentProgress);

        console.log(`[UI] Current progress: ${currentProgress}/${stages.length}, remaining stages: ${remainingStages.join(', ')}`);

        for (const stage of remainingStages) {
          console.log(`[UI] Starting stage: ${stage}`);
          setCurrentStage(stage);
          try {
            await executeRealtimeStage(stage, 'Continuing from previous session');
            console.log(`[UI] Completed stage: ${stage}`);
          } catch (error) {
            console.error(`[UI] Error in stage ${stage}:`, error);
          }
          if (stage !== 'output-generation') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      console.log(`[UI] All stages completed`);
    } catch (error) {
      console.error('Error in auto stage execution:', error);
    } finally {
      setIsProcessing(false);
      setIsWaitingForFirstResponse(false);
      setPendingUserMessage(null);
      resetTextareaHeight();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ThreadHeader session={session} currentStage={currentStage} />

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <div className="flex flex-col h-full">
          {/* Messages container */}
          <MessagesView
            session={session}
            messages={messages}
            currentStage={currentStage}
            onScroll={setShouldAutoScroll}
            shouldAutoScroll={shouldAutoScroll}
          />

          {/* Continue Process button */}
          {showContinueButton && (
            <div className="bg-gray-900 border-t border-gray-700 p-4">
              <button
                onClick={() => handleSendPrompt('Continue Process')}
                disabled={isProcessing}
                className="w-full bg-blue-700 text-white py-3 px-4 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                {isProcessing ? 'Processing...' : 'Continue Process'}
              </button>
            </div>
          )}

          {/* Input form */}
          <div className="bg-gray-900 border-t border-gray-700 p-4">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isProcessing && userPrompt.trim() && realtimeSessionId) {
                        handleSubmit(e as any);
                      }
                    }
                  }}
                  placeholder="Enter your prompt... (Enter to send, Shift+Enter for new line)"
                  className="w-full px-3 py-3 border border-gray-700 bg-gray-800 text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent rounded"
                  rows={1}
                  disabled={isProcessing || isCreatingSession || !realtimeSessionId}
                />
              </div>
              <button
                type="submit"
                disabled={!userPrompt.trim() || isProcessing || isCreatingSession || !realtimeSessionId}
                className="px-6 py-3 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isWaitingForFirstResponse && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
            <p className="text-gray-200">AI agents are starting their analysis...</p>
            <p className="text-sm text-gray-400">Please wait a moment</p>
          </div>
        </div>
      )}

      {/* Scroll to bottom button */}
      {!shouldAutoScroll && messages.length > 0 && (
        <button
          onClick={() => setShouldAutoScroll(true)}
          className="absolute bottom-20 right-4 bg-blue-700 text-white p-3 shadow-lg hover:bg-blue-800 rounded"
          title="Scroll to latest message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ThreadView;