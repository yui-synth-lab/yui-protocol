import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Session, Message, DialogueStage } from '../types/index';

interface MessagesViewProps {
  session: Session;
  messages: Message[];
  currentStage: DialogueStage | null;
  onScroll?: (shouldAutoScroll: boolean) => void;
  shouldAutoScroll: boolean;
}

const MessagesView: React.FC<MessagesViewProps> = ({ 
  session, 
  messages, 
  currentStage, 
  onScroll,
  shouldAutoScroll 
}) => {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, shouldAutoScroll]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Handle scroll events to detect if user has scrolled up
  const handleScroll = () => {
    if (!messagesContainerRef.current || !onScroll) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
    
    if (!isAtBottom && shouldAutoScroll) {
      onScroll(false);
    } else if (isAtBottom && !shouldAutoScroll) {
      onScroll(true);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getAgentAvatar = (agentId: string) => {
    const agent = session.agents.find(a => a.id === agentId);
    return agent?.avatar || '🤖';
  };

  const getAgentName = (agentId: string) => {
    const agent = session.agents.find(a => a.id === agentId);
    return agent?.name || agentId;
  };

  const getUserAvatar = () => '🧑‍💻';

  const getStageLabel = (stage?: DialogueStage) => {
    if (!stage) return '';
    
    const stageLabels = {
      'individual-thought': '🧠 Individual Thought',
      'mutual-reflection': '🔄 Mutual Reflection',
      'conflict-resolution': '⚖️ Conflict Resolution',
      'synthesis-attempt': '🔗 Synthesis Attempt',
      'output-generation': '📤 Output Generation'
    };
    
    return stageLabels[stage] || stage;
  };

  const getStageColor = (stage?: DialogueStage) => {
    if (!stage) return 'bg-gray-900';
    const stageColors = {
      'individual-thought': 'bg-blue-900 border-blue-800 text-blue-100',
      'mutual-reflection': 'bg-green-900 border-green-800 text-green-100',
      'conflict-resolution': 'bg-yellow-900 border-yellow-800 text-yellow-100',
      'synthesis-attempt': 'bg-purple-900 border-purple-800 text-purple-100',
      'output-generation': 'bg-indigo-900 border-indigo-800 text-indigo-100'
    };
    return stageColors[stage] || 'bg-gray-900';
  };

  const groupMessagesByStage = (messages: Message[]) => {
    const groups: { stage?: DialogueStage; messages: Message[] }[] = [];
    let currentGroup: { stage?: DialogueStage; messages: Message[] } = { messages: [] };

    messages.forEach(message => {
      if (message.stage && message.stage !== currentGroup.stage) {
        if (currentGroup.messages.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { stage: message.stage, messages: [message] };
      } else {
        currentGroup.messages.push(message);
      }
    });

    if (currentGroup.messages.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  };

  const messageGroups = groupMessagesByStage(messages);

  const renderMessageContent = (content: string) => {
    try {
      // 基本的なMarkdownの安全性チェック
      if (!content || typeof content !== 'string') {
        return <span className="text-gray-400 italic">[Empty or invalid content]</span>;
      }
      
      // 安全なMarkdownのみを使用
      return (
        <ReactMarkdown
          remarkPlugins={[]}
          rehypePlugins={[]}
          components={{
            // 基本的なコンポーネントのみを許可
            p: ({ children }) => <p className="mb-3 text-gray-300">{children}</p>,
            h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-100 my-4 border-b border-gray-700 pb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold text-gray-100 my-3 border-b border-gray-700 pb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-bold text-gray-100 my-2">{children}</h3>,
            h4: ({ children }) => <h4 className="text-base font-bold text-gray-100 my-2">{children}</h4>,
            h5: ({ children }) => <h5 className="text-sm font-bold text-gray-100 my-1">{children}</h5>,
            h6: ({ children }) => <h6 className="text-xs font-bold text-gray-100 my-1">{children}</h6>,
            strong: ({ children }) => <strong className="font-bold text-gray-100">{children}</strong>,
            em: ({ children }) => <em className="italic text-gray-200">{children}</em>,
            code: ({ children }) => <code className="bg-gray-700 px-1 py-0.5 text-sm text-gray-100 rounded">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-900 p-4 overflow-x-auto text-sm text-gray-100 rounded mb-3">{children}</pre>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-gray-800">{children}</blockquote>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-4 text-gray-300">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-4 text-gray-300">{children}</ol>,
            li: ({ children }) => <li className="text-gray-300">{children}</li>,
            hr: () => <hr className="border-gray-700 my-4" />,
            br: () => <br />,
            // テーブル関連は無効化
            table: () => <div className="bg-gray-800 p-4 rounded mb-3 text-gray-300">[Table content]</div>,
            thead: () => null,
            tbody: () => null,
            tr: () => null,
            th: () => null,
            td: () => null,
            // その他の危険な要素も無効化
            a: () => <span className="text-blue-400">[Link]</span>,
            img: () => <span className="text-gray-400">[Image]</span>,
            // デフォルトの処理
            div: ({ children }) => <div className="text-gray-300">{children}</div>,
            span: ({ children }) => <span className="text-gray-300">{children}</span>
          }}
        >
          {content}
        </ReactMarkdown>
      );
    } catch (error) {
      console.error('[MessagesView] Error rendering markdown content:', error);
      // エラーが発生した場合はプレーンテキストとして表示
      return (
        <div className="whitespace-pre-wrap text-gray-100">
          {content}
        </div>
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900" ref={messagesContainerRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messageGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            {group.stage && (
              <div className={`p-3 ${getStageColor(group.stage)} rounded`}>
                <h3 className="font-medium text-gray-200">{getStageLabel(group.stage)}</h3>
              </div>
            )}
            {group.messages.map((message) => (
              <div
                key={message.id}
                className={`flex space-x-3 ${
                  message.role === 'user' ? 'justify-end flex-row-reverse' : 'justify-start'
                }`}
              >
                {message.role !== 'user' && (
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-800 flex items-center justify-center text-sm rounded">
                      {getAgentAvatar(message.agentId)}
                    </div>
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="flex-shrink-0 ml-2">
                    <div className="w-10 h-10 bg-blue-800 flex items-center justify-center text-sm rounded">
                      {getUserAvatar()}
                    </div>
                  </div>
                )}
                <div
                  className={`w-full mx-2 md:mx-16 lg:mx-32 px-4 py-3 
                    bg-gray-800 text-gray-100 rounded
                    ${message.role === 'user' ? 'border border-blue-700' : ''}
                    ${message.agentId === 'yuishin-001' ? 'border border-yellow-600' : (message.role !== 'user' ? 'border border-gray-700' : '')}
                  `}
                >
                  <div className="text-sm">
                    {message.role !== 'user' && (
                      <div className="font-medium text-gray-300 mb-2">
                        {getAgentName(message.agentId)}
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none">
                      {renderMessageContent(message.content ?? '')}
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessagesView; 