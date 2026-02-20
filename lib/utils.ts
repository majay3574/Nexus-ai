// Token estimation (rough approximation)
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// Relative time formatting
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Search messages
export const searchMessages = (messages: any[], query: string): any[] => {
  if (!query.trim()) return messages;
  const lowerQuery = query.toLowerCase();
  return messages.filter(m => m.content.toLowerCase().includes(lowerQuery));
};
