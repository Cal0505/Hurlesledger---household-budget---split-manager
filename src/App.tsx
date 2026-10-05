import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActiveTab, AppState, HouseholdBill, Member, Transaction } from './types/budget';
import { AuthScreen } from './components/AuthScreen';
import { AccessRequestsPanel } from './components/AccessRequestsPanel';
import { HouseholdAccessScreen } from './components/HouseholdAccessScreen';
import { PasswordRecoveryScreen } from './components/PasswordRecoveryScreen';
import { ThemeMode } from './components/Header';
import { supabaseClient, supabaseConfigurationError } from './utils/supabase';
import { getMemberBalanceStatus, getEmptyState } from './utils/storage';
import type { HouseholdAccessRequest } from './types/budget';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PersonalDashboard } from './components/PersonalDashboard';
import { IncomingView } from './components/IncomingView';
import { OutgoingView } from './components/OutgoingView';
import { HouseholdBillsView } from './components/HouseholdBillsView';
import { MemberProfilesView } from './components/MemberProfilesView';
import { SettlementMatrixView } from './components/SettlementMatrixView';
import { CsvImportModal } from './components/CsvImportModal';
import { BillModal } from './components/BillModal';
import { TransactionModal } from './components/TransactionModal';
import { MemberModal } from './components/MemberModal';

const THEME_STORAGE_KEY = 'hearthledger_theme_mode';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(!!supabaseClient);
  const [authError, setAuthError] = useState('');
  const [accessStatus, setAccessStatus] = useState<'checking' | 'authorized' | 'profile' | 'pending' | 'denied' | 'none' | 'error'>('checking');
  const [accessError, setAccessError] = useState('');
  const [accessRetry, setAccessRetry] = useState(0);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch (error) {
      console.warn('Unable to read saved theme preference', error);
      return 'system';
    }
  });
  const effectiveTheme = session && !isPasswordRecovery ? themeMode : 'light';

  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      root.dataset.theme = effectiveTheme === 'system'
        ? systemTheme.matches ? 'dark' : 'light'
        : effectiveTheme;
    };

    applyTheme();
    if (effectiveTheme === 'system') {
      systemTheme.addEventListener('change', applyTheme);
      return () => systemTheme.removeEventListener('change', applyTheme);
    }
  }, [effectiveTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch (error) {
      console.warn('Unable to save theme preference', error);
    }
  }, [themeMode]);

  useEffect(() => {
    if (!supabaseClient) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
        setAuthError('');
        setIsAuthLoading(false);
      }
    });
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setAuthError(error.message);
      } else {
        setSession(data.session);
      }
      setIsAuthLoading(false);
    }).catch((error: unknown) => {
      if (!isMounted) return;
      setAuthError(error instanceof Error ? error.message : 'Unable to check your sign-in session.');
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccessStatus('none');
      return;
    }

    let isMounted = true;
    setAccessStatus('checking');
    setAccessError('');
    import('./utils/database').then(({ getHouseholdAccessStatus }) =>
      getHouseholdAccessStatus(supabaseClient!, session.user.id)
    ).then((status) => {
      if (isMounted) setAccessStatus(status);
    }).catch((error: unknown) => {
      if (!isMounted) return;
      setAccessError(error instanceof Error ? error.message : 'Unable to check household access.');
      setAccessStatus('error');
    });

    return () => {
      isMounted = false;
    };
  }, [session, accessRetry]);

  const handleSignOut = async () => {
    if (!supabaseClient) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-700">
        <p className="text-sm">Checking your sign-in…</p>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen client={supabaseClient} initialError={authError || supabaseConfigurationError} />;
  }

  if (isPasswordRecovery && supabaseClient) {
    return (
      <PasswordRecoveryScreen
        client={supabaseClient}
        onComplete={() => setIsPasswordRecovery(false)}
      />
    );
  }

  if (accessStatus === 'checking') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-700">
        <p className="text-sm">Checking household access…</p>
      </main>
    );
  }

  if (accessStatus === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4f6f1] p-4">
        <section className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Couldn’t check household access</h1>
          <p role="alert" className="mt-2 text-sm text-rose-700">{accessError}</p>
          <button
            type="button"
            onClick={() => setAccessRetry((attempt) => attempt + 1)}
            className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="ml-3 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }
  if (accessStatus === 'profile' || accessStatus === 'pending' || accessStatus === 'denied' || accessStatus === 'none') {
    if (!supabaseClient) {
      return <AuthScreen client={null} initialError={supabaseConfigurationError} />;
    }
    return (
      <HouseholdAccessScreen
        client={supabaseClient}
        email={session.user.email || ''}
        status={accessStatus}
        onRefresh={() => setAccessRetry((attempt) => attempt + 1)}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <HouseholdApp
      themeMode={themeMode}
      onChangeTheme={setThemeMode}
      signedInUserId={session.user.id}
      userEmail={session.user.email || 'Signed-in user'}
      onSignOut={handleSignOut}
      supabaseClient={supabaseClient!}
    />
  );
}

interface HouseholdAppProps {
  themeMode: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  signedInUserId: string;
  userEmail: string;
  onSignOut: () => Promise<void>;
  supabaseClient: NonNullable<typeof supabaseClient>;
}

function HouseholdApp({ themeMode, onChangeTheme, signedInUserId, userEmail, onSignOut, supabaseClient }: HouseholdAppProps) {
  const [state, setState] = useState<AppState>(getEmptyState);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [accessRequests, setAccessRequests] = useState<HouseholdAccessRequest[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const stateRef = useRef(state);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isAccountHolder = state.members.some(
    (member) => member.authUserId === signedInUserId && member.isAccountHolder
  );
  const visibleMembers = isAccountHolder
    ? state.members
    : state.members.filter((member) => member.authUserId === signedInUserId);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const displayedTab = isAccountHolder ? activeTab : 'members';
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<HouseholdBill | null>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txPrefill, setTxPrefill] = useState<Partial<Transaction> | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  // 🌟 CENTRALIZED DATE SELECTION: Powers cross-month totals across sidebars
  const [activeLedgerDate, setActiveLedgerDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const currentMonthKey = `${activeLedgerDate.getFullYear()}-${String(activeLedgerDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    try {
      localStorage.removeItem('hearthledger_household_state_v1');
    } catch (error) {
      console.warn('Unable to remove the previous local demo data', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsDataLoading(true);
    setLoadError('');

    if (!supabaseClient) {
      setLoadError('Supabase is not configured. Check the app environment and restart.');
      setIsDataLoading(false);
      return;
    }

    const client = supabaseClient;
    import('./utils/database').then(async ({
      loadHouseholdData,
      listPendingHouseholdAccessRequests,
    }) => {
      const loadedState = await loadHouseholdData(client);
      const requests = await listPendingHouseholdAccessRequests(client);
      return { loadedState, requests };
    }).then(({ loadedState, requests }) => {
      if (!isMounted) return;
      stateRef.current = loadedState;
      setState(loadedState);
      setAccessRequests(requests);
      // 🎯 FIXED: Length boundaries protect against raw accessor breaks
      setSelectedMemberId(loadedState.members && loadedState.members.length > 0 ? loadedState.members[0].id : null);
      setIsDataLoading(false);
    }).catch((error: unknown) => {
      if (!isMounted) return;
      setLoadError(error instanceof Error ? error.message : 'Unable to load household data.');
      setIsDataLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  const commitState = (update: (current: AppState) => AppState) => {
    const operation = mutationQueueRef.current.then(async () => {
      if (!supabaseClient) throw new Error('Supabase is not configured.');
      const previousState = stateRef.current;
      const nextState = update(previousState);
      const { saveHouseholdChanges } = await import('./utils/database');
      await saveHouseholdChanges(supabaseClient, previousState, nextState);
      stateRef.current = nextState;
      setState(nextState);
      setSaveError('');
    });

    mutationQueueRef.current = operation.catch((error: unknown) => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save changes to Supabase.');
    });
  };

  useEffect(() => {
    // 🎯 FIXED: Adds explicit boundary checks to shield the dashboard layout elements
    if (!selectedMemberId && state.members && state.members.length > 0) {
      setSelectedMemberId(state.members[0].id);
    }
  }, [state.members, selectedMemberId]);
  // 🌟 MASTER BALANCE ENGINE: Calculates true multi-month cumulative remaining dues
  // 🌟 FIXED SIDEBAR BALANCES: Filters bills by month to clear out the 3x inflated balance bug!
  const memberBalances = useMemo(() => {
    const map: Record<string, { totalMonthlyShare: number; totalPaid: number; remainingDue: number }> = {};

    state.members.forEach((m) => {
      if (m.isAccountHolder) {
        map[m.id] = { totalMonthlyShare: 0, totalPaid: 0, remainingDue: 0 };
        return;
      }

      const uniqueMonths = new Set<string>();
      state.bills.forEach(b => b.incurredDate && uniqueMonths.add(b.incurredDate.slice(0, 7)));
      uniqueMonths.add(currentMonthKey);

      let totalBillsAllTime = 0;
      let totalPaymentsAllTime = 0;

      // Loop through each distinct billing cycle timeline slot
      uniqueMonths.forEach(mKey => {
        // 🎯 FIX: Added .filter() to isolate only bills that belong to the active loop month key
        state.bills
          .filter(b => b.isActive && b.incurredDate && b.incurredDate.startsWith(mKey))
          .forEach(bill => {
            if (!bill.participatingMemberIds.includes(m.id)) return;
            const totalParts = bill.participatingMemberIds.length;
            if (totalParts === 0) return;
            
            const baseShare = Math.floor((bill.amount / totalParts) * 100) / 100;
            const sorted = [...bill.participatingMemberIds].sort();
            
            if (sorted.indexOf(m.id) >= 0 && sorted.indexOf(m.id) < Math.round((bill.amount - (baseShare * totalParts)) * 100)) {
              totalBillsAllTime += Math.round((baseShare + 0.01) * 100) / 100;
            } else {
              totalBillsAllTime += baseShare;
            }
          });
      });

      // Accumulate payments received from this roommate
      state.transactions
        .filter(tx => tx.type === 'incoming' && (tx.fromMemberId === m.id || (tx as any).memberId === m.id))
        .forEach(tx => { totalPaymentsAllTime += tx.amount; });

      map[m.id] = {
        totalMonthlyShare: totalBillsAllTime,
        totalPaid: totalPaymentsAllTime,
        remainingDue: Math.max(0, Math.round((totalBillsAllTime - totalPaymentsAllTime) * 100) / 100),
      };
    });
    return map;
  }, [state.members, state.bills, state.transactions, currentMonthKey]);


  // Navigation trigger helper
  const handleNavigate = (tab: ActiveTab, memberId?: string) => {
    setActiveTab(tab);
    if (memberId) {
      setSelectedMemberId(memberId);
    }
  };

  // Transaction state handlers
  const handleImportCsvTransactions = (newTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    const formatted: Transaction[] = newTransactions.map((transaction) => ({
      ...transaction,
      id: `tx-csv-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    }));
    commitState((prev) => ({
      ...prev,
      transactions: [...formatted, ...prev.transactions],
    }));
  };

  const handleSaveTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };

    commitState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));
  };
  const handleDeleteTransaction = (id: string) => {
    commitState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  // Pulls cumulative rolling history arrears directly into the pre-filled modal amount!
  const handleRecordCashOverride = (memberId: string) => {
    const targetMember = state.members.find(m => m.id === memberId);
    const activeBalanceInfo = memberBalances[memberId];
    if (!targetMember || !activeBalanceInfo) return;

    setTxPrefill({
      type: 'incoming',
      source: 'manual',
      category: 'Other',
      amount: activeBalanceInfo.remainingDue > 0 ? activeBalanceInfo.remainingDue : undefined,
      description: `Cash settlement from ${targetMember.name}`,
      date: new Date().toISOString().split('T')[0],
      fromMemberId: memberId,
      ...({ memberId: memberId })
    } as any);
    
    setIsTxModalOpen(true);
  };

  // Bill handlers
  const handleSaveBill = (
    billData: Omit<HouseholdBill, 'id' | 'createdAt'>,
    billId?: string,
    outgoingTransactionIds?: string[]
  ) => {
    if (billId) {
      commitState((prev) => ({
        ...prev,
        bills: prev.bills.map((b) => (b.id === billId ? { ...b, ...billData } : b)),
      }));
    } else {
      const transactionsToLink = outgoingTransactionIds?.map((transactionId) =>
        state.transactions.find((transaction) => transaction.id === transactionId)
      );
      if (outgoingTransactionIds && (
        !isAccountHolder
        || !transactionsToLink
        || transactionsToLink.some((transaction) =>
          !transaction
          || transaction.type !== 'outgoing'
          || transaction.source !== 'csv-import'
          || transaction.linkedBillId
        )
      )) {
        setSaveError('Only a host can convert an unlinked outgoing transaction into a household bill.');
        return;
      }
      const newBill: HouseholdBill = {
        ...billData,
        id: `bill-${crypto.randomUUID()}`,
        linkedOutgoingId: outgoingTransactionIds?.[0],
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        bills: [...prev.bills, newBill],
        transactions: outgoingTransactionIds
          ? prev.transactions.map((transaction) => outgoingTransactionIds.includes(transaction.id)
            ? { ...transaction, category: 'Household Bills', linkedBillId: newBill.id }
            : transaction)
          : prev.transactions,
      }));
    }
  };

  const handleDeleteBill = (billId: string) => {
    if (window.confirm('Are you sure you want to delete this household bill?')) {
      commitState((prev) => ({
        ...prev,
        bills: prev.bills.filter((b) => b.id !== billId),
        transactions: prev.transactions.map((transaction) => transaction.linkedBillId === billId
          ? { ...transaction, linkedBillId: undefined, category: 'Other Expense' }
          : transaction),
      }));
    }
  };
  const handleToggleMemberInBill = (billId: string, memberId: string) => {
    commitState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => {
        if (b.id !== billId) return b;
        const exists = b.participatingMemberIds.includes(memberId);
        const updated = exists
          ? b.participatingMemberIds.filter((id) => id !== memberId)
          : [...b.participatingMemberIds, memberId];
        return {
          ...b,
          participatingMemberIds: updated,
        };
      }),
    }));
  };

  const handleToggleBillActive = (billId: string) => {
    commitState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => (b.id === billId ? { ...b, isActive: !b.isActive } : b)),
    }));
  };

  const handleSaveMember = (memberData: Omit<Member, 'id' | 'createdAt'>, memberId?: string) => {
    if (!isAccountHolder) {
      setSaveError('Only an account holder can manage household members.');
      return;
    }
    if (memberId) {
      commitState((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === memberId ? { ...m, ...memberData } : m)),
      }));
    } else {
      const newMember: Member = {
        ...memberData,
        id: `mem-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      };
      commitState((prev) => ({
        ...prev,
        members: [...prev.members, newMember],
      }));
      setSelectedMemberId(newMember.id);
    }
  };

  const handleToggleCoHost = (member: Member) => {
    if (!isAccountHolder) {
      setSaveError('Only an account holder can change co-host access.');
      return;
    }
    if (member.isAccountHolder) {
      const otherAccountHolders = state.members.filter(
        (candidate) => candidate.id !== member.id && candidate.isAccountHolder
      );
      if (otherAccountHolders.length === 0) {
        setSaveError('The household must have at least one account holder. Make another member a co-host first.');
        return;
      }
    }

    handleSaveMember({
      name: member.name,
      email: member.email,
      authUserId: member.authUserId,
      avatarColor: member.avatarColor,
      isAccountHolder: !member.isAccountHolder,
      notes: member.notes,
    }, member.id);
  };

  const handleDeleteMember = (memberId: string) => {
    if (!isAccountHolder) {
      setSaveError('Only an account holder can manage household members.');
      return;
    }
    const memberToDelete = state.members.find((m) => m.id === memberId);
    if (!memberToDelete) return;

    if (window.confirm(`Remove ${memberToDelete.name} from the household? They will be removed from all future bill splits.`)) {
      commitState((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== memberId),
        bills: prev.bills.map((b) => ({
          ...b,
          participatingMemberIds: b.participatingMemberIds.filter((id) => id !== memberId),
        })),
      }));

      if (selectedMemberId === memberId) {
        const remaining = state.members.filter((m) => m.id !== memberId);
        setSelectedMemberId(remaining[0]?.id || null);
      }
    }
  };
  const handleResolveAccessRequest = async (userId: string, approve: boolean) => {
    if (!isAccountHolder) {
      throw new Error('Only an account holder can review access requests.');
    }
    const { listPendingHouseholdAccessRequests, loadHouseholdData, resolveHouseholdAccessRequest } = await import('./utils/database');
    await resolveHouseholdAccessRequest(supabaseClient, userId, approve);
    const [updatedState, requests] = await Promise.all([
      loadHouseholdData(supabaseClient),
      listPendingHouseholdAccessRequests(supabaseClient),
    ]);
    stateRef.current = updatedState;
    setState(updatedState);
    setAccessRequests(requests);
  };

  const handleRefreshAccessRequests = async () => {
    const { listPendingHouseholdAccessRequests } = await import('./utils/database');
    const requests = await listPendingHouseholdAccessRequests(supabaseClient);
    setAccessRequests(requests);
  };

  const handleLinkMemberToLogin = async (memberId: string) => {
    const { linkCurrentUserToHouseholdMember, loadHouseholdData } = await import('./utils/database');
    await linkCurrentUserToHouseholdMember(supabaseClient, memberId);
    const updatedState = await loadHouseholdData(supabaseClient);
    stateRef.current = updatedState;
    setState(updatedState);
  };

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <section className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Couldn’t load household data</h1>
          <p role="alert" className="mt-2 text-sm text-rose-700">{loadError}</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Retry</button>
          <button type="button" onClick={() => { void onSignOut().catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Signout failed')); }} className="ml-3 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans text-neutral-900">
      <div className="flex-1 flex w-full">
        <Sidebar
          activeTab={displayedTab} setActiveTab={setActiveTab}
          selectedMemberId={selectedMemberId} setSelectedMemberId={setSelectedMemberId}
          members={visibleMembers} isAccountHolder={isAccountHolder}
          onOpenAddMember={() => { setMemberToEdit(null); setIsMemberModalOpen(true); }}
          currencySymbol={state.currencySymbol} isOpenMobile={isMobileMenuOpen}
          setIsOpenMobile={setIsMobileMenuOpen} memberBalances={memberBalances}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-neutral-50/70">
          <Header
            activeTab={displayedTab} isAccountHolder={isAccountHolder}
            onOpenImportCsv={() => setIsCsvModalOpen(true)}
            onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }}
            onOpenAddTransaction={(prefill) => { setTxPrefill(prefill || null); setIsTxModalOpen(true); }}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)} themeMode={themeMode}
            onChangeTheme={onChangeTheme} userEmail={userEmail} onSignOut={onSignOut}
          />

          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            {saveError && (
              <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Changes were not saved to the shared database: {saveError}
              </div>
            )}
            {displayedTab === 'dashboard' && (
              <PersonalDashboard
                members={visibleMembers} bills={state.bills} transactions={state.transactions}
                signedInUserId={signedInUserId} userEmail={userEmail} currencySymbol={state.currencySymbol}
                onNavigate={handleNavigate} onOpenImportCsv={() => setIsCsvModalOpen(true)}
                onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }}
                onOpenAddTransaction={(prefill) => { setTxPrefill(prefill || null); setIsTxModalOpen(true); }}
              />
            )}

            {displayedTab === 'incoming' && (
              <IncomingView
                transactions={state.transactions} members={visibleMembers} currencySymbol={state.currencySymbol}
                onOpenImportCsv={() => setIsCsvModalOpen(true)} onDeleteTransaction={handleDeleteTransaction}
                onOpenAddTransaction={(prefill) => { setTxPrefill(prefill || null); setIsTxModalOpen(true); }}
              />
            )}

            {displayedTab === 'outgoing' && (
              <OutgoingView
                transactions={state.transactions} bills={state.bills} members={visibleMembers}
                currencySymbol={state.currencySymbol} onOpenImportCsv={() => setIsCsvModalOpen(true)}
                onDeleteTransaction={handleDeleteTransaction}
                onOpenAddTransaction={(prefill) => { setTxPrefill(prefill || null); setIsTxModalOpen(true); }}
              />
            )}

            {displayedTab === 'household-bills' && (
              <HouseholdBillsView
                bills={state.bills} members={visibleMembers} canManageBills={isAccountHolder}
                currencySymbol={state.currencySymbol} onDeleteBill={handleDeleteBill}
                onToggleMemberInBill={handleToggleMemberInBill} onToggleBillActive={handleToggleBillActive}
                onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }}
                onEditBill={(bill) => { setBillToEdit(bill); setIsBillModalOpen(true); }}
              />
            )}

            {displayedTab === 'members' && (
              <>
                {isAccountHolder && (
                  <AccessRequestsPanel requests={accessRequests} onResolveRequest={handleResolveAccessRequest} onRefresh={handleRefreshAccessRequests} />
                )}
                <MemberProfilesView
                  members={visibleMembers} bills={state.bills} transactions={state.transactions}
                  canManageMembers={isAccountHolder} selectedMemberId={selectedMemberId} setSelectedMemberId={setSelectedMemberId}
                  currencySymbol={state.currencySymbol} onDeleteMember={handleDeleteMember} onToggleCoHost={handleToggleCoHost}
                  onOpenAddMember={() => { setMemberToEdit(null); setIsMemberModalOpen(true); }}
                  onEditMember={(m) => { setMemberToEdit(m); setIsMemberModalOpen(true); }}
                  onOpenAddTransaction={(prefill) => {
                    if (prefill) { setTxPrefill(prefill); setIsTxModalOpen(true); }
                    else if (selectedMemberId) { handleRecordCashOverride(selectedMemberId); }
                  }}
                  signedInUserEmail={userEmail} onLinkMemberToLogin={handleLinkMemberToLogin}
                  {...({ currentMonthKey, setSelectedMonthDate: setActiveLedgerDate } as any)}
                />
              </>
            )}

            {displayedTab === 'settlement' && (
              <SettlementMatrixView
                members={visibleMembers} bills={state.bills} transactions={state.transactions}
                primaryUserId={state.primaryUserId} currencySymbol={state.currencySymbol}
              />
            )}
          </main>
          <footer className="px-6 py-3 border-t border-neutral-200 bg-white text-xs text-neutral-500">HearthLedger · Shared household database</footer>
        </div>
      </div>

      <CsvImportModal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} members={visibleMembers} currencySymbol={state.currencySymbol} onImportTransactions={handleImportCsvTransactions} />
      <BillModal
        isOpen={isBillModalOpen} onClose={() => { setIsBillModalOpen(false); setBillToEdit(null); }}
        onSaveBill={handleSaveBill} members={visibleMembers} billToEdit={billToEdit} currencySymbol={state.currencySymbol}
        importedTransactions={isAccountHolder ? state.transactions.filter(t => t.type === 'outgoing' && t.source === 'csv-import' && !t.linkedBillId) : []}
      />
      <TransactionModal isOpen={isTxModalOpen} onClose={() => { setIsTxModalOpen(false); setTxPrefill(null); }} onSaveTransaction={handleSaveTransaction} members={visibleMembers} bills={state.bills} currencySymbol={state.currencySymbol} prefill={txPrefill} />
      <MemberModal isOpen={isMemberModalOpen} onClose={() => { setIsMemberModalOpen(false); setMemberToEdit(null); }} onSaveMember={handleSaveMember} memberToEdit={memberToEdit} />
    </div>
  );
}
