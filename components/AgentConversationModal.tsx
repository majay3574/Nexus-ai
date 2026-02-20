import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Play, Pause, RotateCcw, Plus, Download, MessageSquare, Zap, FileJson, FileText, BookmarkIcon, Save, Trash2, Copy, Check } from 'lucide-react';
import { AgentConfig, AgentConversation, AgentConversationMessage } from '../types';
import { streamAgentToAgentConversation } from '../services/aiService';
import { AppSettings } from '../types';
import * as db from '../lib/db';
import { exportToJSON, exportToCSV, exportToMarkdown, exportToPDF, ExportOptions } from '../services/exportService';

interface AgentConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentConfig[];
  settings: AppSettings;
}

export default function AgentConversationModal({
  isOpen,
  onClose,
  agents,
  settings,
}: AgentConversationModalProps) {
  const [agent1Id, setAgent1Id] = useState<string>('');
  const [agent2Id, setAgent2Id] = useState<string>('');
  const [additionalAgentIds, setAdditionalAgentIds] = useState<string[]>([]);
  const [topic, setTopic] = useState<string>('');
  const [maxTurns, setMaxTurns] = useState<number>(5);
  const [conversation, setConversation] = useState<AgentConversationMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showHumanInput, setShowHumanInput] = useState(false);
  const [humanInputText, setHumanInputText] = useState('');
  const [conversationSentiment, setConversationSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral');
  const [typingAgentId, setTypingAgentId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedConversations, setSavedConversations] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [conversationTags, setConversationTags] = useState<string>('');
  const [conversationSummary, setConversationSummary] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agents.length >= 2) {
      setAgent1Id(agents[0].id);
      setAgent2Id(agents[1].id);
    }
  }, [agents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleStartConversation = async () => {
    if (!agent1Id || !agent2Id || !topic.trim()) {
      alert('Please select two agents and enter a topic');
      return;
    }

    if (agent1Id === agent2Id) {
      alert('Please select different agents');
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    setConversation([]);

    try {
      const agent1 = agents.find((a) => a.id === agent1Id);
      const agent2 = agents.find((a) => a.id === agent2Id);

      if (!agent1 || !agent2) return;

      // Build list of all participating agents
      const allParticipants = [agent1, agent2];
      additionalAgentIds.forEach(id => {
        const agent = agents.find(a => a.id === id);
        if (agent) allParticipants.push(agent);
      });

      const messages: any[] = [];

      for (let turn = 0; turn < maxTurns && !isPaused; turn++) {
        // Each agent in the group speaks in order
        for (let agentIdx = 0; agentIdx < allParticipants.length; agentIdx++) {
          if (isPaused) break;

          const currentAgent = allParticipants[agentIdx];
          const otherAgents = allParticipants.filter((_, idx) => idx !== agentIdx);
          const contextAgent = otherAgents[0]; // Use first other agent as context

          let agentResponse = '';
          setTypingAgentId(currentAgent.id);

          await streamAgentToAgentConversation(
            currentAgent,
            contextAgent,
            topic,
            messages,
            settings,
            (chunk: string) => {
              agentResponse += chunk;
              if (messages.length > 0 && messages[messages.length - 1].agentId === currentAgent.id) {
                messages[messages.length - 1].content = agentResponse;
              }
              setConversation([...messages]);
              setConversationSentiment(analyzeSentiment(messages));
            }
          );

          setTypingAgentId(null);
        }

        if (isPaused) break;
      }

      setIsRunning(false);
      setTypingAgentId(null);
    } catch (error) {
      console.error('Conversation error:', error);
      alert('Error during conversation: ' + (error as Error).message);
      setIsRunning(false);
      setTypingAgentId(null);
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    setConversation([]);
    setIsRunning(false);
    setIsPaused(false);
    setAdditionalAgentIds([]);
    setShowHumanInput(false);
    setHumanInputText('');
    setConversationSentiment('neutral');
  };

  // Creative Feature: Sentiment Analysis
  const analyzeSentiment = (messages: AgentConversationMessage[]) => {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'good', 'awesome', 'love', 'brilliant', 'fantastic', 'happy', 'success', 'agree', 'innovative'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'disagree', 'fail', 'problem', 'issue', 'difficult', 'bad', 'wrong', 'stupid', 'sad', 'concerned'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    messages.forEach(msg => {
      const lowerContent = msg.content.toLowerCase();
      positiveWords.forEach(word => {
        if (lowerContent.includes(word)) positiveCount++;
      });
      negativeWords.forEach(word => {
        if (lowerContent.includes(word)) negativeCount++;
      });
    });
    
    if (positiveCount > negativeCount + 2) return 'positive';
    if (negativeCount > positiveCount + 2) return 'negative';
    return 'neutral';
  };

  // Download Conversation
  const handleDownloadConversation = () => {
    if (conversation.length === 0) {
      alert('No conversation to download');
      return;
    }

    const markdown = `# Agent Conversation Report
Date: ${new Date().toLocaleString()}
Topic: ${topic}
Agents: ${agents.find(a => a.id === agent1Id)?.name}, ${agents.find(a => a.id === agent2Id)?.name}${additionalAgentIds.length > 0 ? ', ' + additionalAgentIds.map(id => agents.find(a => a.id === id)?.name).join(', ') : ''}
Conversation Sentiment: ${conversationSentiment.toUpperCase()}

## Conversation

${conversation.map(msg => `**${msg.agentName}:**\n${msg.content}\n\n`).join('')}

---
Generated by Nexus Agent Studio`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Add Human Input
  const handleAddHumanInput = async () => {
    if (!humanInputText.trim()) return;
    
    const newMessage: AgentConversationMessage = {
      id: `human-${Date.now()}`,
      conversationId: 'user-session',
      agentId: 'human-user',
      agentName: 'You (Human)',
      content: humanInputText.trim(),
      timestamp: Date.now(),
      turnNumber: conversation.length + 1,
    };
    
    const updatedConversation = [...conversation, newMessage];
    setConversation(updatedConversation);
    setHumanInputText('');
    setConversationSentiment(analyzeSentiment(updatedConversation));

    // Automatically make agents respond to human input
    try {
      const agent1 = agents.find((a) => a.id === agent1Id);
      const agent2 = agents.find((a) => a.id === agent2Id);

      if (!agent1 || !agent2) return;

      const allParticipants = [agent1, agent2];
      additionalAgentIds.forEach(id => {
        const agent = agents.find(a => a.id === id);
        if (agent) allParticipants.push(agent);
      });

      const messages = updatedConversation;

      // Random agent responds to human input
      const randomAgentIdx = Math.floor(Math.random() * allParticipants.length);
      const respondingAgent = allParticipants[randomAgentIdx];
      const contextAgent = allParticipants[(randomAgentIdx + 1) % allParticipants.length];

      let agentResponse = '';

      await streamAgentToAgentConversation(
        respondingAgent,
        contextAgent,
        humanInputText.trim(),
        messages,
        settings,
        (chunk: string) => {
          agentResponse += chunk;
          if (messages.length > 0 && messages[messages.length - 1].agentId === respondingAgent.id) {
            messages[messages.length - 1].content = agentResponse;
          }
          setConversation([...messages]);
          setConversationSentiment(analyzeSentiment(messages));
        }
      );
    } catch (error) {
      console.error('Error getting agent response to human input:', error);
    }
  };

  // Export functions
  const handleExport = async (format: 'json' | 'csv' | 'markdown' | 'pdf') => {
    if (conversation.length === 0) {
      alert('No conversation to export');
      return;
    }

    const options: ExportOptions = {
      filename: `conversation-${Date.now()}`,
      title: `Agent Conversation: ${topic}`,
      metadata: {
        'Topic': topic,
        'Agents': `${agents.find(a => a.id === agent1Id)?.name}, ${agents.find(a => a.id === agent2Id)?.name}`,
        'Sentiment': conversationSentiment.toUpperCase(),
        'Message Count': conversation.length.toString(),
        'Generated': new Date().toLocaleString(),
      },
    };

    try {
      switch (format) {
        case 'json':
          await exportToJSON(conversation, options);
          break;
        case 'csv':
          await exportToCSV(conversation, options);
          break;
        case 'markdown':
          await exportToMarkdown(conversation, options);
          break;
        case 'pdf':
          await exportToPDF(conversation, options);
          break;
      }
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export conversation');
    }
  };

  // Save conversation
  const handleSaveConversation = () => {
    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    const conversationData = {
      id: `conv-${Date.now()}`,
      agent1Id,
      agent2Id,
      topic,
      messages: conversation,
      maxTurns,
      status: 'completed' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    db.saveConversation(
      conversationData.id,
      agent1Id,
      agent2Id,
      topic,
      maxTurns,
      'completed',
      conversationTags.split(',').map(t => t.trim()).filter(Boolean),
      conversationSummary || undefined
    );

    setSavedMessage('Conversation saved successfully!');
    setTimeout(() => setSavedMessage(null), 3000);
    setShowSaveDialog(false);
  };

  // Save as template
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    db.saveTemplate(
      `template-${Date.now()}`,
      templateName,
      `Template for ${topic}`,
      agent1Id,
      agent2Id,
      additionalAgentIds,
      topic,
      maxTurns
    );

    alert('Template saved successfully!');
    setShowTemplateMenu(false);
    setTemplateName('');
  };

  // Load template
  const handleLoadTemplate = (template: any) => {
    setAgent1Id(template.agent1Id);
    setAgent2Id(template.agent2Id);
    setAdditionalAgentIds(template.additionalAgentIds || []);
    setTopic(template.topic);
    setMaxTurns(template.maxTurns);
  };

  // Add Additional Agent
  const handleAddAgent = () => {
    const unusedAgents = agents.filter(a => 
      a.id !== agent1Id && a.id !== agent2Id && !additionalAgentIds.includes(a.id)
    );
    
    if (unusedAgents.length === 0) {
      alert('No more agents available to add');
      return;
    }
    
    setAdditionalAgentIds([...additionalAgentIds, unusedAgents[0].id]);
  };

  const handleRemoveAgent = (agentId: string) => {
    setAdditionalAgentIds(additionalAgentIds.filter(id => id !== agentId));
  };

  if (!isOpen) return null;

  const agent1 = agents.find((a) => a.id === agent1Id);
  const agent2 = agents.find((a) => a.id === agent2Id);

  return (
    <div className='fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='neo-panel rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b border-slate-800/70 bg-slate-900/60'>
          <div>
            <h2 className='text-xl sm:text-2xl font-bold text-white'>Agent Conversation</h2>
            {conversation.length > 0 && (
              <div className='flex items-center gap-2 mt-2'>
                <div className={`w-2 h-2 rounded-full ${
                  conversationSentiment === 'positive' ? 'bg-green-500' :
                  conversationSentiment === 'negative' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`} />
                <span className='text-sm text-slate-400'>
                  Sentiment: <span className='font-semibold capitalize'>{conversationSentiment}</span>
                </span>
              </div>
            )}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {conversation.length > 0 && (
              <>
                {/* Save Button */}
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className='flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition text-sm'
                  title='Save conversation'
                >
                  <Save size={18} />
                </button>

                {/* Export Menu */}
                <div className='relative'>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className='flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 transition text-sm'
                    title='Export conversation'
                  >
                    <Download size={18} />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  {showExportMenu && (
                    <div className='absolute right-0 mt-1 bg-slate-900/90 border border-slate-800/70 rounded shadow-lg z-10'>
                      <button onClick={() => handleExport('json')} className='block w-full text-left px-4 py-2 hover:bg-slate-800/80 text-sm text-slate-200'>
                        <FileJson className='inline mr-2' size={14} /> JSON
                      </button>
                      <button onClick={() => handleExport('csv')} className='block w-full text-left px-4 py-2 hover:bg-slate-800/80 text-sm text-slate-200'>
                        <FileText className='inline mr-2' size={14} /> CSV
                      </button>
                      <button onClick={() => handleExport('markdown')} className='block w-full text-left px-4 py-2 hover:bg-slate-800/80 text-sm text-slate-200'>
                        <FileText className='inline mr-2' size={14} /> Markdown
                      </button>
                      <button onClick={() => handleExport('pdf')} className='block w-full text-left px-4 py-2 hover:bg-slate-800/80 text-sm text-slate-200'>
                        <Download className='inline mr-2' size={14} /> PDF
                      </button>
                    </div>
                  )}
                </div>

                {/* Template Menu */}
                <div className='relative'>
                  <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className='flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition text-sm'
                    title='Manage templates'
                  >
                    <BookmarkIcon size={18} />
                  </button>
                  {showTemplateMenu && (
                    <div className='absolute right-0 mt-1 bg-slate-900/90 border border-slate-800/70 rounded shadow-lg z-10 w-48'>
                      <div className='p-2 border-b border-slate-800/70'>
                        <input
                          type='text'
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder='Template name...'
                          className='w-full p-1 border border-slate-700/60 rounded text-xs bg-slate-900 text-slate-200'
                        />
                        <button
                          onClick={handleSaveTemplate}
                          className='w-full mt-1 px-2 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-600'
                        >
                          Save as Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <button
              onClick={onClose}
              className='text-slate-400 hover:text-white transition'
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Configuration */}
        {conversation.length === 0 && !isRunning && (
          <div className='p-4 sm:p-6 border-b space-y-4 bg-slate-900/60'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-slate-300 mb-2'>
                  Agent 1
                </label>
                <select
                  value={agent1Id}
                  onChange={(e) => setAgent1Id(e.target.value)}
                  disabled={isRunning}
                  className='w-full p-2 rounded text-sm neo-input'
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-slate-300 mb-2'>
                  Agent 2
                </label>
                <select
                  value={agent2Id}
                  onChange={(e) => setAgent2Id(e.target.value)}
                  disabled={isRunning}
                  className='w-full p-2 rounded text-sm neo-input'
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-slate-300 mb-2'>
                Conversation Topic
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isRunning}
                placeholder='e.g., "Discuss the future of AI in software development"'
                className='w-full p-2 rounded text-sm h-16 resize-none neo-input'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-slate-300 mb-2'>
                Max Turns: {maxTurns}
              </label>
              <input
                type='range'
                min='1'
                max='20'
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                disabled={isRunning}
                className='w-full'
              />
            </div>

            {/* Additional Agents Section */}
            <div className='bg-slate-900/60 p-4 rounded border border-slate-700/60'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3'>
                <label className='text-sm font-medium text-slate-300'>
                  Additional Agents (Optional)
                </label>
                <button
                  onClick={handleAddAgent}
                  disabled={isRunning || agents.length <= additionalAgentIds.length + 2}
                  className='flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-500 disabled:bg-slate-600/70 transition'
                >
                  <Plus size={14} />
                  Add Agent
                </button>
              </div>
              {additionalAgentIds.length > 0 ? (
                <div className='space-y-2'>
                  {additionalAgentIds.map((agentId) => (
                    <div key={agentId} className='flex items-center justify-between bg-slate-900/90 p-2 rounded border border-slate-700/60'>
                      <span className='text-sm text-slate-300'>
                        {agents.find(a => a.id === agentId)?.name}
                      </span>
                      <button
                        onClick={() => handleRemoveAgent(agentId)}
                        className='text-red-500 hover:text-red-700 text-sm font-medium transition'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-slate-500 italic'>No additional agents added</p>
              )}
            </div>

            <button
              onClick={handleStartConversation}
              disabled={isRunning}
              className='w-full bg-emerald-600 text-white py-2 rounded font-medium hover:bg-emerald-500 disabled:bg-slate-600/70 transition'
            >
              Start Conversation
            </button>
          </div>
        )}

        {/* Human Input Section */}
        {conversation.length > 0 && (
          <div className='p-4 sm:p-6 border-t bg-slate-900/70'>
            {!showHumanInput ? (
              <button
                onClick={() => setShowHumanInput(true)}
                disabled={isRunning}
                className='flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:bg-slate-600/70 transition text-sm'
              >
                <Plus size={18} />
                Add Human Input (Optional)
              </button>
            ) : (
              <div className='space-y-3'>
                <label className='block text-sm font-medium text-slate-300'>
                  Your Message
                </label>
                <div className='flex gap-2'>
                  <textarea
                    value={humanInputText}
                    onChange={(e) => setHumanInputText(e.target.value)}
                    disabled={isRunning}
                    placeholder='Share your thoughts or ask a question...'
                    className='flex-1 p-2 rounded text-sm h-20 resize-none neo-input disabled:bg-slate-800/80'
                  />
                </div>
                <div className='flex flex-col sm:flex-row gap-2'>
                  <button
                    onClick={handleAddHumanInput}
                    disabled={!humanInputText.trim() || isRunning}
                    className='flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:bg-slate-600/70 transition'
                  >
                    <Send size={16} />
                    Add Message
                  </button>
                  <button
                    onClick={() => {
                      setShowHumanInput(false);
                      setHumanInputText('');
                    }}
                    disabled={isRunning}
                    className='px-4 py-2 bg-slate-700/70 text-slate-100 rounded hover:bg-slate-600/70 disabled:bg-slate-700/50 transition'
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation Display */}
        <div className='flex-1 overflow-y-auto p-4 sm:p-6 space-y-4'>
          {conversation.length === 0 && (isRunning || isPaused) && (
            <div className='text-center text-slate-500 py-8'>
              Initializing conversation...
            </div>
          )}

          {conversation.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.agentId === 'human-user' ? 'justify-end' : ''}`}>
              {msg.agentId !== 'human-user' && (
                <div
                  className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${
                    agents.find((a) => a.id === msg.agentId)?.color === 'blue'
                      ? 'bg-cyan-600'
                      : agents.find((a) => a.id === msg.agentId)?.color === 'emerald'
                        ? 'bg-emerald-500'
                        : 'bg-slate-700'
                  }`}
                >
                  {msg.agentName.charAt(0)}
                </div>
              )}
              <div className={`flex-1 ${msg.agentId === 'human-user' ? 'max-w-md' : ''}`}>
                <div className={`font-semibold ${msg.agentId === 'human-user' ? 'text-emerald-200 text-right' : 'text-slate-100'}`}>
                  {msg.agentName}
                </div>
                <div className={`text-sm mt-1 p-3 rounded ${
                  msg.agentId === 'human-user' 
                    ? 'bg-emerald-900/40 text-slate-100' 
                    : 'bg-slate-800/80 text-slate-300'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typingAgentId && (
            <div className='flex gap-3'>
              <div className='w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold bg-slate-600/70'>
                {agents.find(a => a.id === typingAgentId)?.name.charAt(0)}
              </div>
              <div>
                <div className='font-semibold text-slate-100'>{agents.find(a => a.id === typingAgentId)?.name}</div>
                <div className='flex gap-1 mt-1 p-3 bg-slate-800/80 text-slate-300 rounded w-fit'>
                  <span className='w-2 h-2 bg-slate-600/70 rounded-full animate-bounce'></span>
                  <span className='w-2 h-2 bg-slate-600/70 rounded-full animate-bounce' style={{ animationDelay: '0.1s' }}></span>
                  <span className='w-2 h-2 bg-slate-600/70 rounded-full animate-bounce' style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className='p-4 sm:p-6 border-t bg-slate-900/60 flex flex-wrap gap-2 items-center'>
          {isRunning && (
            <>
              <button
                onClick={handlePause}
                className='flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition'
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleReset}
                className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition'
              >
                <RotateCcw size={18} />
                Reset
              </button>
            </>
          )}

          {!isRunning && conversation.length > 0 && (
            <>
              <button
                onClick={handleStartConversation}
                className='flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition'
              >
                <Play size={18} />
                Continue
              </button>
              <button
                onClick={handleReset}
                className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition'
              >
                <RotateCcw size={18} />
                Reset
              </button>
            </>
          )}

          <div className='flex-1' />
          <button
            onClick={onClose}
            className='px-4 py-2 bg-slate-700/70 text-slate-100 rounded hover:bg-slate-600/70 transition'
          >
            Close
          </button>
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
            <div className='neo-panel rounded-lg max-w-md w-full p-4 sm:p-6 space-y-4'>
              <h3 className='text-lg sm:text-xl font-bold text-slate-100'>Save Conversation</h3>
              
              {savedMessage && (
                <div className='p-3 bg-emerald-900/40 text-emerald-200 rounded flex items-center gap-2'>
                  <Check size={18} />
                  {savedMessage}
                </div>
              )}

              <div>
                <label className='block text-sm font-medium text-slate-300 mb-2'>Tags (comma-separated)</label>
                <input
                  type='text'
                  value={conversationTags}
                  onChange={(e) => setConversationTags(e.target.value)}
                  placeholder='e.g. AI, discussion, important'
                  className='w-full p-2 rounded neo-input'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-slate-300 mb-2'>Summary</label>
                <textarea
                  value={conversationSummary}
                  onChange={(e) => setConversationSummary(e.target.value)}
                  placeholder='Brief summary of the conversation...'
                  className='w-full p-2 rounded h-20 resize-none neo-input'
                />
              </div>

              <div className='flex gap-2 pt-4'>
                <button
                  onClick={handleSaveConversation}
                  className='flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition'
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className='flex-1 px-4 py-2 bg-slate-700/70 text-slate-100 rounded hover:bg-slate-600/70 transition'
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
