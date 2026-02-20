export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
  groundingMetadata?: GroundingMetadata;
  edited?: boolean;
  editedAt?: number;
  pinned?: boolean;
  tokens?: number;
}

export interface GroundingMetadata {
  groundingChunks?: {
    web?: {
      uri: string;
      title: string;
    };
  }[];
  webSearchQueries?: string[];
}

export type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'xai' | 'local';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  provider: AIProvider;
  model: string;
  avatarUrl?: string;
  color?: string;
  tools?: string[]; // e.g. ['googleSearch']
}

export type ChatState = Record<string, Message[]>;

export interface AppSettings {
  googleApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  xaiApiKey?: string;
  localBaseUrl?: string;
  localApiKey?: string;
  theme?: 'dark' | 'light' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  compactMode?: boolean;
  soundEnabled?: boolean;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: number;
  usageCount?: number;
}

export interface AutomationDefinition {
  id: string;
  title: string;
  description: string;
  prompt: string;
  requiredTools?: string[];
  badge?: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  color?: string;
  agentIds: string[];
  createdAt: number;
}

export enum ModelType {
  // Google
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
}

// Agent-to-Agent Conversation Types
export interface AgentConversationMessage {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: number;
  turnNumber: number;
}

export interface AgentConversation {
  id: string;
  agent1Id: string;
  agent2Id: string;
  topic: string;
  messages: AgentConversationMessage[];
  turnCount: number;
  maxTurns: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: number;
  updatedAt: number;
}
