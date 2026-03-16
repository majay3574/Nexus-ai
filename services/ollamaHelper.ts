const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export const isLocalHostname = (hostname: string): boolean => LOCAL_HOSTNAMES.has(hostname);

export const resolveOllamaOrigin = (): string => {
  if (typeof window === 'undefined') return 'https://nexus-ai-il1c.onrender.com';
  const origin = window.location?.origin || '';
  if (!origin || origin === 'null') return 'http://localhost:5173';
  return origin;
};

export const buildLocalSaferBat = (origin: string): string => [
  '@echo off',
  'setlocal',
  `set "OLLAMA_ORIGINS=${origin}"`,
  'taskkill /IM ollama.exe /F >nul 2>&1',
  'ollama serve',
  'pause',
  'endlocal'
].join('\r\n');

export const downloadLocalSaferBat = (origin?: string): void => {
  if (typeof window === 'undefined') return;
  const resolvedOrigin = origin || resolveOllamaOrigin();
  const content = buildLocalSaferBat(resolvedOrigin);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'localSafer.bat';
  link.click();
  URL.revokeObjectURL(url);
};
