import React from 'react';
import { AgentConfig } from '../types';
import { Plus, Bot, Settings, Settings2, Search, MonitorPlay, Users } from 'lucide-react';

interface SidebarProps {
  agents: AgentConfig[];
  currentAgentId: string;
  onSelectAgent: (id: string) => void;
  onAddAgent: () => void;
  onEditAgent: (agent: AgentConfig) => void;
  onOpenSettings: () => void;
  onOpenConversation: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  agents, 
  currentAgentId, 
  onSelectAgent, 
  onAddAgent,
  onEditAgent,
  onOpenSettings,
  onOpenConversation
}) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-900/30 text-blue-400 ring-blue-500/20',
    purple: 'bg-purple-900/30 text-purple-400 ring-purple-500/20',
    emerald: 'bg-emerald-900/30 text-emerald-400 ring-emerald-500/20',
    amber: 'bg-amber-900/30 text-amber-400 ring-amber-500/20',
    rose: 'bg-rose-900/30 text-rose-400 ring-rose-500/20',
    cyan: 'bg-cyan-900/30 text-cyan-400 ring-cyan-500/20',
  };
  return (
    <div className="w-72 sm:w-80 h-full flex flex-col glass-panel border-r border-slate-700/40">
      <div className="p-6 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-300">
          <div className="w-9 h-9 rounded-full flex items-center justify-center badge-orbit animate-float">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Nexus Agent Studio</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em]">Signal Core</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
          Your Agents
        </div>
        
        {agents.map((agent) => {
          const isActive = agent.id === currentAgentId;
          const hasSearch = agent.tools?.includes('googleSearch');
          const hasBrowser = agent.tools?.includes('browser');
          
          return (
            <div
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                isActive 
                  ? 'bg-slate-800/80 border-emerald-500/40 shadow-lg shadow-emerald-900/10' 
                  : 'hover:bg-slate-800/50 border-transparent hover:border-slate-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 relative ${colorMap[agent.color || 'blue'] || colorMap.blue}`}>
                 {agent.avatarUrl ? (
                   <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                 ) : (
                   <Bot size={20} />
                 )}
                 {hasSearch && !hasBrowser && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 border-2 border-slate-900" title="Web Search Enabled">
                      <Search size={8} />
                    </div>
                 )}
                 {hasBrowser && (
                    <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-0.5 border-2 border-slate-900" title="Browser Control Enabled">
                      <MonitorPlay size={8} />
                    </div>
                 )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-slate-200'}`}>
                    {agent.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {agent.provider} - {agent.model}
                </p>
              </div>
              
              {isActive && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAgent(agent);
                  }}
                  className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Configure Agent"
                >
                  <Settings size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-700/50 flex flex-col gap-2">
        <button
          onClick={onAddAgent}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg neo-button font-medium transition-all duration-200 active:scale-[0.98]"
        >
          <Plus size={18} />
          <span>New Agent</span>
        </button>
        <button
          onClick={onOpenConversation}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg neo-button-secondary font-medium transition-colors"
          title="Start agent-to-agent conversation"
        >
          <Users size={16} />
          <span>Agent Chat</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg neo-button-ghost hover:bg-slate-800/60 text-slate-300 font-medium transition-colors"
        >
          <Settings2 size={16} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
