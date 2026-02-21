import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Send, Square, Menu, Sparkles, Search, Globe, Trash2, Download, ImageUp, ImageDown, Mic, MicOff, BookOpen, Edit2, RotateCcw, Pin, BarChart3, LogOut } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import AgentConfigModal from './components/AgentConfigModal';
import SettingsModal from './components/SettingsModal';
import AgentConversationModal from './components/AgentConversationModal';
import PromptLibrary from './components/PromptLibrary';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoginPage from './components/LoginPage';
import { AgentConfig, Message, ChatState, AppSettings, AutomationDefinition } from './types';
import { DEFAULT_AGENTS } from './constants';
import { streamAIResponse, imageToText, textToImage } from './services/aiService';
import { logEvent } from './services/logService';
import { fetchMe, logoutUser, AuthUser } from './services/authService';
import * as db from './lib/db';
import { estimateTokens, formatRelativeTime, searchMessages } from './lib/utils';

function App() {

  // State
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string>('');
  const [messages, setMessages] = useState<ChatState>({});
  const [settings, setSettings] = useState<AppSettings>({});
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | undefined>(undefined);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const streamingContentRef = useRef('');
  const streamingAgentRef = useRef<string | null>(null);

  // Initialize Auth
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        if (isMounted) setIsAuthReady(true);
        return;
      }

      try {
        const session = await fetchMe(token);
        if (isMounted) {
          db.setActiveUser(String(session.user?.id ?? session.user?.email ?? session.user?.name ?? 'default'));
          setIsAuthenticated(true);
          setAuthUser(session.user);
        }
      } catch (e) {
        localStorage.removeItem('authToken');
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize DB
  useEffect(() => {
    if (!isAuthenticated) return;
    const init = async () => {
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DB Init Timeout')), 5000)
        );
        
        await Promise.race([db.initDB(), timeoutPromise]);
        
        // Load Settings
        const savedSettings = db.getSettings();
        setSettings(savedSettings);

        // Load Agents
        const savedAgents = db.getAgents();
        if (savedAgents.length > 0) {
          setAgents(savedAgents);
          setCurrentAgentId(savedAgents[0].id);
          // Load Messages for first agent
          const msgs = db.getMessages(savedAgents[0].id);
          setMessages({ [savedAgents[0].id]: msgs });
        } else {
           // Use default agents if none found
           setAgents(DEFAULT_AGENTS);
           setCurrentAgentId(DEFAULT_AGENTS[0].id);
        }
        setIsDbReady(true);
      } catch (e) {
        console.error("DB Init Error:", e);
        // Fallback: Use defaults if DB fails
        setAgents(DEFAULT_AGENTS);
        setCurrentAgentId(DEFAULT_AGENTS[0].id);
        setIsDbReady(true);
      }
    };
    init();
  }, [isAuthenticated]);

  // Load messages when changing agent
  useEffect(() => {
    if (currentAgentId && isDbReady) {
      const msgs = db.getMessages(currentAgentId);
      setMessages(prev => ({ ...prev, [currentAgentId]: msgs }));
    }
  }, [currentAgentId, isDbReady]);

  // Initialize speech recognition (if available)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const combined = [dictationBaseRef.current, transcript]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      setInputValue(combined);
    };

    recognitionRef.current = recognition;
    return () => {
      try { recognition.stop(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const currentAgent = agents.find(a => a.id === currentAgentId) || agents[0];
  const currentMessages = messages[currentAgentId] || [];
  const hasSearchCapability = currentAgent?.tools?.includes('googleSearch');
  const availableTools = currentAgent?.tools || [];

  const automations: AutomationDefinition[] = [
    {
      id: 'web-brief',
      title: 'Web Research Brief',
      description: 'Find sources and produce a concise brief with citations and next steps.',
      prompt: `Research this topic using web search. Provide a concise brief with citations, key facts, and 3 follow-up questions:\n\n[Paste topic here]`,
      requiredTools: ['googleSearch'],
      badge: 'Web'
    },
    {
      id: 'bug-triage',
      title: 'Bug Triage',
      description: 'Analyze an error log or bug description and propose fixes.',
      prompt: `You are a senior engineer. Diagnose the issue, list likely root causes, and provide a step-by-step fix plan:\n\n[Paste error/log/behavior here]`
    },
    {
      id: 'refactor-plan',
      title: 'Refactor Plan',
      description: 'Generate a safe refactor checklist and suggested diffs.',
      prompt: `Create a safe refactor plan. Include risks, small steps, and example diff snippets where helpful:\n\n[Paste code or file summary here]`
    },
    {
      id: 'test-gen',
      title: 'Test Generator',
      description: 'Draft test cases and example unit tests for a feature.',
      prompt: `Generate test cases and example unit tests for the feature below. Include edge cases and expected outputs:\n\n[Describe the feature here]`
    },
    {
      id: 'conversation-digest',
      title: 'Conversation Digest',
      description: 'Summarize decisions, open questions, and next actions.',
      prompt: `Summarize this conversation into: Decisions, Open Questions, Next Actions.\n\n[Paste conversation here]`
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isLoading]);

  const stripMarkdown = (text: string) => {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#>*_~`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSpeakMessage = (message: Message) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;
    if (speakingMessageId === message.id) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(message.content));
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(message.id);
    synth.speak(utterance);
  };

  const handleMicToggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognition.stop();
      return;
    }

    dictationBaseRef.current = inputValue.trim();
    recognition.start();
  };

  const handleClearHistory = () => {
    if (!currentAgentId || !currentAgent) return;
    const ok = window.confirm(`Clear all history for "${currentAgent.name}"?`);
    if (!ok) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    setMessages(prev => ({ ...prev, [currentAgentId]: [] }));
    db.deleteMessagesForAgent(currentAgentId);
  };

  const handleDownloadHistory = () => {
    if (!currentAgentId || !currentAgent) return;
    const exportMessages = messages[currentAgentId] || [];
    if (exportMessages.length === 0) {
      alert('No history to download for this agent.');
      return;
    }

    const lines: string[] = [];
    lines.push(`# Nexus Agent Studio - Chat Export`);
    lines.push(`Agent: ${currentAgent.name}`);
    lines.push(`Provider: ${currentAgent.provider}`);
    lines.push(`Model: ${currentAgent.model}`);
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    exportMessages.forEach((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const time = new Date(msg.timestamp).toLocaleString();
      lines.push(`## ${role} (${time})`);
      if (msg.isError) {
        lines.push('_Error_');
      }
      lines.push('');
      lines.push(msg.content || '');
      lines.push('');

      const citations = msg.groundingMetadata?.groundingChunks?.filter(c => c.web) || [];
      if (citations.length > 0) {
        lines.push('Sources:');
        citations.forEach((chunk) => {
          lines.push(`- ${chunk.web?.title || 'Source'} - ${chunk.web?.uri}`);
        });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = currentAgent.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    link.href = url;
    link.download = `nexus-history-${safeName}-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAgent = (agent: AgentConfig) => {
    if (agents.length <= 1) {
      alert('You must keep at least one agent.');
      return;
    }
    const ok = window.confirm(`Delete "${agent.name}" and all its history?`);
    if (!ok) return;

    const remaining = agents.filter(a => a.id !== agent.id);
    setAgents(remaining);
    setMessages(prev => {
      const next = { ...prev };
      delete next[agent.id];
      return next;
    });
    db.deleteAgent(agent.id);
    db.deleteMessagesForAgent(agent.id);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }

    if (currentAgentId === agent.id) {
      setCurrentAgentId(remaining[0]?.id || '');
    }
    setIsModalOpen(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentAgent) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Please use an image under 2MB.');
      return;
    }
    if (isLoading) return;

    const activeAgentId = currentAgentId;
    const activeAgent = currentAgent;
    const prompt = inputValue.trim();

    setInputValue('');
    setIsLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Image to text: ${file.name}${prompt ? `\n\nPrompt: ${prompt}` : ''}`,
      timestamp: Date.now()
    };

    const activeMessages = messages[activeAgentId] || [];
    const updatedMessages = [...activeMessages, userMsg];
    setMessages(prev => ({ ...prev, [activeAgentId]: updatedMessages }));
    db.saveMessage(activeAgentId, userMsg);
    void logEvent('user_image_to_text', {
      agentId: activeAgentId,
      agentName: activeAgent.name,
      provider: activeAgent.provider || 'google',
      model: activeAgent.model,
      messageId: userMsg.id,
      content: userMsg.content,
      contentLength: userMsg.content.length,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    const aiMsgId = crypto.randomUUID();
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: 'model',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => ({
      ...prev,
      [activeAgentId]: [...updatedMessages, initialAiMsg]
    }));

    try {
      const base64 = await fileToBase64(file);
      const imageText = await imageToText(
        activeAgent.provider || 'google',
        activeAgent.model,
        settings,
        base64,
        file.type,
        prompt || undefined
      );

      const finalMsg: Message = {
        ...initialAiMsg,
        content: imageText
      };

      setMessages(prev => {
        const agentMsgs = prev[activeAgentId] || [];
        const newAgentMsgs = agentMsgs.map(m => m.id === aiMsgId ? finalMsg : m);
        return { ...prev, [activeAgentId]: newAgentMsgs };
      });
      db.saveMessage(activeAgentId, finalMsg);
      void logEvent('assistant_message', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: finalMsg.id,
        content: finalMsg.content,
        contentLength: finalMsg.content.length,
        interaction: 'image_to_text',
        isError: false
      });
    } catch (error: any) {
      const errorMsg: Message = {
        ...initialAiMsg,
        content: `Error: ${error.message || 'Failed to extract text from image.'}`,
        isError: true
      };
      setMessages(prev => {
        const agentMsgs = prev[activeAgentId] || [];
        const newAgentMsgs = agentMsgs.map(m => m.id === aiMsgId ? errorMsg : m);
        return { ...prev, [activeAgentId]: newAgentMsgs };
      });
      db.saveMessage(activeAgentId, errorMsg);
      void logEvent('assistant_error', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: errorMsg.id,
        error: errorMsg.content,
        interaction: 'image_to_text'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextToImage = async () => {
    if (!inputValue.trim() || isLoading || !currentAgent) return;

    const activeAgentId = currentAgentId;
    const activeAgent = currentAgent;
    const prompt = inputValue.trim();

    setInputValue('');
    setIsLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Text to image: ${prompt}`,
      timestamp: Date.now()
    };

    const activeMessages = messages[activeAgentId] || [];
    const updatedMessages = [...activeMessages, userMsg];
    setMessages(prev => ({ ...prev, [activeAgentId]: updatedMessages }));
    db.saveMessage(activeAgentId, userMsg);
    void logEvent('user_text_to_image', {
      agentId: activeAgentId,
      agentName: activeAgent.name,
      provider: activeAgent.provider || 'google',
      model: activeAgent.model,
      messageId: userMsg.id,
      content: userMsg.content,
      contentLength: userMsg.content.length
    });

    const aiMsgId = crypto.randomUUID();
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: 'model',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => ({
      ...prev,
      [activeAgentId]: [...updatedMessages, initialAiMsg]
    }));

    try {
      const result = await textToImage(
        activeAgent.provider || 'google',
        settings,
        prompt
      );

      const finalMsg: Message = {
        ...initialAiMsg,
        content: `![Generated Image](${result.dataUrl})\n\nPrompt: ${prompt}`
      };

      setMessages(prev => {
        const agentMsgs = prev[activeAgentId] || [];
        const newAgentMsgs = agentMsgs.map(m => m.id === aiMsgId ? finalMsg : m);
        return { ...prev, [activeAgentId]: newAgentMsgs };
      });
      db.saveMessage(activeAgentId, finalMsg);
      void logEvent('assistant_message', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: finalMsg.id,
        content: finalMsg.content,
        contentLength: finalMsg.content.length,
        interaction: 'text_to_image',
        isError: false
      });
    } catch (error: any) {
      const errorMsg: Message = {
        ...initialAiMsg,
        content: `Error: ${error.message || 'Failed to generate image.'}`,
        isError: true
      };
      setMessages(prev => {
        const agentMsgs = prev[activeAgentId] || [];
        const newAgentMsgs = agentMsgs.map(m => m.id === aiMsgId ? errorMsg : m);
        return { ...prev, [activeAgentId]: newAgentMsgs };
      });
      db.saveMessage(activeAgentId, errorMsg);
      void logEvent('assistant_error', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: errorMsg.id,
        error: errorMsg.content,
        interaction: 'text_to_image'
      });
    } finally {
      setIsLoading(false);
    }
  };
  // Handle Send Message
  const handleSendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? inputValue).trim();
    if (!content || isLoading || !currentAgent) return;

    const activeAgentId = currentAgentId;
    const activeAgent = currentAgent;
    const activeMessages = currentMessages;
    const messageContent = content;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now()
    };

    if (overrideContent === undefined) {
      setInputValue('');
    }
    
    const updatedMessages = [...activeMessages, userMsg];
    setMessages(prev => ({ ...prev, [activeAgentId]: updatedMessages }));
    db.saveMessage(activeAgentId, userMsg);
    void logEvent('user_message', {
      agentId: activeAgentId,
      agentName: activeAgent.name,
      provider: activeAgent.provider || 'google',
      model: activeAgent.model,
      messageId: userMsg.id,
      content: userMsg.content,
      contentLength: userMsg.content.length
    });
    
    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stopRequestedRef.current = false;
    streamingContentRef.current = '';
    streamingAgentRef.current = activeAgentId;
    const loaderStartTime = Date.now();
    const minLoaderTime = 500;

    let fullContent = '';
    let typingStartTimeout: NodeJS.Timeout | null = null;
    let typingInterval: NodeJS.Timeout | null = null;
    let hasStartedTyping = false;
    let typingDonePromise: Promise<void> | null = null;
    let resolveTypingDone: (() => void) | null = null;

    try {
      const response = await streamAIResponse(
        activeAgent.provider || 'google',
        activeAgent.model,
        activeAgent.systemInstruction,
        updatedMessages, 
        userMsg.content,
        settings,
        activeAgent.tools,
        (chunk) => {
          fullContent += chunk;
          streamingContentRef.current = fullContent;
          
          if (!hasStartedTyping) {
            hasStartedTyping = true;
            const elapsedTime = Date.now() - loaderStartTime;
            const remainingTime = Math.max(0, minLoaderTime - elapsedTime);

            typingDonePromise = new Promise<void>(resolve => {
              resolveTypingDone = resolve;
            });

            typingStartTimeout = setTimeout(() => {
              typingStartTimeout = null;
              setIsLoading(false);
              
              let displayedContent = '';
              typingInterval = setInterval(() => {
                if (displayedContent.length < fullContent.length) {
                  const charsToAdd = Math.min(3, fullContent.length - displayedContent.length);
                  displayedContent = fullContent.slice(0, displayedContent.length + charsToAdd);
                  
                  setMessages(prev => {
                    const agentMsgs = prev[activeAgentId] || [];
                    const streamingIndex = agentMsgs.findIndex(m => m.id === 'streaming');
                    
                    if (streamingIndex >= 0) {
                      const updated = [...agentMsgs];
                      updated[streamingIndex] = { ...updated[streamingIndex], content: displayedContent };
                      return { ...prev, [activeAgentId]: updated };
                    } else {
                      return {
                        ...prev,
                        [activeAgentId]: [...agentMsgs, {
                          id: 'streaming',
                          role: 'model' as const,
                          content: displayedContent,
                          timestamp: Date.now()
                        }]
                      };
                    }
                  });
                } else if (typingInterval) {
                  clearInterval(typingInterval);
                  typingInterval = null;
                  if (resolveTypingDone) {
                    resolveTypingDone();
                    resolveTypingDone = null;
                  }
                }
              }, 30);
            }, remainingTime);
          }
        },
        controller.signal
      );
      
      // Wait for typing to finish
      if (hasStartedTyping) {
        if (typingDonePromise) {
          await typingDonePromise;
        }
        
        // Small delay to ensure last update is rendered
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        setIsLoading(false);
      }

      const finalMsg: Message = { 
        id: crypto.randomUUID(),
        role: 'model',
        content: response.content || fullContent,
        timestamp: Date.now(),
        groundingMetadata: response.groundingMetadata 
      };
      
      // Force synchronous state update to prevent duplicate rendering
      flushSync(() => {
        setMessages(prev => {
          const agentMsgs = prev[activeAgentId] || [];
          const filtered = agentMsgs.filter(m => m.id !== 'streaming');
          return { ...prev, [activeAgentId]: [...filtered, finalMsg] };
        });
      });

      db.saveMessage(activeAgentId, finalMsg);
      void logEvent('assistant_message', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: finalMsg.id,
        content: finalMsg.content,
        contentLength: finalMsg.content.length,
        durationMs: Date.now() - loaderStartTime,
        isError: false
      });

    } catch (error: any) {
      if (error?.name === 'AbortError' || stopRequestedRef.current) {
        setIsLoading(false);
        const partial = streamingContentRef.current.trim();
        const agentId = streamingAgentRef.current || activeAgentId;

        if (typingStartTimeout) {
          clearTimeout(typingStartTimeout);
          typingStartTimeout = null;
        }
        if (typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
        if (resolveTypingDone) {
          resolveTypingDone();
          resolveTypingDone = null;
        }

        if (partial.length > 0) {
          const stoppedMsg: Message = {
            id: crypto.randomUUID(),
            role: 'model',
            content: partial,
            timestamp: Date.now()
          };
          setMessages(prev => {
            const agentMsgs = prev[agentId] || [];
            const filtered = agentMsgs.filter(m => m.id !== 'streaming');
            return { ...prev, [agentId]: [...filtered, stoppedMsg] };
          });
          db.saveMessage(agentId, stoppedMsg);
        } else {
          setMessages(prev => {
            const agentMsgs = prev[agentId] || [];
            return { ...prev, [agentId]: agentMsgs.filter(m => m.id !== 'streaming') };
          });
        }
        return;
      }

      console.error("AI Error", error);

      if (typingStartTimeout) {
        clearTimeout(typingStartTimeout);
        typingStartTimeout = null;
      }
      if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
      }
      if (resolveTypingDone) {
        resolveTypingDone();
        resolveTypingDone = null;
      }
      
      const elapsedTime = Date.now() - loaderStartTime;
      const remainingTime = Math.max(0, minLoaderTime - elapsedTime);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      setIsLoading(false);
      
      setMessages(prev => {
        const agentMsgs = prev[activeAgentId] || [];
        return { ...prev, [activeAgentId]: agentMsgs.filter(m => m.id !== 'streaming') };
      });
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        content: `Error: ${error.message || 'Unknown error'}`,
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => ({
        ...prev,
        [activeAgentId]: [...(prev[activeAgentId] || []), errorMsg]
      }));
      db.saveMessage(activeAgentId, errorMsg);
      void logEvent('assistant_error', {
        agentId: activeAgentId,
        agentName: activeAgent.name,
        provider: activeAgent.provider || 'google',
        model: activeAgent.model,
        messageId: errorMsg.id,
        error: errorMsg.content,
        durationMs: Date.now() - loaderStartTime
      });
    } finally {
      abortControllerRef.current = null;
      stopRequestedRef.current = false;
    }
  };

  const handleStop = () => {
    if (!isLoading) return;
    void logEvent('user_stop', {
      agentId: currentAgentId,
      agentName: currentAgent?.name || null,
      provider: currentAgent?.provider || 'google',
      model: currentAgent?.model || null,
      partialLength: streamingContentRef.current.length
    });
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  const handleLoadAutomation = (automation: AutomationDefinition) => {
    setInputValue(automation.prompt);
  };

  const handleRunAutomation = (automation: AutomationDefinition) => {
    const missing = (automation.requiredTools || []).filter(t => !availableTools.includes(t));
    if (missing.length > 0) {
      alert(`This automation requires: ${missing.join(', ')}. Enable the tool for this agent first.`);
      return;
    }
    setShowPromptLibrary(false);
    handleSendMessage(automation.prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      setShowPromptLibrary(true);
      return;
    }
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      setShowSearch(!showSearch);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSendMessage();
    }
  };

  // Agent Management
  const handleAddAgent = () => {
    setEditingAgent(undefined);
    setIsModalOpen(true);
  };

  const handleEditAgent = (agent: AgentConfig) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const handleSaveAgent = (agent: AgentConfig) => {
    // Optimistic UI update
    if (agents.find(a => a.id === agent.id)) {
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
    } else {
      const newAgent = { 
        ...agent, 
        avatarUrl: agent.avatarUrl || `https://picsum.photos/seed/${agent.id}/200/200` 
      };
      setAgents(prev => [...prev, newAgent]);
      setCurrentAgentId(newAgent.id);
      db.saveAgent(newAgent); // DB Save new
      return;
    }
    db.saveAgent(agent); // DB Save edit
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Persist to DB
    Object.entries(newSettings).forEach(([k, v]) => {
      if (v !== undefined) db.saveSetting(k as keyof AppSettings, v);
    });
  };

  const handleAuthSuccess = (token: string, user: AuthUser) => {
    localStorage.setItem('authToken', token);
    db.setActiveUser(String(user?.id ?? user?.email ?? user?.name ?? 'default'));
    setIsAuthenticated(true);
    setAuthUser(user);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        await logoutUser(token);
      } catch (e) {}
    }
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setAuthUser(null);
    setIsDbReady(false);
    setAgents([]);
    setMessages({});
    setCurrentAgentId('');
    setSettings({});
    db.resetDB();
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0b1116] to-[#132b3a]">
        <div className="flex flex-col items-center gap-6 p-6">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
            <div className="absolute inset-2 w-8 h-8 border-2 border-cyan-400/20 rounded-full animate-pulse"></div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-emerald-100">Checking Session</p>
            <p className="text-sm text-cyan-300">Verifying login status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (!isDbReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0b1116] to-[#132b3a]">
        <div className="flex flex-col items-center gap-6 p-6">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
            <div className="absolute inset-2 w-8 h-8 border-2 border-cyan-400/20 rounded-full animate-pulse"></div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-emerald-100">Initializing Application</p>
            <p className="text-sm text-cyan-300">Loading database and agents...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen w-full overflow-hidden text-slate-200">
      
      {/* Mobile Sidebar Toggle */}
      <button 
        className="md:hidden absolute top-4 left-4 z-40 p-2 bg-slate-800 rounded-lg text-white shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={20} />
      </button>

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 h-full transition-transform duration-300 ease-in-out`}>
        <Sidebar 
          agents={agents}
          currentAgentId={currentAgentId}
          onSelectAgent={(id) => {
            setCurrentAgentId(id);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onAddAgent={handleAddAgent}
          onEditAgent={handleEditAgent}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenConversation={() => setIsConversationOpen(true)}
        />
      </div>
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Chat Header */}
        <header className="neo-header flex flex-col md:flex-row md:h-16 items-start md:items-center justify-between px-4 sm:px-6 py-3 md:py-0 backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-amber-500/10 animate-pulse"></div>
          <div className="flex items-center gap-3 pl-10 md:pl-0 relative z-10 w-full md:w-auto">
             <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" style={{ backgroundColor: `var(--color-${currentAgent?.color || 'blue'}-500, #3b82f6)` }}></div>
             <div>
               <div className="flex items-center gap-2">
                 <h2 className="font-semibold text-white tracking-wide">{currentAgent?.name || 'Loading...'}</h2>
                 {hasSearchCapability && (
                   <div className="px-1.5 py-0.5 rounded bg-emerald-900/40 border border-emerald-500/30 text-[10px] text-emerald-200 flex items-center gap-1" title="Connected to Google Search">
                     <Globe size={10} />
                     <span>Search</span>
                   </div>
                 )}
               </div>
               <p className="text-xs text-slate-500 flex items-center gap-1">
                 <Sparkles size={10} className="text-amber-400 animate-pulse" />
                 {currentAgent?.provider} / {currentAgent?.model}
                 <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-300">
                   {estimateTokens(currentMessages.map(m => m.content).join(' '))} tokens
                 </span>
               </p>
             </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 relative z-10 w-full md:w-auto md:flex-nowrap md:justify-end mt-3 md:mt-0">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                showSearch 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : 'text-slate-400 hover:text-white border-slate-700 hover:border-slate-500'
              }`}
              title="Search (Ctrl+/)">
              <Search size={12} />
            </button>
            <button 
              onClick={() => setShowPromptLibrary(true)}
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
              title="Prompts (Ctrl+K)"
            >
              <BookOpen size={12} />
            </button>
            <button 
              onClick={() => setShowAnalytics(true)}
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
              title="Analytics"
            >
              <BarChart3 size={12} />
            </button>
            <button 
              onClick={handleDownloadHistory}
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
              title="Download chat history"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button 
              onClick={handleClearHistory}
              className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-full border border-red-500/40 hover:border-red-400/60 transition-all flex items-center gap-1.5"
              title="Clear chat history"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Clear</span>
            </button>
            <button 
              onClick={() => handleEditAgent(currentAgent)}
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
            >
              <Edit2 size={12} />
              <span className="hidden sm:inline">System Prompt &amp; Tools</span>
            </button>
            {authUser && (
              <span className="text-[11px] text-slate-500 hidden lg:block">
                {authUser.name || authUser.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
              title="Sign out"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        {showSearch && (
          <div className="p-4 border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-sm animate-slideIn">
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-10 pr-20 py-2 rounded-lg neo-input placeholder-slate-500 transition-all"
                autoFocus
              />
              {searchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {searchMessages(currentMessages, searchQuery).length} results
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar" style={{ scrollBehavior: 'smooth' }}>
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `rgba(47, 225, 179, 0.22)` }}>
                <Sparkles size={32} className="text-emerald-300" />
              </div>
              <p className="text-lg font-medium">Start a conversation with {currentAgent?.name}</p>
              <p className="text-sm max-w-md text-center mt-2">{currentAgent?.description}</p>
              {hasSearchCapability && (
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-900/50">
                  <Search size={12} />
                  <span>This agent can browse the web for answers</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(searchQuery ? searchMessages(currentMessages, searchQuery) : currentMessages).map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  agentColor={currentAgent?.color}
                  onSpeak={handleSpeakMessage}
                  isSpeaking={speakingMessageId === msg.id}
                />
              ))}
            </div>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-3 transition-opacity duration-200">
              <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center mt-1">
                <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="px-5 py-3 bg-slate-800/50 rounded-2xl rounded-bl-none backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
                <span className="text-xs text-slate-500 ml-2">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 pb-6 md:pb-8">
           <div className="max-w-4xl mx-auto relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-amber-500/40 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
             <div className="relative bg-slate-900/80 rounded-xl border border-slate-700/60 flex flex-col p-2 shadow-xl">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <div className="flex items-center gap-2 px-2 pb-2 border-b border-slate-800/70">
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all transform hover:scale-110"
                    title="Prompt Library (Ctrl+K)"
                  >
                    <BookOpen size={16} />
                  </button>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading}
                    className={`p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all transform hover:scale-110 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Image to Text"
                  >
                    <ImageUp size={16} />
                  </button>
                  <button
                    onClick={handleTextToImage}
                    disabled={!inputValue.trim() || isLoading}
                    className={`p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all transform hover:scale-110 ${(!inputValue.trim() || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Text to Image"
                  >
                    <ImageDown size={16} />
                  </button>
                  <button
                    onClick={handleMicToggle}
                    className={`p-2 rounded-lg transition-all transform hover:scale-110 ${
                      isRecording 
                        ? 'text-red-400 bg-red-900/20 animate-pulse' 
                        : 'text-slate-400 hover:text-green-400 hover:bg-slate-800'
                    }`}
                    title={isRecording ? 'Stop Recording' : 'Start Recording'}
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <div className="ml-auto text-[10px] text-slate-500 hidden sm:flex items-center gap-2">
                    {isRecording ? (
                      <span className="flex items-center gap-1 text-red-400 animate-pulse">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        Listening...
                      </span>
                    ) : (
                      <span>Ctrl+K: Prompts | Ctrl+/: Search</span>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${currentAgent?.name || 'Agent'}...`}
                    disabled={isLoading}
                    className="w-full bg-transparent border-none text-slate-200 placeholder-slate-500 focus:ring-0 resize-none max-h-32 py-3 px-3 custom-scrollbar disabled:opacity-50"
                    rows={1}
                    style={{ minHeight: '48px' }}
                  />
                  <button
                    onClick={handleStop}
                    disabled={!isLoading}
                    className={`mb-1 p-2.5 rounded-lg transition-all duration-200 flex-shrink-0
                      ${isLoading 
                        ? 'bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/20' 
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    title="Stop response"
                  >
                    <Square size={16} />
                  </button>
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isLoading}
                    className={`mb-1 p-2.5 rounded-lg transition-all duration-200 flex-shrink-0
                      ${inputValue.trim() && !isLoading 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20' 
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                  >
                    <Send size={18} />
                  </button>
                </div>
             </div>
             <div className="absolute -bottom-5 right-0 text-[10px] text-slate-600 flex gap-2">
               <span>Nexus Studio</span>
               <span>{currentAgent?.provider === 'google' ? 'Gemini 3' : currentAgent?.provider}</span>
               {hasSearchCapability && (
                  <span className="flex items-center gap-1 text-emerald-300 ml-2">
                    <Globe size={10} />
                    Web Search Active
                  </span>
               )}
             </div>
           </div>
        </div>

      </div>

      {/* Modals */}
      <AgentConfigModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAgent}
        onDelete={handleDeleteAgent}
        initialAgent={editingAgent}
        settings={settings}
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <AgentConversationModal
        isOpen={isConversationOpen}
        onClose={() => setIsConversationOpen(false)}
        agents={agents}
        settings={settings}
      />

      <PromptLibrary
        isOpen={showPromptLibrary}
        onClose={() => setShowPromptLibrary(false)}
        onSelectPrompt={(content) => setInputValue(content)}
        automations={automations}
        onLoadAutomation={handleLoadAutomation}
        onRunAutomation={handleRunAutomation}
        availableTools={availableTools}
      />

      <AnalyticsDashboard
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        agents={agents}
        messages={messages}
      />
    </div>
  );
}

export default App;
