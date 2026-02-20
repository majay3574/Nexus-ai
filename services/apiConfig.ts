const DEFAULT_API_BASE_URL = 'http://localhost:3001';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const readEnvBaseUrl = (): string | null => {
  const env = (import.meta as any)?.env;
  const raw = typeof env?.VITE_API_BASE_URL === 'string' ? env.VITE_API_BASE_URL.trim() : '';
  return raw ? raw : null;
};

const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const isViteDevPort = (port: string): boolean => port === '5173' || port === '4173';

const resolveApiBaseUrl = (): string => {
  const envBase = readEnvBaseUrl();
  if (envBase) return trimTrailingSlash(envBase);

  if (typeof window !== 'undefined') {
    const origin = window.location?.origin || '';
    const hostname = window.location?.hostname || '';
    const port = window.location?.port || '';

    if (isLocalhost(hostname) && isViteDevPort(port)) {
      return DEFAULT_API_BASE_URL;
    }

    if (isLocalhost(hostname) && port && port !== '3001') {
      return DEFAULT_API_BASE_URL;
    }

    if (origin && origin !== 'null' && /^https?:\/\//i.test(origin)) {
      return origin;
    }
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = resolveApiBaseUrl();

export const buildApiUrl = (path: string): string => {
  if (!path) return API_BASE_URL;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
};
