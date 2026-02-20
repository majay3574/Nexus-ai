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
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-5xl grid gap-8 md:grid-cols-[1.1fr_0.9fr] items-stretch">
        <div className="neo-panel p-10 rounded-3xl animate-float flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_24px_rgba(45,212,191,0.25)]">
                <ShieldCheck className="text-emerald-300" size={28} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Nexus Agent Studio</p>
                <h1 className="text-3xl font-semibold text-white">Secure Access</h1>
              </div>
            </div>
            <p className="mt-6 text-base text-slate-300 leading-relaxed">
              {subtitle}
            </p>
            <div className="mt-8 grid gap-4">
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-sm text-slate-200 font-medium">Local-first credentials</p>
                <p className="text-xs text-slate-400 mt-1">Passwords are hashed and stored in a local SQLite database.</p>
              </div>
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-sm text-slate-200 font-medium">Session-based access</p>
                <p className="text-xs text-slate-400 mt-1">Sessions are issued by the Node server with configurable expiry.</p>
              </div>
              <div className="glass-panel rounded-2xl p-4">
                <p className="text-sm text-slate-200 font-medium">Private workspace</p>
                <p className="text-xs text-slate-400 mt-1">Your chat data remains on-device in IndexedDB.</p>
              </div>
            </div>
          </div>
          <div className="mt-10 text-xs text-slate-500">
            Auth server: <span className="text-slate-300">{API_BASE_URL}</span>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl flex flex-col justify-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">{isRegister ? 'Create account' : 'Sign in'}</h2>
            <p className="text-sm text-slate-400 mt-2">
              {isRegister ? 'Set up your local login in seconds.' : 'Welcome back. Enter your credentials.'}
            </p>
          </div>

          <form ref={formRef} className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
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
              <div className="text-sm text-red-300 bg-red-900/20 border border-red-500/40 px-3 py-2 rounded-lg">
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
      </div>
    </div>
  );
};

export default LoginPage;
