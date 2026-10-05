import React, { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

interface AuthScreenProps {
  client: SupabaseClient | null;
  initialError?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ client, initialError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [canCreateAccount, setCanCreateAccount] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleRequestAccess = async () => {
    if (!formRef.current?.reportValidity()) return;
    setErrorMessage('');
    setNotice('');
    if (password.length < 6) {
      setErrorMessage('Your password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (!client) {
        setErrorMessage('Supabase is not configured. Add the required environment variables and restart the app.');
        return;
      }

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('rate limit') || message.includes('email rate')) {
          setCanCreateAccount(false);
          setErrorMessage('Account creation is temporarily unavailable. Please try again later, or sign in if you already have an account.');
          return;
        }
        throw error;
      }
      if (data.user?.identities?.length === 0) {
        setCanCreateAccount(false);
        setNotice('An account may already exist for this email. Try signing in or use Forgot password.');
        return;
      }
      setCanCreateAccount(false);
      if (!data.session) {
        setNotice('Supabase requires email confirmation before sign-in. Complete its confirmation step, or ask the project administrator to turn off Confirm email. Then sign in and submit your household access request.');
      } else {
        setNotice('Your account is ready. Submit your household access request on the next screen.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to request access. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setNotice('');
    setCanCreateAccount(false);
    setIsSubmitting(true);

    try {
      if (!client) {
        setErrorMessage('Supabase is not configured. Add the required environment variables and restart the app.');
        return;
      }

      if (isResetMode) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice('If an account exists for that email, a password reset link has been sent.');
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      if (!isResetMode) {
        const message = error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
        const isInvalidCredentials = message.toLowerCase().includes('invalid login credentials') ||
          (typeof error === 'object' && error !== null && 'code' in error && error.code === 'invalid_credentials');
        if (isInvalidCredentials) {
          setErrorMessage('We couldn’t sign you in with those details.');
          setCanCreateAccount(true);
        } else {
          setErrorMessage(message);
        }
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to send a password reset link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen min-h-screen bg-[#f4f6f1] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-[#e1e7dd] bg-white shadow-[0_24px_80px_-32px_rgba(34,53,38,0.24)] lg:min-h-[680px] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative flex flex-col justify-between overflow-hidden bg-[#eaf0e6] px-7 py-8 sm:px-12 sm:py-11 lg:px-14 lg:py-12">
            <div className="pointer-events-none absolute -right-28 -top-24 h-80 w-80 rounded-full bg-[#d8e4d2]" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[44px] border-[#dce7d7]" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#294d3a] text-white shadow-sm">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-[#20382b]">HearthLedger</div>
                <div className="text-xs font-medium text-[#5e7462]">Household finances, made clear</div>
              </div>
            </div>

            <div className="relative my-10 max-w-lg lg:my-0">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#cddac8] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#42624b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#598260]" />
                A calmer way to manage shared costs
              </p>
              <h1 className="max-w-md text-4xl font-semibold leading-[1.12] tracking-tight text-[#20382b] sm:text-5xl">
                Home finances,
                <br />
                all in one place.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#526756] sm:text-base">
                Keep bills, payments, and household contributions clear and fair for everyone.
              </p>

              <div className="mt-9 max-w-md rounded-2xl border border-[#dce4d8] bg-white/90 p-5 shadow-[0_12px_32px_-24px_rgba(34,53,38,0.35)]">
                <div className="flex items-center justify-between border-b border-[#edf0ea] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f4ed] text-[#41664c]">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#263a2c]">Household overview</p>
                      <p className="mt-0.5 text-xs text-[#738176]">Everyone on the same page</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#edf5ec] px-2.5 py-1 text-[11px] font-semibold text-[#4a7550]">
                    Up to date
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div className="rounded-xl bg-[#f7f8f5] p-3.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#718073]">
                      <CircleDollarSign className="h-4 w-4 text-[#628267]" />
                      Shared bills
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-[#263a2c]">One clear view</div>
                  </div>
                  <div className="rounded-xl bg-[#f7f8f5] p-3.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#718073]">
                      <Users className="h-4 w-4 text-[#628267]" />
                      Household
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-[#263a2c]">Fair splits</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-2 text-xs font-medium text-[#647568]">
              <ShieldCheck className="h-4 w-4 text-[#5f7d62]" />
              Private household workspace
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14">
            <div className="w-full max-w-sm">
              <div className="mb-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff5ed] text-[#41664c]">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#1f2d23]">
                  {isResetMode ? 'Reset your password' : 'Welcome'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657168]">
                  {isResetMode
                    ? 'Enter your email and we’ll send you a secure reset link.'
                    : 'Enter your email and password to sign in or request household access.'}
                </p>
              </div>

              {(initialError || (!client && !errorMessage)) && (
                <div className="mb-5 rounded-xl border border-[#e8d49b] bg-[#fff9e9] p-4 text-[#624919]">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#a77b27]" />
                    <div>
                      <p className="text-sm font-semibold">Sign-in setup needed</p>
                      <p className="mt-1 text-xs leading-5 text-[#765c2b]">
                        Add <code className="rounded bg-[#f7edcf] px-1 py-0.5">VITE_SUPABASE_URL</code> and{' '}
                        <code className="rounded bg-[#f7edcf] px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code> to the app
                        environment, then restart it.
                      </p>
                      {initialError && <p className="mt-2 text-xs leading-5 text-[#765c2b]">{initialError}</p>}
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {notice && (
                <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#4c5a50]">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setCanCreateAccount(false);
                      setErrorMessage('');
                      setNotice('');
                    }}
                    required
                    className="w-full rounded-xl border border-[#dce2da] bg-white px-4 py-3.5 text-sm text-[#233128] outline-none transition placeholder:text-[#a1aaa2] focus:border-[#729276] focus:ring-4 focus:ring-[#729276]/15"
                    placeholder="you@example.com"
                  />
                </div>

                {!isResetMode && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide text-[#4c5a50]">
                        Password
                      </label>
                      {client && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsResetMode(true);
                            setErrorMessage('');
                            setNotice('');
                          }}
                          className="text-xs font-semibold text-[#4b7252] hover:text-[#2c4a34]"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setCanCreateAccount(false);
                        setErrorMessage('');
                        setNotice('');
                      }}
                      required
                      className="w-full rounded-xl border border-[#dce2da] bg-white px-4 py-3.5 text-sm text-[#233128] outline-none transition placeholder:text-[#a1aaa2] focus:border-[#729276] focus:ring-4 focus:ring-[#729276]/15"
                      placeholder="Enter your password"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!client || isSubmitting}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#31563c] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_18px_-12px_rgba(49,86,60,0.8)] transition hover:bg-[#274831] focus:outline-none focus:ring-4 focus:ring-[#31563c]/20 disabled:cursor-not-allowed disabled:bg-[#aab5aa] disabled:text-white"
                >
                  {isSubmitting ? 'Please wait…' : isResetMode ? 'Send reset link' : 'Sign in'}
                  {!isSubmitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>

              {client && canCreateAccount && (
                <div className="mt-4 rounded-xl border border-[#cddac8] bg-[#f5f8f3] p-4">
                  <p className="text-sm font-semibold text-[#31563c]">New to this household?</p>
                  <p className="mt-1 text-xs leading-5 text-[#657168]">
                    Create an account with these details, then submit an access request. You can create a profile after approval.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleRequestAccess()}
                    disabled={isSubmitting}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#31563c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#274831] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Please wait…' : 'Create account'}
                  </button>
                </div>
              )}
              {isResetMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setErrorMessage('');
                    setNotice('');
                  }}
                  className="mt-4 block text-sm font-medium text-[#4b7252] hover:text-[#2c4a34]"
                >
                  Back to sign in
                </button>
              )}

              <div className="mt-8 border-t border-[#edf0ea] pt-5 text-center">
                <p className="text-xs leading-5 text-[#788279]">
                  Household accounts are managed by your workspace administrator.
                  <br />
                  Contact them if you need access.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};
