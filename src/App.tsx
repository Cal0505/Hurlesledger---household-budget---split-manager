import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActiveTab, AppState, HouseholdBill, Member, Transaction } from './types/budget';
import { AuthScreen } from './components/AuthScreen';
import { AccessRequestsPanel } from './components/AccessRequestsPanel';
import { HouseholdAccessScreen } from './components/HouseholdAccessScreen';
import { PasswordRecoveryScreen } from './components/PasswordRecoveryScreen';
import { ThemeMode, AccentColor, THEME_STORAGE_KEY, ACCENT_STORAGE_KEY } from './constants/theme';
import { supabaseClient, supabaseConfigurationError } from './utils/supabase';
import { getEmptyState } from './utils/storage';
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

  // ===== THEME MODE =====
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
      return 'system';
    } catch { return 'system'; }
  });

  // ===== ACCENT COLOR =====
  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    try {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (!stored) return null;
      const valid: AccentColor[] = ['ocean','forest','lavender','sunset','crimson','glacier','midnight','tidepool'];
      return valid.includes(stored as any) ? (stored as AccentColor) : null;
    } catch { return null; }
  });

  // ===== SAVE PREFERENCES =====
  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, themeMode); }
    catch (e) { console.warn('Could not save theme mode', e); }
  }, [themeMode]);
  useEffect(() => {
    try {
      if (accentColor) localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
      else localStorage.removeItem(ACCENT_STORAGE_KEY);
    } catch (e) { console.warn('Could not save accent color', e); }
  }, [accentColor]);

  // ===== RESOLVE EFFECTIVE BASE THEME =====
  const effectiveBase = useMemo(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [themeMode]);

  // ===== APPLY FULL THEME =====
  useEffect(() => {
    const root = document.documentElement;
    const systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const base = themeMode === 'light' ? 'light'
        : themeMode === 'dark' ? 'dark'
        : systemMedia.matches ? 'dark' : 'light';
      root.dataset.theme = accentColor ? `${accentColor}-${base}` : base;
    };
    apply();
    if (themeMode === 'system') {
      systemMedia.addEventListener('change', apply);
      return () => systemMedia.removeEventListener('change', apply);
    }
  }, [accentColor, themeMode]);

  // ===== AUTH & SESSION =====
  useEffect(() => {
    if (!supabaseClient) {
      setIsAuthLoading(false);
      return;
    }
    let isMounted = true;
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
        else if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
        setAuthError('');
        setIsAuthLoading(false);
      }
    });
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) setAuthError(error.message);
      else setSession(data.session);
      setIsAuthLoading(false);
    }).catch((e: unknown) => {
      if (!isMounted) return;
      setAuthError(e instanceof Error ? e.message : 'Unable to check your sign-in session.');
      setIsAuthLoading(false);
    });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  // ===== ACCESS CHECK =====
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
    }).catch((e: unknown) => {
      if (!isMounted) return;
      setAccessError(e instanceof Error ? e.message : 'Unable to check household access.');
      setAccessStatus('error');
    });
    return () => { isMounted = false; };
  }, [session, accessRetry]);

  const handleSignOut = async () => {
    if (!supabaseClient) throw new Error('Supabase is not configured.');
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  };

  // ===== LOADING SCREENS =====
  if (isAuthLoading) {
    return <main className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-700"><p className="text-sm">Checking your sign-in…</p></main>;
  }
  if (!session) {
    return <AuthScreen client={supabaseClient} initialError={authError || supabaseConfigurationError} />;
  }
  if (isPasswordRecovery && supabaseClient) {
    return <PasswordRecoveryScreen client={supabaseClient} onComplete={() => setIsPasswordRecovery(false)} />;
  }
  if (accessStatus === 'checking') {
    return <main className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-700"><p className="text-sm">Checking household access…</p></main>;
  }
  if (accessStatus === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f4f6f1] p-4">
        <section className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Couldn't check household access</h1>
          <p role="alert" className="mt-2 text-sm text-rose-700">{accessError}</p>
          <button onClick={() => setAccessRetry(a => a + 1)} className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Retry</button>
          <button onClick={() => void handleSignOut()} className="ml-3 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Sign out</button>
        </section>
      </main>
    );
  }
  if (['profile','pending','denied','none'].includes(accessStatus)) {
    if (!supabaseClient) return <AuthScreen client={null} initialError={supabaseConfigurationError} />;
    return (
      <HouseholdAccessScreen
        client={supabaseClient}
        email={session.user.email || ''}
        status={accessStatus as any}
        onRefresh={() => setAccessRetry(a => a + 1)}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <HouseholdApp
      themeMode={themeMode}
      onChangeTheme={setThemeMode}
      accentColor={accentColor}
      onChangeAccent={setAccentColor}
      signedInUserId={session.user.id}
      userEmail={session.user.email || 'Signed-in user'}
      onSignOut={handleSignOut}
      supabaseClient={supabaseClient!}
    />
  );
}

// ===== HOUSEHOLD APP =====
interface HouseholdAppProps {
  themeMode: ThemeMode;
  onChangeTheme: (t: ThemeMode) => void;
  accentColor: AccentColor;
  onChangeAccent: (a: AccentColor) => void;
  signedInUserId: string;
  userEmail: string;
  onSignOut: () => Promise<void>;
  supabaseClient: NonNullable<typeof supabaseClient>;
}

function HouseholdApp({
  themeMode, onChangeTheme, accentColor, onChangeAccent,
  signedInUserId, userEmail, onSignOut, supabaseClient
}: HouseholdAppProps) {
  const [state, setState] = useState<AppState>(getEmptyState());
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [accessRequests, setAccessRequests] = useState<HouseholdAccessRequest[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const stateRef = useRef(state);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isAccountHolder = state.members.some(m => m.authUserId === signedInUserId && m.isAccountHolder);
  const visibleMembers = isAccountHolder ? state.members : state.members.filter(m => m.authUserId === signedInUserId);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const displayedTab = isAccountHolder ? activeTab : 'members';
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ===== MODALS — FIXED: editId tracking =====
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<HouseholdBill | null>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txPrefill, setTxPrefill] = useState<Partial<Transaction> | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);

  // Date
  const [activeLedgerDate, setActiveLedgerDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const currentMonthKey = `${activeLedgerDate.getFullYear()}-${String(activeLedgerDate.getMonth() + 1).padStart(2, '0')}`;

  // Clear legacy state
  useEffect(() => {
    try { localStorage.removeItem('hearthledger_household_state_v1'); }
    catch (e) { console.warn('Unable to remove old data', e); }
  }, []);

  // Load data
  useEffect(() => {
    let isMounted = true;
    setIsDataLoading(true);
    setLoadError('');
    if (!supabaseClient) {
      setLoadError('Supabase is not configured. Check the app environment and restart.');
      setIsDataLoading(false);
      return;
    }
    import('./utils/database').then(async ({ loadHouseholdData, listPendingHouseholdAccessRequests }) => {
      const loadedState = await loadHouseholdData(supabaseClient);
      const requests = await listPendingHouseholdAccessRequests(supabaseClient);
      return { loadedState, requests };
    }).then(({ loadedState, requests }) => {
      if (!isMounted) return;
      stateRef.current = loadedState;
      setState(loadedState);
      setAccessRequests(requests);
      setSelectedMemberId(loadedState.members?.length > 0 ? loadedState.members[0].id : null);
      setIsDataLoading(false);
    }).catch((e: unknown) => {
      if (!isMounted) return;
      setLoadError(e instanceof Error ? e.message : 'Unable to load household data.');
      setIsDataLoading(false);
    });
    return () => { isMounted = false; };
  }, [loadAttempt]);

  const commitState = (update: (curr: AppState) => AppState) => {
    mutationQueueRef.current = mutationQueueRef.current.then(async () => {
      if (!supabaseClient) throw new Error('Supabase is not configured.');
      const prev = stateRef.current;
      const next = update(prev);
      const { saveHouseholdChanges } = await import('./utils/database');
      await saveHouseholdChanges(supabaseClient, prev, next);
      stateRef.current = next;
      setState(next);
      setSaveError('');
    }).catch((e: unknown) => {
      setSaveError(e instanceof Error ? e.message : 'Unable to save changes to Supabase.');
    });
  };

  useEffect(() => {
    if (!selectedMemberId && state.members?.length > 0) {
      setSelectedMemberId(state.members[0].id);
    }
  }, [state.members, selectedMemberId]);

  // Balances
  const memberBalances = useMemo(() => {
    const map: Record<string, { totalMonthlyShare: number; totalPaid: number; remainingDue: number }> = {};
    state.members.forEach(m => {
      if (m.isAccountHolder) {
        map[m.id] = { totalMonthlyShare: 0, totalPaid: 0, remainingDue: 0 };
        return;
      }
      const months = new Set<string>();
      state.bills.forEach(b => b.incurredDate && months.add(b.incurredDate.slice(0, 7)));
      months.add(currentMonthKey);
      let billsTotal = 0, paymentsTotal = 0;
      months.forEach(mKey => {
        state.bills.filter(b => b.isActive && b.incurredDate?.startsWith(mKey)).forEach(bill => {
          if (!bill.participatingMemberIds.includes(m.id)) return;
          const parts = bill.participatingMemberIds.length;
          if (parts === 0) return;
          const share = Math.floor((bill.amount / parts) * 100) / 100;
          billsTotal += share;
        });
      });
      state.transactions.filter(tx => tx.type === 'incoming' && (tx.fromMemberId === m.id || (tx as any).memberId === m.id))
        .forEach(tx => { paymentsTotal += tx.amount; });
      map[m.id] = {
        totalMonthlyShare: billsTotal,
        totalPaid: paymentsTotal,
        remainingDue: Math.max(0, Math.round((billsTotal - paymentsTotal) * 100) / 100),
      };
    });
    return map;
  }, [state.members, state.bills, state.transactions, currentMonthKey]);

  const handleNavigate = (tab: ActiveTab, memberId?: string) => {
    setActiveTab(tab);
    if (memberId) setSelectedMemberId(memberId);
  };

  const handleImportCsvTransactions = (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    commitState(p => ({
      ...p,
      transactions: txs.map(t => ({ ...t, id: `tx-csv-${crypto.randomUUID()}`, createdAt: new Date().toISOString() })).concat(p.transactions)
    }));
  };

  // ===== SAVE TRANSACTION — UPDATE or CREATE =====
  const handleSaveTransaction = (
    data: Omit<Transaction, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      // Update existing — NO duplicate
      commitState(p => ({
        ...p,
        transactions: p.transactions.map(tx =>
          tx.id === existingId ? { ...tx, ...data } : tx
        )
      }));
    } else {
      // Create new
      commitState(p => ({
        ...p,
        transactions: [{ ...data, id: `tx-${crypto.randomUUID()}`, createdAt: new Date().toISOString() }, ...p.transactions]
      }));
    }
    // Reset modal
    setIsTxModalOpen(false);
    setTxPrefill(null);
    setEditingTxId(null);
  };

  const handleDeleteTransaction = (id: string) => {
    commitState(p => ({ ...p, transactions: p.transactions.filter(t => t.id !== id) }));
  };

  // ===== OPEN TRANSACTION MODAL — pass editId =====
  const openTransactionModal = (
    prefillData?: Partial<Transaction> | null,
    editId?: string
  ) => {
    setTxPrefill(prefillData || null);
    setEditingTxId(editId ?? null);
    setIsTxModalOpen(true);
  };

  const handleRecordCashOverride = (memberId: string) => {
    const member = state.members.find(m => m.id === memberId);
    const info = memberBalances[memberId];
    if (!member || !info) return;
    setTxPrefill({
      type: 'incoming', source: 'manual', category: 'Other',
      amount: info.remainingDue > 0 ? info.remainingDue : undefined,
      description: `Cash settlement from ${member.name}`,
      date: new Date().toISOString().split('T')[0],
      fromMemberId: memberId, ...({ memberId } as any)
    });
    setEditingTxId(null);
    setIsTxModalOpen(true);
  };

  const handleSaveBill = (data: Omit<HouseholdBill, 'id' | 'createdAt'>, billId?: string, txIds?: string[]) => {
    if (billId) {
      commitState(p => ({ ...p, bills: p.bills.map(b => b.id === billId ? { ...b, ...data } : b) }));
    } else {
      if (txIds && (!isAccountHolder)) {
        setSaveError('Only a host can convert an unlinked outgoing transaction into a household bill.');
        return;
      }
      const newBill: HouseholdBill = {
        ...data, id: `bill-${crypto.randomUUID()}`, linkedOutgoingId: txIds?.[0],
        createdAt: new Date().toISOString()
      };
      commitState(p => ({
        ...p,
        bills: [...p.bills, newBill],
        transactions: txIds ? p.transactions.map(t => txIds.includes(t.id) ? { ...t, category: 'Household Bills', linkedBillId: newBill.id } : t) : p.transactions
      }));
    }
  };

  const handleDeleteBill = (id: string) => {
    if (window.confirm('Are you sure you want to delete this household bill?')) {
      commitState(p => ({
        ...p,
        bills: p.bills.filter(b => b.id !== id),
        transactions: p.transactions.map(t => t.linkedBillId === id ? { ...t, linkedBillId: undefined, category: 'Other Expense' } : t)
      }));
    }
  };

  const handleToggleMemberInBill = (billId: string, memberId: string) => {
    commitState(p => ({
      ...p,
      bills: p.bills.map(b => b.id !== billId ? b : {
        ...b,
        participatingMemberIds: b.participatingMemberIds.includes(memberId)
          ? b.participatingMemberIds.filter(id => id !== memberId)
          : [...b.participatingMemberIds, memberId]
      })
    }));
  };

  const handleToggleBillActive = (id: string) => {
    commitState(p => ({ ...p, bills: p.bills.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b) }));
  };

  const handleSaveMember = (data: Omit<Member, 'id' | 'createdAt'>, id?: string) => {
    if (!isAccountHolder) { setSaveError('Only an account holder can manage household members.'); return; }
    if (id) {
      commitState(p => ({ ...p, members: p.members.map(m => m.id === id ? { ...m, ...data } : m) }));
    } else {
      const newMember: Member = { ...data, id: `mem-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
      commitState(p => ({ ...p, members: [...p.members, newMember] }));
      setSelectedMemberId(newMember.id);
    }
  };

  const handleToggleCoHost = (member: Member) => {
    if (!isAccountHolder) { setSaveError('Only an account holder can change co-host access.'); return; }
    if (member.isAccountHolder) {
      const others = state.members.filter(m => m.id !== member.id && m.isAccountHolder);
      if (others.length === 0) { setSaveError('The household must have at least one account holder. Make another member a co-host first.'); return; }
    }
    handleSaveMember({
      name: member.name, email: member.email, authUserId: member.authUserId,
      avatarColor: member.avatarColor, isAccountHolder: !member.isAccountHolder, notes: member.notes
    }, member.id);
  };

  const handleDeleteMember = (id: string) => {
    if (!isAccountHolder) { setSaveError('Only an account holder can manage household members.'); return; }
    const member = state.members.find(m => m.id === id);
    if (!member) return;
    if (window.confirm(`Remove ${member.name} from the household? They will be removed from all future bill splits.`)) {
      commitState(p => ({
        ...p,
        members: p.members.filter(m => m.id !== id),
        bills: p.bills.map(b => ({ ...b, participatingMemberIds: b.participatingMemberIds.filter(mid => mid !== id) }))
      }));
      if (selectedMemberId === id) setSelectedMemberId(state.members.filter(m => m.id !== id)[0]?.id || null);
    }
  };

  const handleResolveAccessRequest = async (userId: string, approve: boolean) => {
    if (!isAccountHolder) throw new Error('Only an account holder can review access requests.');
    const { resolveHouseholdAccessRequest, loadHouseholdData, listPendingHouseholdAccessRequests } = await import('./utils/database');
    await resolveHouseholdAccessRequest(supabaseClient, userId, approve);
    const [updatedState, requests] = await Promise.all([
      loadHouseholdData(supabaseClient),
      listPendingHouseholdAccessRequests(supabaseClient)
    ]);
    stateRef.current = updatedState;
    setState(updatedState);
    setAccessRequests(requests);
  };

  const handleRefreshAccessRequests = async () => {
    const { listPendingHouseholdAccessRequests } = await import('./utils/database');
    setAccessRequests(await listPendingHouseholdAccessRequests(supabaseClient));
  };

  const handleLinkMemberToLogin = async (id: string) => {
    const { linkCurrentUserToHouseholdMember, loadHouseholdData } = await import('./utils/database');
    await linkCurrentUserToHouseholdMember(supabaseClient, id);
    const updated = await loadHouseholdData(supabaseClient);
    stateRef.current = updated;
    setState(updated);
  };

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <section className="w-full max-w-lg rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Couldn't load household data</h1>
          <p role="alert" className="mt-2 text-sm text-rose-700">{loadError}</p>
          <button onClick={() => setLoadAttempt(a => a + 1)} className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Retry</button>
          <button onClick={() => { onSignOut().catch(e => setLoadError(e instanceof Error ? e.message : 'Signout failed')); }} className="ml-3 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Sign out</button>
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
            activeTab={displayedTab}
            isAccountHolder={isAccountHolder}
            onOpenImportCsv={() => setIsCsvModalOpen(true)}
            onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }}
            onOpenAddTransaction={(p) => openTransactionModal(p)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            themeMode={themeMode}
            onChangeTheme={onChangeTheme}
            accentColor={accentColor}
            onChangeAccent={onChangeAccent}
            userEmail={userEmail}
            onSignOut={onSignOut}
          />
          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            {saveError && <div role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Changes were not saved: {saveError}</div>}
            
            {displayedTab === 'dashboard' && <PersonalDashboard 
              members={visibleMembers} bills={state.bills} transactions={state.transactions} 
              signedInUserId={signedInUserId} userEmail={userEmail} currencySymbol={state.currencySymbol} 
              onNavigate={handleNavigate} onOpenImportCsv={() => setIsCsvModalOpen(true)} 
              onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }} 
              onOpenAddTransaction={(p) => openTransactionModal(p)} 
            />}
            
            {displayedTab === 'incoming' && <IncomingView
              transactions={state.transactions}
              members={visibleMembers}
              bills={state.bills}
              currencySymbol={state.currencySymbol}
              onOpenImportCsv={() => setIsCsvModalOpen(true)}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddTransaction={(p, editId?: string) => openTransactionModal(p, editId)}
            />}
            
            {displayedTab === 'outgoing' && <OutgoingView
              transactions={state.transactions}
              bills={state.bills}
              members={visibleMembers}
              currencySymbol={state.currencySymbol}
              onOpenImportCsv={() => setIsCsvModalOpen(true)}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddTransaction={(p, editId?: string) => openTransactionModal(p, editId)}
            />}
            
            {displayedTab === 'household-bills' && <HouseholdBillsView
              bills={state.bills} members={visibleMembers} canManageBills={isAccountHolder}
              currencySymbol={state.currencySymbol} onDeleteBill={handleDeleteBill}
              onToggleMemberInBill={handleToggleMemberInBill} onToggleBillActive={handleToggleBillActive}
              onOpenAddBill={() => { setBillToEdit(null); setIsBillModalOpen(true); }}
              onEditBill={(b) => { setBillToEdit(b); setIsBillModalOpen(true); }}
            />}
            
            {displayedTab === 'members' && <>
              {isAccountHolder && <AccessRequestsPanel 
                requests={accessRequests} onResolveRequest={handleResolveAccessRequest} 
                onRefresh={handleRefreshAccessRequests} 
              />}
              <MemberProfilesView
                members={visibleMembers} bills={state.bills} transactions={state.transactions}
                canManageMembers={isAccountHolder} selectedMemberId={selectedMemberId} setSelectedMemberId={setSelectedMemberId}
                currencySymbol={state.currencySymbol} onDeleteMember={handleDeleteMember} onToggleCoHost={handleToggleCoHost}
                onOpenAddMember={() => { setMemberToEdit(null); setIsMemberModalOpen(true); }}
                onEditMember={(m) => { setMemberToEdit(m); setIsMemberModalOpen(true); }}
                onOpenAddTransaction={(p, editId?: string) => { 
                  if (p) openTransactionModal(p, editId); 
                  else if (selectedMemberId) handleRecordCashOverride(selectedMemberId); 
                }}
                signedInUserEmail={userEmail} onLinkMemberToLogin={handleLinkMemberToLogin}
                {...({ currentMonthKey, setSelectedMonthDate: setActiveLedgerDate } as any)}
              />
            </>}
            
            {displayedTab === 'settlement' && <SettlementMatrixView
              members={visibleMembers} bills={state.bills} transactions={state.transactions}
              primaryUserId={state.primaryUserId} currencySymbol={state.currencySymbol}
            />}
          </main>
          <footer className="px-6 py-3 border-t border-neutral-200 bg-white text-xs text-neutral-500">
            HearthLedger · Shared household database
          </footer>
        </div>
      </div>
      
      <CsvImportModal 
        isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} 
        members={visibleMembers} currencySymbol={state.currencySymbol} 
        onImportTransactions={handleImportCsvTransactions} 
      />
      <BillModal 
        isOpen={isBillModalOpen} onClose={() => { setIsBillModalOpen(false); setBillToEdit(null); }} 
        onSaveBill={handleSaveBill} members={visibleMembers} billToEdit={billToEdit} 
        currencySymbol={state.currencySymbol} 
        importedTransactions={isAccountHolder ? state.transactions.filter(t => t.type === 'outgoing' && t.source === 'csv-import' && !t.linkedBillId) : []} 
      />
      
      {/* ✅ editId passed to modal — duplicates fixed */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setTxPrefill(null);
          setEditingTxId(null);
        }}
        onSaveTransaction={handleSaveTransaction}
        members={visibleMembers}
        bills={state.bills}
        currencySymbol={state.currencySymbol}
        prefill={txPrefill}
        editId={editingTxId || undefined}
      />
      
      <MemberModal 
        isOpen={isMemberModalOpen} onClose={() => { setIsMemberModalOpen(false); setMemberToEdit(null); }} 
        onSaveMember={handleSaveMember} memberToEdit={memberToEdit} 
      />
    </div>
  );
}