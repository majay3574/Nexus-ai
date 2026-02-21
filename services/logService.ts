import { buildApiUrl } from './apiConfig';

export type LogLevel = 'info' | 'warn' | 'error';

export const logEvent = async (
  event: string,
  data: Record<string, unknown> = {},
  level: LogLevel = 'info'
): Promise<void> => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    await fetch(buildApiUrl('/api/log'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        event,
        data,
        level,
        source: 'client',
        ts: Date.now()
      })
    });
  } catch {
    // Intentionally ignore logging errors to avoid impacting UX.
  }
};
