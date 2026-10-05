import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, CheckCircle2, Clock3, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { HOUSEHOLD_MEMBER_COLORS } from '../constants/memberColors';

interface HouseholdAccessScreenProps {
  client: SupabaseClient;
  email: string;
  status: 'profile' | 'pending' | 'denied' | 'none';
  onRefresh: () => void;
  onSignOut: () => Promise<void>;
}

export const HouseholdAccessScreen: React.FC<HouseholdAccessScreenProps> = ({
  client,
  email,
  status,
  onRefresh,
  onSignOut,
}) => {
  const [memberName, setMemberName] = useState('');
  const [avatarColor, setAvatarColor] = useState(HOUSEHOLD_MEMBER_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequest = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const { submitHouseholdAccessRequest } = await import('../utils/database');
      await submitHouseholdAccessRequest(client);
      onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit your access request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const { createApprovedHouseholdMemberProfile } = await import('../utils/database');
      await createApprovedHouseholdMemberProfile(client, memberName, avatarColor);
      onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create your household profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="access-screen min-h-screen flex items-center justify-center bg-[#f4f6f1] p-4">
      <section className="w-full max-w-md rounded-2xl border border-[#e1e7dd] bg-white p-7 shadow-xl sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff5ed] text-[#41664c]">
          {status === 'pending' ? <Clock3 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#1f2d23]">
          {status === 'pending'
            ? 'Request awaiting approval'
            : status === 'profile'
              ? 'Create your household profile'
              : 'Request household access'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#657168]">
          Signed in as <strong className="font-semibold text-[#405046]">{email}</strong>.
          {status === 'pending'
            ? ' An authorized household user needs to approve your access request.'
            : status === 'denied'
              ? ' Your previous request was not approved. You can submit a new request for household access.'
              : status === 'profile'
                ? ' Your household access has been approved. Create your profile to finish setting up your account.'
                : ' Request access to the household. Once an authorized user approves you, you can create your household profile.'}
        </p>

        {status === 'pending' ? (
          <div className="mt-6 rounded-xl border border-[#dce7d7] bg-[#f4f8f1] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#35543a]">
              <CheckCircle2 className="h-4 w-4" />
              Request submitted
            </div>
            <p className="mt-2 text-xs leading-5 text-[#607162]">
              An authorized household user must approve your access before you can create your profile.
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 rounded-lg border border-[#cddac8] bg-white px-3 py-2 text-xs font-semibold text-[#405d44] hover:bg-[#f8faf6]"
            >
              Check approval status
            </button>
          </div>
        ) : status === 'profile' ? (
          <form onSubmit={handleCreateProfile} className="mt-6 space-y-4">
            <div>
              <label htmlFor="access-member-name" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#4c5a50]">
                Your name
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#788279]" />
                <input
                  id="access-member-name"
                  type="text"
                  autoComplete="name"
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  required
                  maxLength={80}
                  className="w-full rounded-xl border border-[#dce2da] bg-white py-3.5 pl-10 pr-4 text-sm text-[#233128] outline-none focus:border-[#729276] focus:ring-4 focus:ring-[#729276]/15"
                  placeholder="Enter your name"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#788279]">
                Your login email will be saved with your household profile.
              </p>
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#4c5a50]">
                Avatar color
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {HOUSEHOLD_MEMBER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    aria-label={`Choose avatar color ${color}`}
                    aria-pressed={avatarColor === color}
                    className="relative flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 focus:outline-none focus:ring-2 focus:ring-[#31563c]"
                    style={{ backgroundColor: color }}
                  >
                    {avatarColor === color && <Check className="h-4 w-4 stroke-[3] text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={!memberName.trim() || isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#31563c] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#274831] disabled:cursor-not-allowed disabled:bg-[#e5ebe3] disabled:text-[#405046] disabled:opacity-100"
            >
              <ShieldCheck className="h-4 w-4" />
              {isSubmitting ? 'Saving profile…' : 'Create household profile'}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            {errorMessage && (
              <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleRequest()}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#31563c] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#274831] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {isSubmitting ? 'Sending request…' : status === 'denied' ? 'Resubmit access request' : 'Request access'}
            </button>
          </div>
        )}

        {errorMessage && status === 'pending' && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={() => void onSignOut()}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#657168] hover:text-[#263a2c]"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>
    </main>
  );
};
