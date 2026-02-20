import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { User, Bot, Copy, Check, Globe, ExternalLink, Volume2, VolumeX, ThumbsUp, ThumbsDown, Lightbulb } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  agentColor?: string;
  onSpeak?: (message: Message) => void;
  isSpeaking?: boolean;
  onReaction?: (messageId: string, reaction: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, agentColor = 'blue', onSpeak, isSpeaking, onReaction }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);
  const [userReaction, setUserReaction] = React.useState<string | null>(() => {
    const stored = localStorage.getItem(`reaction-${message.id}`);
    return stored || null;
  });

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-900/40 text-blue-400 ring-blue-500/30',
    purple: 'bg-purple-900/40 text-purple-400 ring-purple-500/30',
    emerald: 'bg-emerald-900/40 text-emerald-400 ring-emerald-500/30',
    amber: 'bg-amber-900/40 text-amber-400 ring-amber-500/30',
    rose: 'bg-rose-900/40 text-rose-400 ring-rose-500/30',
    cyan: 'bg-cyan-900/40 text-cyan-400 ring-cyan-500/30',
  };

  const avatarClass = colorMap[agentColor] || colorMap.blue;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReaction = (reaction: string) => {
    const newReaction = userReaction === reaction ? null : reaction;
    setUserReaction(newReaction);
    localStorage.setItem(`reaction-${message.id}`, newReaction || '');
    onReaction?.(message.id, newReaction || '');
  };

  const citations = message.groundingMetadata?.groundingChunks?.filter(c => c.web);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-lg ring-1 transition-transform duration-200 hover:scale-110
          ${isUser ? 'bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-900 shadow-emerald-500/40' : `${avatarClass} shadow-blue-500/30`}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 max-w-full animate-slideIn`}>
          <div className={`group relative px-5 py-3.5 rounded-2xl shadow-lg text-sm leading-relaxed overflow-hidden transition-all duration-200 hover:shadow-xl
            ${isUser 
              ? 'bubble-user text-slate-50 rounded-br-none' 
              : 'bubble-bot text-slate-200 rounded-bl-none backdrop-blur-sm'
            } ${message.isError ? 'bubble-error' : ''}`}>
            
            <div className={`prose prose-invert prose-sm max-w-none break-words ${!isUser && message.id === 'streaming' ? 'typing-effect' : ''}`}>
              {message.isError ? (
                 <span className="text-red-300 flex items-center gap-2">
                   Warning: {message.content}
                 </span>
              ) : (
                <ReactMarkdown 
                  components={{
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const inline = !match;
                      return !inline ? (
                        <div className="relative my-4 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                             <span className="text-xs text-slate-400 font-mono">{match[1]}</span>
                          </div>
                          <pre className="p-3 overflow-x-auto">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-cyan-200 font-mono text-xs" {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>

            {!isUser && !message.isError && (
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onSpeak && (
                  <button 
                    onClick={() => onSpeak(message)}
                    className="p-1.5 rounded bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white transition"
                    title={isSpeaking ? "Stop speaking" : "Speak message"}
                  >
                    {isSpeaking ? <VolumeX size={14} className="text-amber-300" /> : <Volume2 size={14} />}
                  </button>
                )}
                <button 
                  onClick={copyToClipboard}
                  className="p-1.5 rounded bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white transition"
                  title="Copy message"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            )}
            
            <div className={`text-[10px] mt-2 opacity-50 ${isUser ? 'text-indigo-200' : 'text-slate-500'}`}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Reaction Buttons */}
          {!isUser && !message.isError && (
            <div className="ml-2 flex gap-1 opacity-60 hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => handleReaction('helpful')}
                className={`p-1.5 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                  userReaction === 'helpful'
                    ? 'bg-green-600/40 text-green-400 shadow-lg shadow-green-500/20'
                    : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-green-400'
                }`}
                title="Helpful"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => handleReaction('not-helpful')}
                className={`p-1.5 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                  userReaction === 'not-helpful'
                    ? 'bg-red-600/40 text-red-300 shadow-lg shadow-red-500/20'
                    : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-red-300'
                }`}
                title="Not Helpful"
              >
                <ThumbsDown size={14} />
              </button>
              <button
                onClick={() => handleReaction('insightful')}
                className={`p-1.5 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                  userReaction === 'insightful'
                    ? 'bg-yellow-600/40 text-yellow-400 shadow-lg shadow-yellow-500/20'
                    : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60 hover:text-yellow-400'
                }`}
                title="Insightful"
              >
                <Lightbulb size={14} />
              </button>
            </div>
          )}

          {/* Search Citations (Grounding) */}
          {!isUser && citations && citations.length > 0 && (
            <div className="ml-2 flex flex-wrap gap-2 animate-fadeIn">
              {citations.map((chunk, i) => (
                <a 
                  key={i}
                  href={chunk.web?.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 neo-chip hover:bg-slate-800/80 rounded-full text-xs text-slate-300 hover:text-cyan-200 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-lg group"
                >
                  <Globe size={10} className="text-blue-500" />
                  <span className="max-w-[150px] truncate">{chunk.web?.title || 'Source'}</span>
                  <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
