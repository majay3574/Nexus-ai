import { AgentConfig, ModelType } from './types';

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'agent-1',
    name: 'Nexus Assistant',
    description: 'A helpful and versatile general assistant.',
    systemInstruction: 'You are Nexus, a helpful, witty, and precise AI assistant. You aim to provide clear and concise answers. You are knowledgeable about code, science, and general trivia.',
    provider: 'google',
    model: ModelType.FLASH,
    avatarUrl: 'https://picsum.photos/seed/nexus/200/200',
    color: 'blue'
  },
  {
    id: 'agent-2',
    name: 'Code Architect',
    description: 'Expert in software design patterns and React.',
    systemInstruction: 'You are a senior principal software engineer. You specialize in React, TypeScript, and Tailwind CSS. You prefer functional programming patterns and emphasize clean, maintainable code. You are critical but constructive.',
    provider: 'google',
    model: ModelType.PRO,
    avatarUrl: 'https://picsum.photos/seed/coder/200/200',
    color: 'emerald'
  },
  {
    id: 'agent-3',
    name: 'Creative Spark',
    description: 'A creative writing partner for stories and poems.',
    systemInstruction: 'You are a creative writing muse. You help users brainstorm ideas, write scenes, and improve prose. Your tone is inspiring, imaginative, and slightly poetic.',
    provider: 'google',
    model: ModelType.PRO,
    avatarUrl: 'https://picsum.photos/seed/creative/200/200',
    color: 'purple'
  }
];

export const INITIAL_MESSAGE: string = "Hello! I'm ready to help. What's on your mind?";
