import React, { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Shield,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface AuthScreenProps {
  client: SupabaseClient | null;
  initialError?: string;
}

type Mode = 'signin' | 'signup' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({ client, initialError }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const resetState = () => {
    setErrorMessage('');
    setNotice('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleModeChange = (newMode: Mode) => {
    resetState();
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setNotice('');
    setIsSubmitting(true);

    try {
      if (!client) {
        setErrorMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
        return;
      }

      if (mode === 'signup') {
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          return;
        }

        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('rate limit') || msg.includes('email rate')) {
            setErrorMessage('Too many attempts. Please try again later.');
            return;
          }
          throw error;
        }

        if (data.user?.identities?.length === 0) {
          setNotice('An account already exists for this email. Please sign in.');
          setMode('signin');
          return;
        }

        setNotice('Account created! Check your email to verify, then sign in.');
        setMode('signin');
        return;
      }

      if (mode === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice('If an account exists, a reset link has been sent to your email.');
        return;
      }

      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f8f0] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Soft background glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#d8e4d2]/40 blur-3xl -translate-y-1/3" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[#2f6b4a]/5 blur-3xl translate-y-1/3" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#2f6b4a] text-white mb-4">
            <Shield size={26} />
          </div>
          <h1 className="text-2xl font-bold text-[#1a3529]">HurlesLedger</h1>
          <p className="text-sm text-[#5a7568] mt-1">Household finances, made clear</p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-lg border border-white/60 p-8">
          {/* Mode Tabs — Improved contrast */}
          <div className="flex mb-8 bg-[#e8f0e5] rounded-xl p-1">
            <button
              onClick={() => handleModeChange('signin')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-[#2f6b4a] text-white shadow-md'
                  : 'text-[#5a7568] hover:text-[#2f6b4a] hover:bg-white/60'
              }`}
            >
              <LogIn size={16} />
              Sign In
            </button>
            <button
              onClick={() => handleModeChange('signup')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-[#2f6b4a] text-white shadow-md'
                  : 'text-[#5a7568] hover:text-[#2f6b4a] hover:bg-white/60'
              }`}
            >
              <UserPlus size={16} />
              Create Account
            </button>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#1a3529]">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'signup' && 'Join HurlesLedger'}
              {mode === 'reset' && 'Reset your password'}
            </h2>
            <p className="text-sm text-[#6b7b72] mt-1">
              {mode === 'signin' && 'Sign in to manage your household finances'}
              {mode === 'signup' && 'Get started with clear, shared household budgeting'}
              {mode === 'reset' && 'Enter your email and we’ll send you a reset link'}
            </p>
          </div>

          {/* Status Messages */}
          {(initialError || (!client && !errorMessage)) && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Setup required</p>
                  <p className="mt-1 text-xs opacity-80">
                    Add your Supabase environment variables and restart the app.
                  </p>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          {notice && (
            <div role="status" className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {notice}
            </div>
          )}

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[#5a7568] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-[#c8d4c2] bg-[#f0f5ed] px-4 py-3.5 text-sm text-[#1a3529] outline-none transition placeholder:text-[#94a898] focus:border-[#2f6b4a] focus:bg-white focus:ring-2 focus:ring-[#2f6b4a]/15"
                placeholder="you@example.com"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#5a7568]">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('reset')}
                      className="text-xs text-[#2f6b4a] hover:text-[#1a3529]"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#c8d4c2] bg-[#f0f5ed] px-4 py-3.5 text-sm text-[#1a3529] outline-none transition placeholder:text-[#94a898] focus:border-[#2f6b4a] focus:bg-white focus:ring-2 focus:ring-[#2f6b4a]/15"
                  placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-[#5a7568] mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#c8d4c2] bg-[#f0f5ed] px-4 py-3.5 text-sm text-[#1a3529] outline-none transition placeholder:text-[#94a898] focus:border-[#2f6b4a] focus:bg-white focus:ring-2 focus:ring-[#2f6b4a]/15"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!client || isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2f6b4a] hover:bg-[#25563c] text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Please wait…</span>
              ) : (
                <>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'reset' && 'Send Reset Link'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              className="mt-4 w-full text-center text-sm text-[#5a7568] hover:text-[#2f6b4a]"
            >
              ← Back to Sign In
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#7a9486] mt-6">
          Need access? Contact your workspace administrator.
        </p>
      </div>
    </main>
  );
};