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
  const [autoScroll, setAutoScroll] = useState(true);

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
      'mutual-reflection-summary': '📋 Mutual Reflection Summary',
      'conflict-resolution': '⚖️ Conflict Resolution',
      'conflict-resolution-summary': '📋 Conflict Resolution Summary',
      'synthesis-attempt': '🔗 Synthesis Attempt',
      'synthesis-attempt-summary': '📋 Synthesis Attempt Summary',
      'output-generation': '📤 Output Generation',
      'finalize': '✅ Finalize'
    };

    return stageLabels[stage] || stage;
  };

  const getStageColor = (stage?: DialogueStage) => {
    if (!stage) return 'bg-gray-900';
    const stageColors = {
      'individual-thought': 'bg-blue-900 border-blue-800 text-blue-100',
      'mutual-reflection': 'bg-green-900 border-green-800 text-green-100',
      'mutual-reflection-summary': 'bg-blue-900 border-blue-800 text-blue-100',
      'conflict-resolution': 'bg-yellow-900 border-yellow-800 text-yellow-100',
      'conflict-resolution-summary': 'bg-yellow-900 border-yellow-800 text-yellow-100',
      'synthesis-attempt': 'bg-purple-900 border-purple-800 text-purple-100',
      'synthesis-attempt-summary': 'bg-purple-900 border-purple-800 text-purple-100',
      'output-generation': 'bg-indigo-900 border-indigo-800 text-indigo-100',
      'finalize': 'bg-green-900 border-green-800 text-green-100'
    };
    return stageColors[stage] || 'bg-gray-900';
  };

  const getAgentColor = (agentId: string) => {
    const agent = session.agents.find(a => a.id === agentId);
    return agent?.color || '#ccc';
  };

  const groupMessagesByStage = (messages: Message[]) => {
    const groups: { stage?: DialogueStage; messages: Message[] }[] = [];
    let currentGroup: { stage?: DialogueStage; messages: Message[] } = { messages: [] };

    // すべてのメッセージを表示する（シーケンス番号によるフィルタリングを無効化）
    // All messages should be displayed regardless of their sequence number
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

  // ステージサマリーを表示する関数
  const renderStageSummary = (stage: DialogueStage) => {
    if (!session.stageSummaries) return null;
    
    const currentSequenceNumber = session.sequenceNumber || 1;
    const summary = session.stageSummaries.find(s => 
      s.stage === stage && s.sequenceNumber === currentSequenceNumber
    );
    if (!summary || summary.summary.length === 0) return null;

    return (
      <div className="bg-gray-800 border-l-4 border-blue-500 p-4 mb-4 rounded">
        <h4 className="text-sm font-semibold text-blue-300 mb-2">
          📋 {getStageLabel(stage)} - サマリー (Sequence {currentSequenceNumber})
        </h4>
        <div className="space-y-2">
          {summary.summary.map((item, index) => (
            <div key={index} className="text-sm text-gray-300">
              <span className="font-medium text-gray-200">• {item.speaker}:</span> {item.position}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // サマライズ結果をシステムメッセージとして表示する関数
  const renderSummarizeMessage = (stage: DialogueStage) => {
    if (!session.stageSummaries) return null;
    
    const currentSequenceNumber = session.sequenceNumber || 1;
    const summary = session.stageSummaries.find(s => 
      s.stage === stage && s.sequenceNumber === currentSequenceNumber
    );
    if (!summary || summary.summary.length === 0) return null;

    const summaryContent = summary.summary.map(item => 
      `**${item.speaker}**: ${item.position}`
    ).join('\n\n');

    const systemMessage: Message = {
      id: `summary-${stage}-${currentSequenceNumber}`,
      agentId: 'system',
      content: `## 📋 ${getStageLabel(stage)} - サマリー\n\n${summaryContent}`,
      timestamp: summary.timestamp,
      role: 'system',
      stage: stage
    };

    return (
      <div key={systemMessage.id} className="mb-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-sm">⚙️</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-gray-400">System</span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(systemMessage.timestamp)}
              </span>
            </div>
            <div className="bg-gray-800 border-l-4 border-blue-500 p-4 rounded">
              {renderMessageContent(systemMessage.content ?? '')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Agent ID をすべて名前に一括置換する関数
  const replaceAgentIdsWithNames = (content: string): string => {
    if (!content) return content;
    let replaced = content;
    session.agents.forEach(agent => {
      const regex = new RegExp(agent.id, 'g');
      replaced = replaced.replace(regex, agent.name);
    });
    return replaced;
  };

  const renderMessageContent = (content: string) => {
    try {
      // Agent ID を名前に置換
      const replacedContent = replaceAgentIdsWithNames(content);
      // 基本的なMarkdownの安全性チェック
      if (!replacedContent || typeof replacedContent !== 'string') {
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
            code: ({ children }) => <code className="bg-gray-700 px-1 py-0.5 text-sm text-gray-100 rounded overflow-x-auto whitespace-pre-wrap break-words">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-900 p-4 overflow-x-auto text-sm text-gray-100 rounded mb-3 whitespace-pre-wrap break-words">{children}</pre>,
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
          {replacedContent}
        </ReactMarkdown>
      );
    } catch (error) {
      console.error('[MessagesView] Error rendering markdown content:', error);
      // エラーが発生した場合はプレーンテキストとして表示
      const replacedContent = replaceAgentIdsWithNames(content);
      return (
        <div className="whitespace-pre-wrap text-gray-100">
          {replacedContent}
        </div>
      );
    }
  };

  // デバッグ用: session.sequenceOutputFilesの値をログ出力
  console.log('[MessagesView] session.sequenceOutputFiles:', session.sequenceOutputFiles);
  console.log('[MessagesView] session.outputFileName:', session.outputFileName);
  console.log('[MessagesView] session.sequenceOutputFiles keys:', session.sequenceOutputFiles ? Object.keys(session.sequenceOutputFiles) : 'undefined');
  console.log('[MessagesView] session.sequenceOutputFiles length:', session.sequenceOutputFiles ? Object.keys(session.sequenceOutputFiles).length : 0);

  // デバッグ用: メッセージとシーケンス番号のログ出力
  console.log('[MessagesView] session.sequenceNumber:', session.sequenceNumber);
  console.log('[MessagesView] messages count:', messages.length);
  console.log('[MessagesView] messages with sequence numbers:', messages.map(m => ({
    id: m.id,
    role: m.role,
    agentId: m.agentId,
    sequenceNumber: m.sequenceNumber,
    stage: m.stage
  })));
  console.log('[MessagesView] messages with sequenceNumber 2:', messages.filter(m => m.sequenceNumber === 2).map(m => ({
    id: m.id,
    role: m.role,
    agentId: m.agentId,
    content: m.content?.substring(0, 100) + '...'
  })));

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900" ref={messagesContainerRef} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No messages yet. Start a conversation!</p>
        </div>
      ) : (
        <>
          {messageGroups.map((group, groupIndex) => {
            const summary = session.stageSummaries?.find(s => s.stage === group.stage && s.sequenceNumber === (session.sequenceNumber || 1));
            return (
              <div key={groupIndex} className="space-y-3">
                {group.stage && (
                  <div className={`p-3 ${getStageColor(group.stage)} rounded`}>
                    <h3 className="font-medium text-gray-200">{getStageLabel(group.stage)}</h3>
                  </div>
                )}
                {group.messages.map((message) => {
                  // 表示用プロパティをrole/agentIdで切り替え
                  let avatar, name, nameColor, bubbleBorder, avatarBg, nameClass, nameStyle, bubbleBorderStyle, avatarBgStyle;
                  if (message.role === 'system') {
                    avatar = <span className="text-sm">⚙️</span>;
                    name = 'System';
                    nameColor = 'text-purple-300';
                    bubbleBorder = 'border-purple-500';
                    avatarBg = 'bg-purple-600';
                    nameClass = 'font-medium text-purple-300';
                  } else if (message.role === 'agent') {
                    avatar = getAgentAvatar(message.agentId);
                    name = getAgentName(message.agentId);
                    const agentColor = getAgentColor(message.agentId);
                    nameColor = '';
                    bubbleBorder = '';
                    avatarBg = '';
                    nameClass = 'font-medium';
                    nameStyle = { color: agentColor };
                    bubbleBorderStyle = { borderLeftColor: agentColor };
                    avatarBgStyle = { backgroundColor: agentColor };
                  } else if (message.role === 'user') {
                    avatar = getUserAvatar();
                    name = 'You';
                    nameColor = 'text-blue-300';
                    bubbleBorder = 'border-blue-700';
                    avatarBg = 'bg-blue-800';
                    nameClass = 'font-medium text-blue-300';
                  }
                  // バブルの色や枠線
                  let bubbleClass = `bg-gray-800 p-4 rounded prose prose-invert prose-sm max-w-none border-l-4 ${bubbleBorder}`;
                  // アバター背景
                  let avatarClass = `w-8 h-8 rounded-full flex items-center justify-center ${avatarBg}`;
                  // レイアウト（userは右寄せ、他は左寄せ）
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 mb-4 ${isUser ? 'flex-row-reverse justify-end' : 'justify-start'}`}
                    >
                      <div className="flex-shrink-0">
                        <div className={avatarClass} style={avatarBgStyle}>{avatar}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center mb-2 ${isUser ? 'flex-row-reverse justify-end space-x-reverse space-x-2' : 'space-x-2'}`}> 
                          <span className={`text-sm ${nameClass} ${isUser ? 'text-right' : ''}`} style={nameStyle}>{name}</span>
                          <span className={`text-xs text-gray-500 ${isUser ? 'text-right' : ''}`}>{formatTimestamp(message.timestamp)}</span>
                        </div>
                        <div className={bubbleClass} style={bubbleBorderStyle}>
                          {renderMessageContent(message.content ?? '')}
                          {/* 投票情報 */}
                          {message.metadata?.voteFor && (
                            <div className="mt-2 space-y-1">
                              <div className="inline-block px-2 py-1 rounded bg-indigo-700 text-xs text-white font-semibold">
                                投票: {getAgentName(message.metadata.voteFor)}
                              </div>
                              {message.metadata.voteReasoning && (
                                <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                                  <strong>理由:</strong> {message.metadata.voteReasoning}
                                </div>
                              )}
                              {message.metadata.voteSection && !message.metadata.voteReasoning && (
                                <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                                  <strong>投票内容:</strong> {message.metadata.voteSection}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* サマリー表示を無効化 */}
                {/* {summary && summary.summary.length > 0 && group.stage && renderSummarizeMessage(group.stage)} */}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default MessagesView; 