import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock3, RefreshCw, X } from 'lucide-react';
import { HouseholdAccessRequest } from '../types/budget';

interface AccessRequestsPanelProps {
  requests: HouseholdAccessRequest[];
  onResolveRequest: (userId: string, approve: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const AccessRequestsPanel: React.FC<AccessRequestsPanelProps> = ({
  requests,
  onResolveRequest,
  onRefresh,
}) => {
  const [processingUserId, setProcessingUserId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    let isMounted = true;
    let isLoadingRequests = false;
    const refreshRequests = async () => {
      if (isLoadingRequests) return;
      isLoadingRequests = true;
      try {
        await onRefreshRef.current();
        if (isMounted) setErrorMessage('');
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to refresh access requests.');
        }
      } finally {
        isLoadingRequests = false;
      }
    };

    void refreshRequests();
    const intervalId = window.setInterval(() => void refreshRequests(), 15000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const resolve = async (userId: string, approve: boolean) => {
    setProcessingUserId(userId);
    setErrorMessage('');
    try {
      await onResolveRequest(userId, approve);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to review the access request.');
    } finally {
      setProcessingUserId('');
    }
  };

  const refresh = async () => {
    setIsRefreshing(true);
    setErrorMessage('');
    try {
      await onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to refresh access requests.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (requests.length === 0 && !errorMessage) {
    return (
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={isRefreshing}
        className="mb-5 inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Checking access requests…' : 'Check access requests'}
      </button>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-neutral-500" />
        <h2 className="text-sm font-semibold text-neutral-900">Access requests</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
          {requests.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-neutral-600">
        Approve access first. New users will create their household profile after approval.
      </p>

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={isRefreshing || processingUserId !== ''}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh requests
      </button>

      <div className="mt-3 space-y-2">
        {requests.map((request) => (
          <div
            key={request.userId}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">
                {request.memberName || 'Profile will be created after approval'}
              </p>
              <p className="truncate text-xs text-neutral-600">{request.email}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Requested {new Date(request.createdAt).toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => void resolve(request.userId, false)}
                disabled={processingUserId !== ''}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Deny
              </button>
              <button
                type="button"
                onClick={() => void resolve(request.userId, true)}
                disabled={processingUserId !== ''}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#31563c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#274831] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {processingUserId === request.userId
                  ? 'Saving…'
                  : request.memberName
                    ? 'Approve & link'
                    : 'Approve access'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{errorMessage}</p>
      )}
    </section>
  );
};
