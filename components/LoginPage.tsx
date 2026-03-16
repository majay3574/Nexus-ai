import React, { useMemo, useRef, useState } from 'react';
import { ShieldCheck, Mail, Lock, User } from 'lucide-react';
import { loginUser, registerUser, AuthUser } from '../services/authService';
import { API_BASE_URL } from '../services/apiConfig';

interface LoginPageProps {
  onAuthSuccess: (token: string, user: AuthUser) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const desktopDownloadUrl = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_URL || '').trim();
  const desktopDownloadLabel = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_LABEL || 'Download Desktop App').trim();
  const desktopDownloadNote = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_NOTE || 'Run it locally for private, on-device Ollama.').trim();
  const desktopDownloadUrlWin = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_URL_WINDOWS || '').trim();
  const desktopDownloadUrlMac = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_URL_MAC || '').trim();
  const desktopDownloadUrlLinux = ((import.meta as any)?.env?.VITE_DESKTOP_DOWNLOAD_URL_LINUX || '').trim();
  const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent || '');

  const detectPlatform = (): 'windows' | 'mac' | 'linux' | 'unknown' => {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux') || ua.includes('x11')) return 'linux';
    return 'unknown';
  };

  const platform = detectPlatform();
  const platformLabels: Record<string, string> = {
    windows: 'Windows',
    mac: 'macOS',
    linux: 'Linux',
    unknown: 'Desktop'
  };

  const platformUrls: Record<string, string> = {
    windows: desktopDownloadUrlWin,
    mac: desktopDownloadUrlMac,
    linux: desktopDownloadUrlLinux
  };

  const buildDownloadOptions = () => {
    if (desktopDownloadUrl) {
      return [{ label: desktopDownloadLabel, url: desktopDownloadUrl }];
    }
    const platformUrl = platformUrls[platform];
    if (platformUrl) {
      return [{ label: `Download for ${platformLabels[platform]}`, url: platformUrl }];
    }
    const options = [
      { label: 'Download for Windows', url: desktopDownloadUrlWin },
      { label: 'Download for macOS', url: desktopDownloadUrlMac },
      { label: 'Download for Linux', url: desktopDownloadUrlLinux }
    ].filter((opt) => opt.url);
    return options;
  };

  const downloadOptions = buildDownloadOptions();
  const showDownload = downloadOptions.length > 0 && !isElectron;

  const isRegister = mode === 'register';

  const subtitle = useMemo(() => {
    if (isRegister) return 'Create a secure local account backed by SQLite.';
    return 'Sign in to continue your private workspace.';
  }, [isRegister]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Email and password are required.');
      return;
    }
    if (isRegister && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = isRegister
        ? await registerUser(name.trim(), trimmedEmail, password)
        : await loginUser(trimmedEmail, password);
      try {
        const navAny = navigator as any;
        const winAny = window as any;
        if (formRef.current && navAny?.credentials?.store && winAny?.PasswordCredential) {
          const cred = new winAny.PasswordCredential(formRef.current);
          await navAny.credentials.store(cred);
        }
      } catch (e) {}
      onAuthSuccess(response.token, response.user);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 px-4 sm:px-6 py-10 relative">
      <div className="w-full max-w-md sm:max-w-lg">
        <div className="glass-panel p-5 sm:p-8 rounded-2xl sm:rounded-3xl flex flex-col justify-center sm:animate-float">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_24px_rgba(45,212,191,0.25)]">
              <ShieldCheck className="text-emerald-300" size={26} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Nexus Agent Studio</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white">Secure Access</h1>
            </div>
          </div>
          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">{isRegister ? 'Create account' : 'Sign in'}</h2>
            <p className="text-sm text-slate-400 mt-2">
              {isRegister ? 'Set up your local login in seconds.' : 'Welcome back. Enter your credentials.'}
            </p>
          </div>

          <form ref={formRef} className="mt-6 space-y-3 sm:space-y-4" onSubmit={handleSubmit} autoComplete="on">
            {isRegister && (
              <label className="block text-sm text-slate-300">
                Name
                <div className="mt-2 flex items-center gap-2 neo-input rounded-lg px-3 py-2">
                  <User size={16} className="text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-transparent w-full text-sm text-slate-100 focus:outline-none"
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

              <label className="block text-sm text-slate-300">
              Email
              <div className="mt-2 flex items-center gap-2 neo-input rounded-lg px-3 py-2">
                <Mail size={16} className="text-slate-400" />
                <input
                  type="email"
                  name="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="bg-transparent w-full text-sm text-slate-100 focus:outline-none"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

              <label className="block text-sm text-slate-300">
              Password
              <div className="mt-2 flex items-center gap-2 neo-input rounded-lg px-3 py-2">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Create a password' : 'Your password'}
                  className="bg-transparent w-full text-sm text-slate-100 focus:outline-none"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
              </div>
            </label>

            {error && (
              <div className="text-xs sm:text-sm text-red-300 bg-red-900/20 border border-red-500/40 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:translate-y-[-1px]'
              } neo-button`}
            >
              {isSubmitting ? 'Working...' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-xs text-slate-400">
            {isRegister ? 'Already have an account?' : 'New here?'}
            <button
              type="button"
              className="ml-2 text-emerald-300 hover:text-emerald-200"
              onClick={() => {
                setError(null);
                setMode(isRegister ? 'login' : 'register');
              }}
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>
        {showDownload ? (
          <div className="mt-4 glass-panel p-4 sm:p-5 rounded-2xl border border-emerald-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Desktop App</p>
                <p className="text-xs text-slate-400 mt-1">{desktopDownloadNote}</p>
                <p className="text-[11px] text-emerald-200 mt-2">After download, open the installer to launch the desktop app.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {downloadOptions.map((option) => (
                  <a
                    key={option.url}
                    href={option.url}
                    className="neo-button px-4 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap"
                    download
                  >
                    {option.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-6 w-full text-center text-xs text-slate-400 md:mt-0 md:w-auto md:text-right md:absolute md:right-6 md:bottom-4">
        Founder:{' '}
        <a
          href="https://www.linkedin.com/in/ajay-michael"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-300 hover:text-emerald-200"
        >
          Ajay Michael
        </a>
      </div>
    </div>
  );
};

export default LoginPage;
