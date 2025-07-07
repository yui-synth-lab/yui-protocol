import React, { useState, useEffect } from 'react';
import ThreadView from './ThreadView';
import { Session, Agent } from '../types/index';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation
} from 'react-router-dom';
// @ts-ignore
import imgUrl from './images/YuiProtocol.png'

// Menu component for sessions and agents
const Menu: React.FC<{
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  onCreateSession: (title: string, agentIds: string[], language: 'ja' | 'en') => void;
  availableAgents: Agent[];
  isOpen: boolean;
  onClose: () => void;
}> = ({ sessions, currentSession, onSelectSession, onCreateSession, availableAgents, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'agents'>('sessions');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;
    onCreateSession(newSessionTitle, availableAgents.map(agent => agent.id), language);
    setNewSessionTitle('');
    setShowCreateForm(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className="fixed inset-0 w-full h-full bg-gray-800 border-l border-gray-700 z-50 overflow-hidden">
        <div className="p-4 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex mb-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'agents'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Agents
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'sessions' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-100">Sessions</h3>
                  <button
                    onClick={() => {
                      setShowCreateForm(!showCreateForm);
                      if (showCreateForm) {
                        setNewSessionTitle('');
                      }
                    }}
                    className="text-xs bg-blue-800 text-white px-3 py-2 hover:bg-blue-900 rounded"
                  >
                    {showCreateForm ? 'Cancel' : 'New'}
                  </button>
                </div>

                {showCreateForm && (
                  <form onSubmit={handleCreateSession} className="mb-4 space-y-3">
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

                    <button
                      type="submit"
                      disabled={!newSessionTitle.trim()}
                      className="w-full bg-blue-800 text-white py-2 text-sm hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      Create Session
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No sessions yet.</p>
                  ) : (
                    sessions.map((session) => {
                      const messageCount = session.messages && Array.isArray(session.messages) 
                        ? session.messages.length 
                        : 0;
                      const agentCount = session.agents && Array.isArray(session.agents) 
                        ? session.agents.length 
                        : 0;
                      
                      return (
                        <button
                          key={session.id}
                          onClick={() => {
                            onSelectSession(session);
                            onClose();
                          }}
                          className={`w-full text-left p-3 transition-colors rounded ${
                            currentSession?.id === session.id
                              ? 'bg-blue-950 border border-blue-800'
                              : 'hover:bg-gray-700'
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
            )}

            {activeTab === 'agents' && (
              <div>
                <h3 className="text-base font-semibold text-gray-100 mb-3">Available Agents</h3>
                <div className="space-y-3">
                  {availableAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-start p-4 rounded-xl shadow-lg border-l-8"
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

                <div className="mt-4 pt-4 border-t border-gray-700">
                  <h4 className="text-xs font-medium text-gray-300 mb-2">Yui Protocol Agent Types</h4>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong>Styles:</strong> Logical, Critical, Intuitive, Meta, Emotive, Analytical</p>
                    <p><strong>Priorities:</strong> Precision, Breadth, Depth, Balance</p>
                    <p><strong>Memory:</strong> Local, Session, Cross-Session</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export function AppRoutes() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [showProcessInfo, setShowProcessInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const sessionIdFromUrl = params.sessionId;

  // Get current session from URL
  const currentSession = sessionIdFromUrl 
    ? sessions.find(s => s.id === sessionIdFromUrl) || null
    : null;

  useEffect(() => {
    // Load available agents and sessions on component mount
    loadAvailableAgents();
    loadSessions();
    
    // Check screen size and set default visibility
    const checkScreenSize = () => {
      setShowProcessInfo(window.innerWidth >= 768); // md breakpoint
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
      
      // Sort sessions by updatedAt in descending order only on initial load
      const sortedSessions = sessionsData.sort((a: Session, b: Session) => {
        const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
        const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSessions(sortedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const createNewSession = async (title: string, selectedAgentIds: string[], language: string) => {
    try {
      console.log('App: Creating session with:', { title, selectedAgentIds });
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, agentIds: selectedAgentIds, language }),
      });
      
      const newSession = await response.json();
      console.log('App: Received new session:', newSession);
      
      // Add new session to the beginning of the list (most recent first)
      setSessions(prev => [
        {
          id: newSession.id,
          title: newSession.title,
          agents: newSession.agents,
          createdAt: new Date(newSession.createdAt),
          messages: [],
          updatedAt: new Date(newSession.updatedAt),
          currentStage: undefined,
          stageHistory: [],
          status: 'active',
          complete: false,
          language: newSession.language || language || 'en',
        },
        ...prev.map(s => ({ ...s, language: s.language || 'en' }))
      ]);
      navigate(`/session/${newSession.id}`);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const selectSession = (session: Session) => {
    navigate(`/session/${session.id}`);
  };

  // Callback to handle session updates from ThreadView
  const handleSessionUpdate = async (updatedSession: Session) => {
    console.log(`[App] Handling session update for ${updatedSession.id} with ${updatedSession.messages?.length || 0} messages`);
    
    // Update sessions list without unnecessary sorting
    setSessions(prev => {
      const sessionIndex = prev.findIndex(s => s.id === updatedSession.id);
      if (sessionIndex === -1) {
        // Session not found, add it (shouldn't happen but just in case)
        console.log(`[App] Session not found, adding new session: ${updatedSession.id}`);
        return [...prev, updatedSession];
      }
      
      // Create a completely new sessions array to prevent reference issues
      const newSessions = prev.map((session, index) => {
        if (index === sessionIndex) {
          // Create a new session object with updated fields
          const updatedSessionData: Session = {
            id: session.id,
            title: session.title,
            agents: session.agents,
            createdAt: session.createdAt,
            language: session.language,
            // Always update messages to ensure count is current
            messages: updatedSession.messages || session.messages,
            updatedAt: updatedSession.updatedAt || session.updatedAt,
            currentStage: updatedSession.currentStage !== undefined ? updatedSession.currentStage : session.currentStage,
            stageHistory: updatedSession.stageHistory || session.stageHistory,
            status: updatedSession.status || session.status,
            complete: updatedSession.complete !== undefined ? updatedSession.complete : session.complete
          };
          
          console.log(`[App] Updated session ${session.id}: ${session.messages?.length || 0} -> ${updatedSessionData.messages?.length || 0} messages`);
          return updatedSessionData;
        }
        // Return unchanged session
        return session;
      });
      
      return newSessions;
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-900">
      <div className="h-full flex flex-col">
        <div className="container mx-auto px-4 py-4 h-full flex flex-col">
          <header className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl font-bold text-gray-100">
                <img src={imgUrl} alt="Yui Protocol" className="w-10 h-10 inline-block" /> Yui Protocol
              </h1>
              {/* Menu toggle button */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded"
                title="Open menu"
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

          {/* Main Content - Now full width */}
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

      {/* Menu Component */}
      <Menu
        sessions={sessions}
        currentSession={currentSession}
        onSelectSession={selectSession}
        onCreateSession={createNewSession}
        availableAgents={availableAgents}
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/session/:sessionId" element={<AppRoutes />} />
        <Route path="/" element={<AppRoutes />} />
      </Routes>
    </Router>
  );
} 