import React, { useState, useEffect } from 'react';
import { X, Save, Key, Globe, Lock, Server, RefreshCw } from 'lucide-react';
import { AppSettings } from '../types';
import { fetchLocalModels, pullLocalModel } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [keys, setKeys] = useState<AppSettings>({});
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<string>('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localPullName, setLocalPullName] = useState('');
  const [localPulling, setLocalPulling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(settings);
    }
  }, [isOpen, settings]);

  const refreshLocalModels = async (baseUrl?: string) => {
    setLocalLoading(true);
    setLocalStatus('Checking Ollama models...');
    try {
      const models = await fetchLocalModels(baseUrl);
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
      const result = await pullLocalModel(keys.localBaseUrl, localPullName);
      setLocalStatus(result.status || 'Download started.');
      await refreshLocalModels(keys.localBaseUrl);
    } catch (e: any) {
      setLocalStatus(e?.message || 'Failed to download model.');
    } finally {
      setLocalPulling(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLocalModels(settings.localBaseUrl);
    }
  }, [isOpen, settings.localBaseUrl]);

  if (!isOpen) return null;

  const handleChange = (k: keyof AppSettings, value: string) => {
    setKeys(prev => ({ ...prev, [k]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(keys);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="neo-panel rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
               <Key size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">API Settings</h2>
              <p className="text-sm text-slate-400">Manage your provider access keys</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800/60 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Google */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
              <Globe size={14} className="text-blue-400"/> Google Gemini API Key
            </label>
            <input
              type="password"
              value={keys.googleApiKey || ''}
              onChange={(e) => handleChange('googleApiKey', e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-600"
            />
            <p className="text-[10px] text-slate-500">
              Leave blank to use the default environment key if configured.
            </p>
          </div>

          {/* OpenAI */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
               <Globe size={14} className="text-green-400"/> OpenAI API Key
             </label>
             <input
               type="password"
               value={keys.openaiApiKey || ''}
               onChange={(e) => handleChange('openaiApiKey', e.target.value)}
               placeholder="sk-..."
               className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-green-500 outline-none transition-all placeholder-slate-600"
             />
          </div>

          {/* Groq */}
          <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
               <Globe size={14} className="text-orange-400"/> Groq API Key
             </label>
             <input
               type="password"
               value={keys.groqApiKey || ''}
               onChange={(e) => handleChange('groqApiKey', e.target.value)}
               placeholder="gsk_..."
               className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder-slate-600"
             />
             <p className="text-[10px] text-slate-500">
               Required to automatically fetch available Groq models.
             </p>
          </div>

           {/* Anthropic */}
           <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
               <Globe size={14} className="text-purple-400"/> Anthropic API Key
             </label>
             <input
               type="password"
               value={keys.anthropicApiKey || ''}
               onChange={(e) => handleChange('anthropicApiKey', e.target.value)}
               placeholder="sk-ant-..."
               className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder-slate-600"
             />
             <p className="text-[10px] text-amber-500 flex items-center gap-1">
               <Lock size={10} /> Note: Anthropic may block browser requests without a proxy.
             </p>
          </div>

          {/* xAI */}
           <div className="space-y-2">
             <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
               <Globe size={14} className="text-white"/> xAI (Grok) API Key
             </label>
             <input
               type="password"
               value={keys.xaiApiKey || ''}
               onChange={(e) => handleChange('xaiApiKey', e.target.value)}
               placeholder="xai-..."
               className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-slate-500 outline-none transition-all placeholder-slate-600"
             />
           </div>

          {/* Local / Ollama */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
              <Server size={14} className="text-emerald-400"/> Local (Ollama) Base URL
            </label>
            <input
              type="text"
              value={keys.localBaseUrl || ''}
              onChange={(e) => handleChange('localBaseUrl', e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-600"
            />
            <p className="text-[10px] text-slate-500">
              We will automatically add <code>/v1</code> for OpenAI-compatible APIs.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
              <Server size={14} className="text-emerald-400"/> Local API Key (Optional)
            </label>
            <input
              type="password"
              value={keys.localApiKey || ''}
              onChange={(e) => handleChange('localApiKey', e.target.value)}
              placeholder="(optional)"
              className="w-full rounded-lg px-4 py-2.5 text-white neo-input focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-slate-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
              <Server size={14} className="text-emerald-400"/> Local Models
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refreshLocalModels(keys.localBaseUrl)}
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
                  <span
                    key={m}
                    className="px-2.5 py-1 rounded-full text-[10px] border bg-slate-800 border-slate-700 text-slate-400"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase flex items-center gap-2">
              <Server size={14} className="text-emerald-400"/> Download Model (Ollama)
            </label>
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

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
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
               Save Settings
             </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
