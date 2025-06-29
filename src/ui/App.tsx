import React, { useState, useEffect } from 'react';
import ThreadView from './ThreadView';
import AgentSelector from './AgentSelector';
import SessionManager from './SessionManager';
import { Session, Agent } from '../types/index';

function App() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [showProcessInfo, setShowProcessInfo] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    // Load available agents and sessions on component mount
    loadAvailableAgents();
    loadSessions();
    
    // Check screen size and set default visibility
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 1024; // lg breakpoint
      setShowProcessInfo(window.innerWidth >= 768); // md breakpoint
      setShowSidebar(!isMobile); // Hide sidebar by default on mobile
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const loadAvailableAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const agents = await response.json();
      setAvailableAgents(agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const sessionsData = await response.json();
      setSessions(sessionsData);
      
      // Update current session if it exists in the new data
      if (currentSession) {
        const updatedCurrentSession = sessionsData.find((s: Session) => s.id === currentSession.id);
        if (updatedCurrentSession) {
          setCurrentSession(updatedCurrentSession);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async (title: string, selectedAgentIds: string[]) => {
    try {
      console.log('App: Creating session with:', { title, selectedAgentIds });
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, agentIds: selectedAgentIds }),
      });
      
      const newSession = await response.json();
      console.log('App: Received new session:', newSession);
      
      // Clear any existing realtime session data for the new session
      localStorage.removeItem(`session_${newSession.id}`);
      
      setSessions(prev => [...prev, newSession]);
      setCurrentSession(newSession);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const selectSession = (session: Session) => {
    // Clear any existing realtime session data to prevent mixing
    const existingSessionId = localStorage.getItem(`session_${session.id}`);
    if (existingSessionId) {
      localStorage.removeItem(`session_${session.id}`);
      console.log('Cleared existing realtime session data for:', session.id);
    }
    setCurrentSession(session);
  };

  // Callback to handle session updates from ThreadView
  const handleSessionUpdate = async (updatedSession: Session) => {
    setCurrentSession(updatedSession);

    setSessions(prev => {
      const updatedSessions = prev.map(s =>
        s.id === updatedSession.id
          ? { ...s, ...updatedSession, messages: updatedSession.messages }
          : s
      );
      // Sort by updatedAt in descending order (newest first)
      return updatedSessions.sort((a, b) => {
        const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
        const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
        return dateB.getTime() - dateA.getTime();
      });
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-900">
      <div className="h-full flex flex-col">
        <div className="container mx-auto px-4 py-4 h-full flex flex-col">
          <header className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl font-bold text-gray-100">
                ⛩️ Yui Protocol
              </h1>
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <p className="text-gray-400 mb-3 text-sm">
              Multi-AI Collaborative Reasoning through Structured Dialogue
            </p>
            
            {/* Collapsible Process Info */}
            <div className="bg-blue-900 border border-blue-700">
              <button
                onClick={() => setShowProcessInfo(!showProcessInfo)}
                className="w-full p-2 text-left flex items-center justify-between hover:bg-blue-800 transition-colors"
              >
                <h3 className="text-sm font-medium text-blue-200">5-Stage Dialectic Process</h3>
                <svg
                  className={`w-4 h-4 text-blue-300 transition-transform ${showProcessInfo ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showProcessInfo && (
                <div className="px-2 pb-2">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-1 text-xs">
                    <div className="bg-blue-800 p-1 text-blue-100">
                      <strong>1. Individual Thought</strong><br/>
                      <span className="hidden sm:inline">Agents think independently</span>
                      <span className="sm:hidden">Independent thinking</span>
                    </div>
                    <div className="bg-green-800 p-1 text-green-100">
                      <strong>2. Mutual Reflection</strong><br/>
                      <span className="hidden sm:inline">Agents read and react to others</span>
                      <span className="sm:hidden">Read & react</span>
                    </div>
                    <div className="bg-yellow-800 p-1 text-yellow-100">
                      <strong>3. Conflict Resolution</strong><br/>
                      <span className="hidden sm:inline">Highlight divergence and debate</span>
                      <span className="sm:hidden">Resolve conflicts</span>
                    </div>
                    <div className="bg-purple-800 p-1 text-purple-100">
                      <strong>4. Synthesis Attempt</strong><br/>
                      <span className="hidden sm:inline">Try to unify perspectives</span>
                      <span className="sm:hidden">Unify views</span>
                    </div>
                    <div className="bg-indigo-800 p-1 text-indigo-100">
                      <strong>5. Output Generation</strong><br/>
                      <span className="hidden sm:inline">Final response with reasoning traces</span>
                      <span className="sm:hidden">Final output</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 min-h-0 flex">
            {/* Sidebar - Mobile overlay or desktop sidebar */}
            <div className={`
              ${showSidebar ? 'fixed lg:relative inset-0 z-50 lg:z-auto' : 'hidden lg:block'}
              lg:w-1/4 lg:max-w-xs
            `}>
              {/* Mobile overlay background */}
              {showSidebar && (
                <div 
                  className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                  onClick={() => setShowSidebar(false)}
                />
              )}
              
              {/* Sidebar content */}
              <div className={`
                ${showSidebar ? 'fixed lg:relative left-0 top-0' : ''}
                h-full lg:h-auto w-80 lg:w-full max-w-sm lg:max-w-none
                bg-gray-800 lg:bg-transparent
                border-r border-gray-700 lg:border-none
                z-50 lg:z-auto
                overflow-y-auto
              `}>
                <div className="p-4 lg:p-0 space-y-3">
                  <SessionManager
                    sessions={sessions}
                    currentSession={currentSession}
                    onSelectSession={(session) => {
                      selectSession(session);
                      setShowSidebar(false); // Close sidebar on mobile after selection
                    }}
                    onCreateSession={createNewSession}
                    availableAgents={availableAgents}
                  />
                  {currentSession && (
                    <AgentSelector
                      agents={currentSession.agents}
                      availableAgents={availableAgents}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto">
                {currentSession ? (
                  <ThreadView session={currentSession} onSessionUpdate={handleSessionUpdate} />
                ) : (
                  <div className="bg-gray-800 shadow-sm p-6 text-center h-full flex flex-col justify-center">
                    <div className="text-gray-600 mb-3">
                      <svg className="mx-auto h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-100 mb-2">
                      No Session Selected
                    </h3>
                    <p className="text-gray-400 mb-3 text-sm">
                      Create a new session or select an existing one to start the Yui Protocol dialogue process.
                    </p>
                    <div className="text-xs text-gray-500">
                      <p><strong>Yui</strong> means to bind, to entangle. This protocol simulates conceptual binding through reasoning.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 