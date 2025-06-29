import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
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

  // カスタムコンポーネント
  const components = {
    // コードブロックのカスタマイズ
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <div className="relative">
          <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-400 bg-gray-800">
            {match[1]}
          </div>
          <pre className={`${className} bg-gray-900 p-4 overflow-x-auto`}>
            <code className="text-sm" {...props}>
              {children}
            </code>
          </pre>
        </div>
      ) : (
        <code className={`${className} bg-gray-700 px-1 py-0.5 text-sm`} {...props}>
          {children}
        </code>
      );
    },
    // テーブルのカスタマイズ
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-600">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="border border-gray-600 px-4 py-2 bg-gray-800 text-left font-medium">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-gray-600 px-4 py-2">
        {children}
      </td>
    ),
    // ブロッククォートのカスタマイズ
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-gray-800">
        {children}
      </blockquote>
    ),
    // リストのカスタマイズ
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-1 my-4">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-1 my-4">
        {children}
      </ol>
    ),
    // リンクのカスタマイズ
    a: ({ href, children }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline"
      >
        {children}
      </a>
    ),
    // 見出しのカスタマイズ
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold text-gray-100 my-4 border-b border-gray-700 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-bold text-gray-100 my-3 border-b border-gray-700 pb-1">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-bold text-gray-100 my-2">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-base font-bold text-gray-100 my-2">
        {children}
      </h4>
    ),
    // 水平線のカスタマイズ
    hr: () => (
      <hr className="border-gray-600 my-6" />
    ),
    // 強調のカスタマイズ
    strong: ({ children }: any) => (
      <strong className="font-bold text-gray-100">
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-200">
        {children}
      </em>
    ),
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
              <div className={`p-3 ${getStageColor(group.stage)}`}>
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
                    <div className="w-8 h-8 bg-gray-800 flex items-center justify-center text-sm">
                      {getAgentAvatar(message.agentId)}
                    </div>
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="flex-shrink-0 ml-2">
                    <div className="w-8 h-8 bg-blue-800 flex items-center justify-center text-sm">
                      {getUserAvatar()}
                    </div>
                  </div>
                )}
                <div
                  className={`w-full mx-2 md:mx-16 lg:mx-32 px-4 py-2 
                    bg-gray-800 text-gray-100
                    ${message.role === 'user' ? 'border border-blue-700' : ''}
                    ${message.agentId === 'yuishin-001' ? 'border border-yellow-600' : (message.role !== 'user' ? 'border border-gray-700' : '')}
                  `}
                >
                  <div className="text-sm">
                    {message.role !== 'user' && (
                      <div className="font-medium text-gray-300 mb-1">
                        {getAgentName(message.agentId)}
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-strong:text-gray-100 prose-em:text-gray-200 prose-code:text-gray-100 prose-pre:bg-gray-900 prose-blockquote:bg-gray-800 prose-blockquote:border-blue-500 prose-a:text-blue-400 prose-a:hover:text-blue-300">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm as any, remarkMath as any]}
                        rehypePlugins={[
                          rehypeKatex as any,
                          rehypeHighlight as any,
                          rehypeRaw as any,
                          rehypeSanitize as any
                        ]}
                        components={components}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
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