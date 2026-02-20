import React, { useState, useEffect } from 'react';
import { AgentConfig, ModelType, AIProvider, AppSettings } from '../types';
import { X, Save, RefreshCw, Globe, Search, MonitorPlay, Trash2 } from 'lucide-react';
import { fetchGroqModels, fetchLocalModels, pullLocalModel } from '../services/aiService';

interface AgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: AgentConfig) => void;
  onDelete?: (agent: AgentConfig) => void;
  initialAgent?: AgentConfig;
  settings: AppSettings;
}

const COLORS = ['blue', 'purple', 'emerald', 'amber', 'rose', 'cyan'];

const PROVIDERS: { id: AIProvider; name: string }[] = [
  { id: 'google', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'groq', name: 'Groq' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'xai', name: 'xAI (Grok)' },
  { id: 'local', name: 'Local (Ollama)' },
];

const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  google: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash-latest'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  xai: ['grok-2-latest', 'grok-beta'],
  local: ['llama3.2', 'llama3', 'mistral', 'qwen2.5'],
};

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({ isOpen, onClose, onSave, onDelete, initialAgent, settings }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [provider, setProvider] = useState<AIProvider>('google');
  const [model, setModel] = useState<string>(ModelType.FLASH);
  const [color, setColor] = useState('blue');
  const [tools, setTools] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<string>('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localPullName, setLocalPullName] = useState('');
  const [localPulling, setLocalPulling] = useState(false);

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    cyan: 'bg-cyan-500',
  };

  useEffect(() => {
    if (isOpen) {
      if (initialAgent) {
        setName(initialAgent.name);
        setDescription(initialAgent.description);
        setSystemInstruction(initialAgent.systemInstruction);
        setProvider(initialAgent.provider || 'google');
        setModel(initialAgent.model);
        setColor(initialAgent.color || 'blue');
        setTools(initialAgent.tools || []);
      } else {
        setName('');
        setDescription('');
        setSystemInstruction('');
        setProvider('google');
        setModel(ModelType.FLASH);
        setColor('blue');
        setTools([]);
      }
    }
  }, [isOpen, initialAgent]);

  // Handle Model Lists
  useEffect(() => {
    const loadModels = async () => {
      if (provider === 'groq' && settings.groqApiKey) {
        setLoadingModels(true);
        const fetched = await fetchGroqModels(settings.groqApiKey);
        setLoadingModels(false);
        if (fetched.length > 0) {
           setAvailableModels(fetched);
           return;
        }
      }
      setAvailableModels(DEFAULT_MODELS[provider] || []);
      if (provider === 'local') {
        const looksRemote = /^(gemini|gpt-|claude|o1|grok|mixtral|llama-)/i.test(model || '');
        if (!model || looksRemote) {
          setModel(DEFAULT_MODELS.local[0]);
        }
      }
    };
    loadModels();
  }, [provider, settings.groqApiKey]);

  const refreshLocalModels = async () => {
    setLocalLoading(true);
    setLocalStatus('Checking Ollama models...');
    try {
      const models = await fetchLocalModels(settings.localBaseUrl);
      setLocalModels(models);
      if (models.length === 0) {
        setLocalStatus('No Ollama models found on this system.');
      } else {
        setLocalStatus(`Found ${models.length} model(s).`);
      }
    } catch (e: any) {
      setLocalModels([]);
      setLocalStatus(e?.message || 'Failed to load Ollama models.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handlePullLocalModel = async () => {
    if (!localPullName.trim()) return;
    setLocalPulling(true);
    setLocalStatus('Downloading model...');
    try {
      const result = await pullLocalModel(settings.localBaseUrl, localPullName);
      setLocalStatus(result.status || 'Download started.');
      await refreshLocalModels();
    } catch (e: any) {
      setLocalStatus(e?.message || 'Failed to download model.');
    } finally {
      setLocalPulling(false);
    }
  };

  useEffect(() => {
    if (isOpen && provider === 'local') {
      refreshLocalModels();
    }
  }, [isOpen, provider, settings.localBaseUrl]);

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(model) && provider !== 'local') {
      setModel(availableModels[0]);
    }
  }, [availableModels, model]);

  const toggleTool = (tool: string) => {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialAgent?.id || crypto.randomUUID(),
      name: name || 'New Agent',
      description: description || 'Custom AI Agent',
      systemInstruction,
      provider,
      model,
      color,
      avatarUrl: initialAgent?.avatarUrl,
      tools
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="neo-panel rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">
              {initialAgent ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">Configure your AI persona's behavior and capability.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coding Wizard"
                className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short purpose of this agent"
                className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-300 uppercase">System Instruction</label>
             <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder="You are an expert in... You should always answer with..."
                className="w-full h-32 rounded-lg px-4 py-3 text-white neo-input focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all resize-none placeholder-slate-500 font-mono text-sm"
                required
              />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Provider Selection */}
            <div className="space-y-2">
               <label className="text-xs font-semibold text-slate-300 uppercase">AI Provider</label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {PROVIDERS.map((p) => (
                   <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      provider === p.id 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                   >
                     {p.name}
                   </button>
                 ))}
               </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
               <label className="text-xs font-semibold text-slate-300 uppercase flex items-center justify-between">
                 <span>Model</span>
                 {loadingModels && <RefreshCw size={12} className="animate-spin text-blue-400"/>}
               </label>
               {provider === 'local' ? (
                 <div className="space-y-2">
                   <input
                     type="text"
                     value={model}
                     onChange={(e) => setModel(e.target.value)}
                     placeholder="e.g. llama3.2"
                     list="ollama-models"
                     className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-cyan-500 outline-none"
                   />
                   <datalist id="ollama-models">
                     {localModels.map((m) => (
                       <option key={m} value={m} />
                     ))}
                   </datalist>
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={refreshLocalModels}
                       disabled={localLoading}
                       className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                         localLoading
                           ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                           : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white hover:border-slate-500'
                       }`}
                     >
                       {localLoading ? 'Refreshing...' : 'Refresh Models'}
                     </button>
                     <span className="text-[10px] text-slate-500">
                       {localStatus || 'Uses local Ollama models on your system.'}
                     </span>
                   </div>
                   {localModels.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                       {localModels.map((m) => (
                         <button
                           key={m}
                           type="button"
                           onClick={() => setModel(m)}
                           className={`px-2.5 py-1 rounded-full text-[10px] border transition-colors ${
                             model === m
                               ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                               : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                           }`}
                         >
                           {m}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               ) : (
                 <select
                   value={model}
                   onChange={(e) => setModel(e.target.value)}
                 className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-cyan-500 outline-none"
                 >
                   {availableModels.map(m => (
                     <option key={m} value={m}>{m}</option>
                   ))}
                 </select>
               )}
               {provider === 'groq' && !settings.groqApiKey && (
                 <p className="text-[10px] text-orange-400">Add Groq API Key in settings to see all models.</p>
               )}
               {provider === 'local' && (
                 <p className="text-[10px] text-slate-400">Make sure the model name matches your local Ollama model (e.g. llama3.2).</p>
               )}
            </div>

            {provider === 'local' && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 uppercase">Download Model (Ollama)</label>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    value={localPullName}
                    onChange={(e) => setLocalPullName(e.target.value)}
                    placeholder="e.g. llama3.2 or qwen2.5:7b"
                    className="flex-1 rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePullLocalModel}
                    disabled={!localPullName.trim() || localPulling}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      !localPullName.trim() || localPulling
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                    }`}
                  >
                    {localPulling ? 'Downloading...' : 'Download'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Requires Ollama running locally. If this fails due to CORS, run the backend server with <code>npm run dev:all</code>.
                </p>
              </div>
            )}

            {/* MCP / Capabilities */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
                <span>Capabilities (Tools)</span>
              </label>
              <div className="bg-slate-900/70 border border-slate-800/60 rounded-lg p-3 space-y-2">
                
                {/* Google Search Tool */}
                <div 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    provider === 'google' 
                    ? (tools.includes('googleSearch') ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-700 hover:border-slate-600')
                    : 'opacity-50 cursor-not-allowed border-slate-800'
                  }`}
                  onClick={() => provider === 'google' && toggleTool('googleSearch')}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-md text-blue-400">
                      <Search size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Google Search Grounding</div>
                      <div className="text-xs text-slate-400">Allows agent to browse web for real-time info.</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                     tools.includes('googleSearch') ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                  }`}>
                    {tools.includes('googleSearch') && <Search size={12} className="text-white" />}
                  </div>
                </div>

                {/* Browser MCP Tool */}
                <div 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    provider === 'google' 
                    ? (tools.includes('browser') ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-slate-700 hover:border-slate-600')
                    : 'opacity-50 cursor-not-allowed border-slate-800'
                  }`}
                  onClick={() => provider === 'google' && toggleTool('browser')}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-500/20 p-2 rounded-md text-purple-400">
                      <MonitorPlay size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Browser Control (MCP)</div>
                      <div className="text-xs text-slate-400">Visit websites and read content via Function Calling.</div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                     tools.includes('browser') ? 'bg-purple-600 border-purple-600' : 'border-slate-600'
                  }`}>
                    {tools.includes('browser') && <Search size={12} className="text-white" />}
                  </div>
                </div>

                {/* Placeholder for Gmail */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/30 opacity-60">
                   <div className="flex items-center gap-3">
                    <div className="bg-red-500/10 p-2 rounded-md text-red-400">
                      <Globe size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-300">Gmail Integration</div>
                      <div className="text-xs text-slate-500">Read & Draft emails (Coming Soon)</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded text-slate-500">WIP</div>
                </div>

              </div>
              {provider !== 'google' && (
                <p className="text-[10px] text-amber-500 mt-1">
                  * Tools are currently optimized for Google Gemini models.
                </p>
              )}
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 uppercase">Theme Color</label>
              <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-800/60 rounded-lg p-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                      color === c ? 'ring-2 ring-white scale-110' : ''
                    } ${colorClasses[c]}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

          </div>
          
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800">
             {initialAgent && onDelete ? (
               <button
                 type="button"
                 onClick={() => onDelete(initialAgent)}
                 className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors flex items-center gap-2"
               >
                 <Trash2 size={14} />
                 Delete Agent
               </button>
             ) : (
               <div />
             )}
             <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
               <button
                 type="button"
                 onClick={onClose}
                 className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
               >
                 Cancel
               </button>
               <button
                 type="submit"
                 className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]"
               >
                 <Save size={16} />
                 Save Agent
               </button>
             </div>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AgentConfigModal;
