import React, { useState } from 'react';
import { X, Plus, Search, Trash2 } from 'lucide-react';
import { SavedPrompt, AutomationDefinition } from '../types';

interface PromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (content: string) => void;
  automations?: AutomationDefinition[];
  onRunAutomation?: (automation: AutomationDefinition) => void;
  onLoadAutomation?: (automation: AutomationDefinition) => void;
  availableTools?: string[];
}

const PromptLibrary: React.FC<PromptLibraryProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  automations = [],
  onRunAutomation,
  onLoadAutomation,
  availableTools = []
}) => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [search, setSearch] = useState('');
  const [newPrompt, setNewPrompt] = useState({ title: '', content: '' });
  const [activeTab, setActiveTab] = useState<'prompts' | 'automations'>('prompts');

  const addPrompt = () => {
    if (!newPrompt.title || !newPrompt.content) return;
    const prompt: SavedPrompt = {
      id: crypto.randomUUID(),
      title: newPrompt.title,
      content: newPrompt.content,
      createdAt: Date.now(),
      usageCount: 0
    };
    setPrompts([...prompts, prompt]);
    setNewPrompt({ title: '', content: '' });
  };

  const deletePrompt = (id: string) => {
    setPrompts(prompts.filter(p => p.id !== id));
  };

  const filtered = prompts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="neo-panel rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/70">
          <div>
            <h2 className="text-xl font-bold text-white">Prompt Library</h2>
            <p className="text-xs text-slate-400">Curated commands and automations</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800/60 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeTab === 'prompts'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800/60 hover:text-white'
              }`}
            >
              Prompts
            </button>
            <button
              onClick={() => setActiveTab('automations')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeTab === 'automations'
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800/60 hover:text-white'
              }`}
            >
              Automations
            </button>
          </div>

          {activeTab === 'prompts' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg neo-input"
                />
              </div>

              <div className="space-y-2 bg-slate-900/70 p-4 rounded-lg border border-slate-800/60">
                <input
                  type="text"
                  value={newPrompt.title}
                  onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                  placeholder="Prompt title..."
                  className="w-full px-3 py-2 rounded text-white text-sm neo-input"
                />
                <textarea
                  value={newPrompt.content}
                  onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                  placeholder="Prompt content..."
                  className="w-full px-3 py-2 rounded text-white text-sm resize-none neo-input"
                  rows={3}
                />
                <button
                  onClick={addPrompt}
                  className="w-full py-2 neo-button rounded text-white flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add Prompt
                </button>
              </div>

              <div className="space-y-2">
                {filtered.map(prompt => (
                  <div key={prompt.id} className="p-4 bg-slate-900/70 border border-slate-800/60 rounded-lg hover:bg-slate-800/70 transition group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => { onSelectPrompt(prompt.content); onClose(); }}>
                        <h3 className="font-semibold text-white">{prompt.title}</h3>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{prompt.content}</p>
                      </div>
                      <button
                        onClick={() => deletePrompt(prompt.id)}
                        className="p-2 text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'automations' && (
            <div className="space-y-3">
              {automations.length === 0 && (
                <div className="text-sm text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-lg p-4">
                  No automations configured yet.
                </div>
              )}
              {automations.map((automation) => {
                const missingTools = (automation.requiredTools || []).filter(t => !availableTools.includes(t));
                const canRun = missingTools.length === 0;
                return (
                  <div key={automation.id} className="p-4 bg-slate-900/70 border border-slate-800/60 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{automation.title}</h3>
                          {automation.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/40 text-cyan-200 border border-cyan-700/40">
                              {automation.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{automation.description}</p>
                        {(automation.requiredTools || []).length > 0 && (
                          <div className="mt-2 text-[10px] text-slate-500">
                            Needs: {(automation.requiredTools || []).join(', ')}
                          </div>
                        )}
                        {missingTools.length > 0 && (
                          <div className="mt-1 text-[10px] text-amber-300">
                            Missing tools: {missingTools.join(', ')} (Run disabled)
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            onLoadAutomation?.(automation);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded text-xs border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => onRunAutomation?.(automation)}
                          disabled={!canRun}
                          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                            canRun
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptLibrary;
