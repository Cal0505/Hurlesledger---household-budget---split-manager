import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertCircle, CheckCircle2, LockKeyhole, Wallet } from 'lucide-react';

interface PasswordRecoveryScreenProps {
  client: SupabaseClient;
  onComplete: () => void;
}

export const PasswordRecoveryScreen: React.FC<PasswordRecoveryScreenProps> = ({ client, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    if (password.length < 6) {
      setErrorMessage('Your password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setIsSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen min-h-screen flex items-center justify-center p-4 md:p-8">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-xl sm:p-10">
        <div className="flex items-center gap-3 mb-9">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">HearthLedger</span>
        </div>

        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5">
          {isSaved ? <CheckCircle2 className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isSaved ? 'Password updated' : 'Choose a new password'}
        </h1>
        <p className="text-sm text-neutral-600 mt-2 mb-6">
          {isSaved ? 'Your new password is ready to use.' : 'Create a new password for your account.'}
        </p>

        {errorMessage && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSaved ? (
          <button
            type="button"
            onClick={onComplete}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Continue to HearthLedger
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-neutral-800 mb-1.5">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                className="w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-800 mb-1.5">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
                className="w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
