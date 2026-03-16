import React, { useEffect, useState } from 'react';
import { X, Plus, Search, Trash2, Sparkles, Save } from 'lucide-react';
import { SavedPrompt, AutomationDefinition, AppSettings, AgentConfig } from '../types';
import { streamAIResponse } from '../services/aiService';

interface PromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (content: string) => void;
  automations?: AutomationDefinition[];
  onRunAutomation?: (automation: AutomationDefinition) => void;
  onLoadAutomation?: (automation: AutomationDefinition) => void;
  availableTools?: string[];
  settings: AppSettings;
  agent?: AgentConfig;
}

const PromptLibrary: React.FC<PromptLibraryProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  automations = [],
  onRunAutomation,
  onLoadAutomation,
  availableTools = [],
  settings,
  agent
}) => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [search, setSearch] = useState('');
  const [newPrompt, setNewPrompt] = useState({ title: '', content: '', category: '', tags: '' });
  const [activeTab, setActiveTab] = useState<'prompts' | 'automations' | 'compose'>('prompts');
  const [sortBy, setSortBy] = useState<'recent' | 'usage'>('recent');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [composeGoal, setComposeGoal] = useState('');
  const [composeContext, setComposeContext] = useState('');
  const [composeConstraints, setComposeConstraints] = useState('');
  const [composeTone, setComposeTone] = useState('Clear, concise, and actionable');
  const [composeOutput, setComposeOutput] = useState('');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState('');

  const STORAGE_KEY = 'nexus_prompt_library';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPrompts(parsed);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
    } catch (e) {}
  }, [prompts]);

  const addPrompt = () => {
    if (!newPrompt.title || !newPrompt.content) return;
    const tags = newPrompt.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const prompt: SavedPrompt = {
      id: crypto.randomUUID(),
      title: newPrompt.title,
      content: newPrompt.content,
      category: newPrompt.category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      createdAt: Date.now(),
      usageCount: 0
    };
    setPrompts([...prompts, prompt]);
    setNewPrompt({ title: '', content: '', category: '', tags: '' });
  };

  const deletePrompt = (id: string) => {
    setPrompts(prompts.filter(p => p.id !== id));
  };

  const searchLower = search.toLowerCase();
  const filtered = prompts.filter(p => {
    const haystack = [
      p.title,
      p.content,
      p.category || '',
      (p.tags || []).join(' ')
    ].join(' ').toLowerCase();
    return haystack.includes(searchLower);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'usage') {
      return (b.usageCount || 0) - (a.usageCount || 0);
    }
    return b.createdAt - a.createdAt;
  });

  const handleUsePrompt = (prompt: SavedPrompt) => {
    onSelectPrompt(prompt.content);
    setPrompts(prev => prev.map(p => (
      p.id === prompt.id
        ? { ...p, usageCount: (p.usageCount || 0) + 1 }
        : p
    )));
    onClose();
  };

  const handleCopyPrompt = async (prompt: SavedPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedId(prompt.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch (e) {}
  };

  const buildComposePrompt = () => {
    const parts = [
      `Goal: ${composeGoal || 'N/A'}`,
      composeContext ? `Context: ${composeContext}` : '',
      composeConstraints ? `Constraints: ${composeConstraints}` : '',
      composeTone ? `Tone/Style: ${composeTone}` : '',
      'Output: Provide a single, ready-to-use prompt. Use placeholders like {{input}} when needed.'
    ].filter(Boolean);
    return parts.join('\n');
  };

  const handleCompose = async () => {
    if (!composeGoal.trim()) {
      setComposeError('Please describe the goal for the prompt.');
      return;
    }
    if (!agent) {
      setComposeError('No active agent available for smart compose.');
      return;
    }
    setComposeLoading(true);
    setComposeError('');
    setComposeOutput('');

    const systemInstruction = [
      'You are a prompt engineer.',
      'Return only the final prompt, with no explanations.',
      'Make it structured, with short sections if helpful.',
      'Use placeholders in {{braces}} for user inputs.'
    ].join(' ');

    try {
      await streamAIResponse(
        agent.provider,
        agent.model,
        systemInstruction,
        [],
        buildComposePrompt(),
        settings,
        [],
        (chunk) => {
          setComposeOutput(prev => prev + chunk);
        }
      );
    } catch (e: any) {
      const message = e?.message || 'Failed to generate prompt.';
      setComposeError(message);
    } finally {
      setComposeLoading(false);
    }
  };

  const handleSaveComposed = () => {
    if (!composeTitle.trim() || !composeOutput.trim()) return;
    const prompt: SavedPrompt = {
      id: crypto.randomUUID(),
      title: composeTitle.trim(),
      content: composeOutput.trim(),
      createdAt: Date.now(),
      usageCount: 0,
      category: 'AI Composed',
      tags: ['smart-compose']
    };
    setPrompts(prev => [prompt, ...prev]);
    setComposeTitle('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="neo-panel rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800/70">
          <div>
            <h2 className="text-xl font-bold text-white">Prompt Library</h2>
            <p className="text-xs text-slate-400">Curated commands and automations</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800/60 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
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
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeTab === 'compose'
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800/60 hover:text-white'
              }`}
            >
              Smart Compose
            </button>
          </div>

          {activeTab === 'prompts' && (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg neo-input"
                />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'usage')}
                  className="px-3 py-2 rounded-lg neo-input text-sm text-slate-200"
                >
                  <option value="recent">Newest</option>
                  <option value="usage">Most used</option>
                </select>
              </div>

              <div className="space-y-2 bg-slate-900/70 p-4 rounded-lg border border-slate-800/60">
                <input
                  type="text"
                  value={newPrompt.title}
                  onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                  placeholder="Prompt title..."
                  className="w-full px-3 py-2 rounded text-white text-sm neo-input"
                />
                <input
                  type="text"
                  value={newPrompt.category}
                  onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
                  placeholder="Category (optional)"
                  className="w-full px-3 py-2 rounded text-white text-sm neo-input"
                />
                <input
                  type="text"
                  value={newPrompt.tags}
                  onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })}
                  placeholder="Tags (comma separated)"
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
                {sorted.map(prompt => (
                  <div key={prompt.id} className="p-4 bg-slate-900/70 border border-slate-800/60 rounded-lg hover:bg-slate-800/70 transition group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{prompt.title}</h3>
                          {prompt.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                              {prompt.category}
                            </span>
                          )}
                          {typeof prompt.usageCount === 'number' && prompt.usageCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-700/30 text-emerald-200">
                              {prompt.usageCount} uses
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{prompt.content}</p>
                        {prompt.tags && prompt.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {prompt.tags.map(tag => (
                              <span
                                key={`${prompt.id}-${tag}`}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleUsePrompt(prompt)}
                          className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleCopyPrompt(prompt)}
                          className="px-3 py-1.5 rounded text-xs border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
                        >
                          {copiedId === prompt.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => deletePrompt(prompt.id)}
                          className="px-3 py-1.5 rounded text-xs border border-red-500/40 text-red-300 hover:bg-red-900/20 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

          {activeTab === 'compose' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
                  <Sparkles size={16} />
                  Smart Compose (AI)
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Uses the current agent: {agent ? `${agent.provider} / ${agent.model}` : 'No agent selected'}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Goal</label>
                  <textarea
                    value={composeGoal}
                    onChange={(e) => setComposeGoal(e.target.value)}
                    placeholder="Describe the task the prompt should achieve..."
                    className="w-full px-3 py-2 rounded text-white text-sm resize-none neo-input"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Context (optional)</label>
                  <textarea
                    value={composeContext}
                    onChange={(e) => setComposeContext(e.target.value)}
                    placeholder="Add background, data sources, or constraints..."
                    className="w-full px-3 py-2 rounded text-white text-sm resize-none neo-input"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Constraints (optional)</label>
                  <textarea
                    value={composeConstraints}
                    onChange={(e) => setComposeConstraints(e.target.value)}
                    placeholder="e.g., word limit, format, safety rules..."
                    className="w-full px-3 py-2 rounded text-white text-sm resize-none neo-input"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Tone / Style</label>
                  <input
                    type="text"
                    value={composeTone}
                    onChange={(e) => setComposeTone(e.target.value)}
                    placeholder="Clear, concise, and actionable"
                    className="w-full px-3 py-2 rounded text-white text-sm neo-input"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCompose}
                  disabled={composeLoading}
                  className={`px-4 py-2 rounded text-sm font-semibold transition ${
                    composeLoading
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-amber-600 text-white hover:bg-amber-500'
                  }`}
                >
                  {composeLoading ? 'Generating...' : 'Generate Prompt'}
                </button>
                <button
                  onClick={() => {
                    setComposeGoal('');
                    setComposeContext('');
                    setComposeConstraints('');
                    setComposeOutput('');
                    setComposeError('');
                  }}
                  className="px-4 py-2 rounded text-sm border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/70 transition"
                >
                  Reset
                </button>
              </div>

              {composeError && (
                <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  {composeError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Generated Prompt</label>
                <textarea
                  value={composeOutput}
                  onChange={(e) => setComposeOutput(e.target.value)}
                  placeholder="Your AI-generated prompt will appear here..."
                  className="w-full px-3 py-2 rounded text-white text-sm resize-none neo-input"
                  rows={6}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input
                  type="text"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder="Title to save (optional)"
                  className="flex-1 px-3 py-2 rounded text-white text-sm neo-input"
                />
                <button
                  onClick={handleSaveComposed}
                  disabled={!composeTitle.trim() || !composeOutput.trim()}
                  className={`px-3 py-2 rounded text-sm font-semibold transition ${
                    composeTitle.trim() && composeOutput.trim()
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Save size={14} className="inline-block mr-1" /> Save
                </button>
                <button
                  onClick={() => {
                    if (composeOutput.trim()) {
                      onSelectPrompt(composeOutput.trim());
                      onClose();
                    }
                  }}
                  disabled={!composeOutput.trim()}
                  className={`px-3 py-2 rounded text-sm font-semibold transition ${
                    composeOutput.trim()
                      ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Use Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptLibrary;
