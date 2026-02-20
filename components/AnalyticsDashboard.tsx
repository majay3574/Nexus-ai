import React, { useMemo } from 'react';
import { X, TrendingUp, MessageSquare, Zap, Clock, BarChart3, PieChart } from 'lucide-react';
import { AgentConfig, Message, ChatState } from '../types';
import { estimateTokens } from '../lib/utils';

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentConfig[];
  messages: ChatState;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ isOpen, onClose, agents, messages }) => {
  const stats = useMemo(() => {
    const allMessages = Object.values(messages).flat();
    const totalMessages = allMessages.length;
    const totalTokens = allMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    
    const agentStats = agents.map(agent => {
      const agentMessages = messages[agent.id] || [];
      const tokens = agentMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      return {
        id: agent.id,
        name: agent.name,
        provider: agent.provider,
        model: agent.model,
        color: agent.color,
        messageCount: agentMessages.length,
        tokens,
        lastUsed: agentMessages.length > 0 ? agentMessages[agentMessages.length - 1].timestamp : 0
      };
    }).sort((a, b) => b.messageCount - a.messageCount);

    const providerStats = agents.reduce((acc, agent) => {
      const count = (messages[agent.id] || []).length;
      acc[agent.provider] = (acc[agent.provider] || 0) + count;
      return acc;
    }, {} as Record<string, number>);

    const modelStats = agents.reduce((acc, agent) => {
      const count = (messages[agent.id] || []).length;
      acc[agent.model] = (acc[agent.model] || 0) + count;
      return acc;
    }, {} as Record<string, number>);

    const today = new Date().setHours(0, 0, 0, 0);
    const todayMessages = allMessages.filter(m => m.timestamp >= today).length;
    const avgTokensPerMessage = totalMessages > 0 ? Math.round(totalTokens / totalMessages) : 0;

    return {
      totalMessages,
      totalTokens,
      todayMessages,
      avgTokensPerMessage,
      agentStats,
      providerStats,
      modelStats
    };
  }, [agents, messages]);

  if (!isOpen) return null;

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="neo-panel rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Analytics Dashboard</h2>
              <p className="text-sm text-slate-400">Track your AI usage and performance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800/60 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare size={20} className="text-blue-400" />
                <TrendingUp size={16} className="text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalMessages}</div>
              <div className="text-xs text-slate-400">Total Messages</div>
              <div className="text-xs text-blue-400 mt-1">{stats.todayMessages} today</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 border border-cyan-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <Zap size={20} className="text-cyan-400" />
                <TrendingUp size={16} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.totalTokens.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Total Tokens</div>
              <div className="text-xs text-cyan-300 mt-1">~${(stats.totalTokens * 0.000002).toFixed(4)} cost</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <Clock size={20} className="text-emerald-400" />
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{stats.avgTokensPerMessage}</div>
              <div className="text-xs text-slate-400">Avg Tokens/Message</div>
              <div className="text-xs text-emerald-400 mt-1">Efficiency metric</div>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-900/30 to-amber-900/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <PieChart size={20} className="text-amber-400" />
                <TrendingUp size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">{agents.length}</div>
              <div className="text-xs text-slate-400">Active Agents</div>
              <div className="text-xs text-amber-400 mt-1">{Object.keys(stats.providerStats).length} providers</div>
            </div>
          </div>

          {/* Agent Performance */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              Agent Performance
            </h3>
            <div className="space-y-3">
              {stats.agentStats.map((agent, index) => {
                const maxMessages = Math.max(...stats.agentStats.map(a => a.messageCount));
                const percentage = maxMessages > 0 ? (agent.messageCount / maxMessages) * 100 : 0;
                
                return (
                  <div key={agent.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">#{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full ${colorMap[agent.color || 'blue']}`}></div>
                        <span className="text-white font-medium">{agent.name}</span>
                        <span className="text-slate-500 text-xs">{agent.provider} / {agent.model}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">{agent.messageCount} msgs</span>
                        <span className="text-blue-400">{agent.tokens.toLocaleString()} tokens</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${colorMap[agent.color || 'blue']} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provider & Model Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Provider Distribution</h3>
              <div className="space-y-3">
                {Object.entries(stats.providerStats).map(([provider, count]) => {
                  const total = Object.values(stats.providerStats).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <div key={provider} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white capitalize">{provider}</span>
                        <span className="text-slate-400">{count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Model Usage</h3>
              <div className="space-y-3">
                {Object.entries(stats.modelStats).slice(0, 5).map(([model, count]) => {
                  const total = Object.values(stats.modelStats).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <div key={model} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white truncate">{model}</span>
                        <span className="text-slate-400">{count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
