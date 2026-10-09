import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  ReceiptText, 
  CheckCircle2, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  Ban,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getMemberShareForBill, getPrimaryAccountLabel } from '../utils/storage';

const STEP_DEG = 28;
const Z_DEPTH = 135;

interface HostMemberViewProps {
  activeMember: Member;
  members: Member[];
  bills: HouseholdBill[];
  transactions: Transaction[];
  canManageMembers: boolean;
  currencySymbol: string;
  currentMonthKey: string;
  currentMonthName: string;
  onOpenAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onToggleCoHost: (member: Member) => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
  onLinkMemberToLogin: (memberId: string) => Promise<void>;
  setSelectedMemberId: (id: string) => void;
  setSelectedMonthDate: React.Dispatch<React.SetStateAction<Date>>;
}

export const HostMemberView: React.FC<HostMemberViewProps> = ({
  activeMember,
  members,
  bills,
  transactions,
  canManageMembers,
  currencySymbol,
  currentMonthKey,
  currentMonthName,
  onOpenAddMember,
  onEditMember,
  onDeleteMember,
  onToggleCoHost,
  onOpenAddTransaction,
  onLinkMemberToLogin,
  setSelectedMemberId,
  setSelectedMonthDate,
}) => {
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isLinkingLogin, setIsLinkingLogin] = useState(false);
  const [loginLinkMessage, setLoginLinkMessage] = useState('');
  const isMoving = useRef(false);

  // ─── Timeline options — NEWEST FIRST ───
  const filterOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      options.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        monthFull: d.toLocaleDateString('en-GB', { month: 'long' }),
        yearFull: d.getFullYear(),
        label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        dateObj: d
      });
    }
    return options;
  }, []);

  const activeIndex = useMemo(() =>
    filterOptions.findIndex(opt => opt.key === currentMonthKey),
    [filterOptions, currentMonthKey]
  );

  // ─── Timeline metrics per month ───
  const timelineDataMap = useMemo(() => {
    const dataMap: Record<string, { billed: number; paid: number; arrears: number }> = {};
    filterOptions.forEach(opt => {
      let billed = 0, paid = 0;
      bills.filter(b => b.isActive).forEach(bill => {
        billed += getMemberShareForBill(activeMember.id, bill, opt.key);
      });
      transactions
        .filter(tx => tx.type === 'incoming' &&
            (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) &&
            tx.date.slice(0, 7) === opt.key)
        .forEach(tx => { paid += tx.amount; });
      dataMap[opt.key] = {
        billed,
        paid,
        arrears: Math.max(0, Math.round((billed - paid) * 100) / 100)
      };
    });
    return dataMap;
  }, [filterOptions, bills, transactions, activeMember.id]);

  // ─── Navigation ───
  const goToIndex = (newIdx: number) => {
    if (isMoving.current) return;
    if (newIdx < 0 || newIdx >= filterOptions.length) return;
    isMoving.current = true;
    setSelectedMonthDate(filterOptions[newIdx].dateObj);
    setTimeout(() => { isMoving.current = false; }, 150);
  };

  const handleStepTimeline = (dir: 'up' | 'down') => {
    goToIndex(dir === 'up' ? activeIndex - 1 : activeIndex + 1);
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMoving.current) return;
    if (Math.abs(e.deltaY) < 15) return;
    goToIndex(e.deltaY < 0 ? activeIndex - 1 : activeIndex + 1);
  };

  // ─── Existing calculations ───
  const hostTimelineOverview = (() => {
    if (activeMember.isAccountHolder) {
      return { accumulatedDebtPriorToCurrent: 0, grandTotalOutstanding: 0 };
    }
    let totalBillsAllTime = 0;
    let totalPaymentsAllTime = 0;
    filterOptions.forEach(opt => {
      bills
        .filter(b => b.isActive && b.incurredDate && b.incurredDate.startsWith(opt.key))
        .forEach(bill => {
          totalBillsAllTime += getMemberShareForBill(activeMember.id, bill, opt.key);
        });
    });
    transactions
      .filter(tx => tx.type === 'incoming' && (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id))
      .forEach(tx => {
        totalPaymentsAllTime += tx.amount;
      });
    const grandTotalOutstanding = Math.max(0, Math.round((totalBillsAllTime - totalPaymentsAllTime) * 100) / 100);
    let currentPeriodBills = 0;
    bills
      .filter(b => b.isActive && b.incurredDate && b.incurredDate.startsWith(currentMonthKey))
      .forEach(bill => {
        currentPeriodBills += getMemberShareForBill(activeMember.id, bill, currentMonthKey);
      });
    let currentPeriodPaid = 0;
    transactions
      .filter(tx => tx.type === 'incoming' && 
          (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) && 
          tx.date.slice(0, 7) === currentMonthKey)
      .forEach(tx => {
        currentPeriodPaid += tx.amount;
      });
    const currentPeriodRemaining = Math.max(0, Math.round((currentPeriodBills - currentPeriodPaid) * 100) / 100);
    const accumulatedDebtPriorToCurrent = Math.max(0, Math.round((grandTotalOutstanding - currentPeriodRemaining) * 100) / 100);
    return { accumulatedDebtPriorToCurrent, grandTotalOutstanding };
  })();

  const participatingBills = bills.filter(
    (b) => b.isActive
      && b.participatingMemberIds.includes(activeMember.id)
      && (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  );

  const excludedBills = bills.filter(
    (b) => b.isActive
      && !b.participatingMemberIds.includes(activeMember.id)
      && (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  );

  const balance = (() => {
    let totalMonthlyShare = 0;
    participatingBills.forEach(b => {
      totalMonthlyShare += getMemberShareForBill(activeMember.id, b, currentMonthKey);
    });
    let totalPaid = 0;
    transactions
      .filter(tx => tx.type === 'incoming' && 
          (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) && 
          tx.date.slice(0, 7) === currentMonthKey)
      .forEach(tx => {
        totalPaid += tx.amount;
      });
    return {
      totalMonthlyShare,
      totalPaid,
      remainingDue: Math.max(0, Math.round((totalMonthlyShare - totalPaid) * 100) / 100)
    };
  })();

  const memberTransactions = transactions
    .filter((t) => t.type === 'incoming' && t.fromMemberId === activeMember.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const generateShareText = () => {
    let lines = [`*${currentMonthName} Household Split Breakdown for ${activeMember.name}*`];
    lines.push('');
    lines.push('Bills included:');
    participatingBills.forEach((b) => {
      const share = getMemberShareForBill(activeMember.id, b, currentMonthKey);
      lines.push(`• ${b.name}: ${formatCurrency(share, currencySymbol)}`);
    });
    lines.push('');
    lines.push(`*Total Monthly Share: ${formatCurrency(balance.totalMonthlyShare, currencySymbol)}*`);
    lines.push(`Paid to date: ${formatCurrency(balance.totalPaid, currencySymbol)}`);
    lines.push(`*Remaining Due: ${formatCurrency(balance.remainingDue, currencySymbol)}*`);
    lines.push('');
    lines.push(`Please transfer to ${getPrimaryAccountLabel(members)}. Thanks!`);
    return lines.join('\n');
  };

  const handleCopyShareText = () => {
    navigator.clipboard.writeText(generateShareText());
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // ─── RENDER ───
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">Individual Member Profiles</h2>
          <p className="text-sm text-neutral-600 mt-0.5">Manage household member profiles, allocations, and balances.</p>
        </div>
        {canManageMembers && (
          <button
            onClick={onOpenAddMember}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {members.map((m) => {
          const isSelected = m.id === activeMember.id;
          const memberAllTimeOutstanding = (() => {
            if (m.isAccountHolder) return 0;
            let totalBillsAllTime = 0;
            let totalPaymentsAllTime = 0;
            filterOptions.forEach(opt => {
              bills.filter(b => b.isActive).forEach(bill => {
                totalBillsAllTime += getMemberShareForBill(m.id, bill, opt.key);
              });
            });
            transactions
              .filter(tx => tx.type === 'incoming' && (tx.fromMemberId === m.id || (tx as any).memberId === m.id))
              .forEach(tx => { totalPaymentsAllTime += tx.amount; });
            return Math.max(0, Math.round((totalBillsAllTime - totalPaymentsAllTime) * 100) / 100);
          })();
          const isTrulySettledAllTime = m.isAccountHolder || memberAllTimeOutstanding === 0;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMemberId(m.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs transition-all whitespace-nowrap ${
                isSelected
                  ? 'border-neutral-900 bg-neutral-900 text-white font-semibold'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <div className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: m.avatarColor }}>
                {m.name.charAt(0)}
              </div>
              <span>{m.name}</span>
              {isTrulySettledAllTime ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span className="font-mono font-bold">{formatCurrency(memberAllTimeOutstanding, currencySymbol)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full text-white text-xl font-bold flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: activeMember.avatarColor }}>
              {activeMember.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-neutral-900 tracking-tight">{activeMember.name}</h3>
                {activeMember.isAccountHolder && <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Co-Host</span>}
              </div>
              {canManageMembers && (
                <button
                  type="button"
                  onClick={() => onToggleCoHost(activeMember)}
                  className={`mt-2 inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeMember.isAccountHolder ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  {activeMember.isAccountHolder ? 'Remove Co-Host' : 'Make Co-Host'}
                </button>
              )}
              <p className="text-xs text-neutral-600 mt-1">{activeMember.notes || 'Household Flatmate'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyShareText} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors">
              {copiedNotification ? (
                <div className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700">Copied!</span></div>
              ) : (
                <div className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /><span>Share Breakdown</span></div>
              )}
            </button>
            {canManageMembers && <button onClick={() => onEditMember(activeMember)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"><Edit3 className="w-3.5 h-3.5" /><span>Edit Profile</span></button>}
            {canManageMembers && members.length > 1 && <button onClick={() => onDeleteMember(activeMember.id)} className="p-1.5 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* ─── TUMBLER + METRICS ROW ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tumbler */}
          <div className="border border-neutral-200 rounded-2xl p-4 flex flex-col items-center justify-between h-[320px] bg-white shadow-sm">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => handleStepTimeline('up')}
              className="p-2 rounded-lg bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-neutral-600 transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            <div
              onWheel={handleWheelScroll}
              className="flex-1 w-full relative my-2 overflow-hidden cursor-ns-resize"
              style={{ perspective: '1200px' }}
            >
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-14 bg-emerald-500/10 border-2 border-emerald-500 rounded-xl z-10 pointer-events-none" />
              <div
                className="relative transition-transform duration-500 ease-out"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: `rotateX(${activeIndex * STEP_DEG}deg)`,
                  height: '100%'
                }}
              >
                {filterOptions.map((opt, idx) => {
                  const isSelected = idx === activeIndex;
                  const metrics = timelineDataMap[opt.key] || { billed: 0, paid: 0, arrears: 0 };
                  const dist = Math.abs(idx - activeIndex);
                  return (
                    <div
                      key={opt.key}
                      onClick={() => goToIndex(idx)}
                      className={`absolute w-full max-w-[240px] mx-auto left-0 right-0 h-12 rounded-xl flex items-center justify-between px-4 border transition-all duration-300 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-md z-10'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-700 font-semibold'
                      }`}
                      style={{
                        top: '50%',
                        marginTop: '-24px',
                        transform: `rotateX(${idx * -STEP_DEG}deg) translateZ(${Z_DEPTH}px)`,
                        opacity: dist === 0 ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.3 : 0,
                        transformOrigin: 'center center',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <span className="text-xs">{opt.monthFull} {opt.yearFull}</span>
                      <span className={`text-xs font-mono ${isSelected ? 'text-white' : metrics.arrears > 0 ? 'text-rose-600' : 'text-neutral-400'}`}>
                        {metrics.arrears > 0 ? formatCurrency(metrics.arrears, currencySymbol) : '£0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={activeIndex === filterOptions.length - 1}
              onClick={() => handleStepTimeline('down')}
              className="p-2 rounded-lg bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 text-neutral-600 transition-all disabled:opacity-20 disabled:pointer-events-none"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Your original 4 metric cards — UNCHANGED */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">Monthly Share ({currentMonthName})</span>
              <div className="text-2xl font-bold text-neutral-900 mt-2 font-mono tabular-nums">{formatCurrency(balance.totalMonthlyShare, currencySymbol)}</div>
              <span className="text-xs text-neutral-600 mt-1 block">{participatingBills.length} active bills assigned</span>
            </div>
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">Payments Received This Month</span>
              <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">{formatCurrency(balance.totalPaid, currencySymbol)}</div>
              <span className="text-xs text-neutral-600 mt-1 block">{memberTransactions.length} payment entries</span>
            </div>
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">Total Balance Due</span>
                <div className={`text-2xl font-bold mt-2 font-mono tabular-nums ${hostTimelineOverview.grandTotalOutstanding === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {hostTimelineOverview.grandTotalOutstanding === 0 ? 'Settled' : formatCurrency(hostTimelineOverview.grandTotalOutstanding, currencySymbol)}
                </div>
              </div>
              <div className="text-[11px] text-neutral-500 mt-2 pt-1.5 border-t border-neutral-100 space-y-0.5">
                <div className="flex justify-between">
                  <span>This Month:</span>
                  <span className="font-mono font-semibold text-neutral-800">{formatCurrency(balance.remainingDue, currencySymbol)}</span>
                </div>
                {hostTimelineOverview.accumulatedDebtPriorToCurrent > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>Arrears (Past Months):</span>
                    <span className="font-mono font-bold">+{formatCurrency(hostTimelineOverview.accumulatedDebtPriorToCurrent, currencySymbol)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-col justify-between gap-1.5">
              <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">Quick Action</span>
              {activeMember.isAccountHolder && (
                <button
                  onClick={() => onOpenAddTransaction({
                    type: 'incoming', source: 'manual', fromMemberId: activeMember.id, ...({ memberId: activeMember.id }),
                    amount: balance.remainingDue > 0 ? balance.remainingDue : undefined,
                    description: `${activeMember.name} Bank Transfer`, category: 'Household Reimbursement',
                    date: new Date().toISOString().split('T')[0]
                  } as any)}
                  className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /><span>Record Bank Transfer</span>
                </button>
              )}
              <button
                onClick={() => onOpenAddTransaction({
                  type: 'incoming', source: 'manual', fromMemberId: activeMember.id, ...({ memberId: activeMember.id }),
                  amount: hostTimelineOverview.grandTotalOutstanding > 0 ? hostTimelineOverview.grandTotalOutstanding : undefined,
                  description: `Cash settlement from ${activeMember.name}`, category: 'Other',
                  date: new Date().toISOString().split('T')[0]
                } as any)}
                className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /><span>Record Cash Payment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Arrears toolbar — your original */}
        {!activeMember.isAccountHolder && (() => {
          const hostUnpaidNodes: { key: string; label: string; amount: number }[] = [];
          filterOptions.forEach(opt => {
            const metrics = timelineDataMap[opt.key];
            if (metrics && metrics.arrears > 0) {
              const labelStr = new Date(`${opt.key}-02T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
              hostUnpaidNodes.push({ key: opt.key, label: labelStr, amount: metrics.arrears });
            }
          });
          if (hostUnpaidNodes.length === 0) return null;
          return (
            <section className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 shadow-2xs">
              <span className="text-[10px] font-bold text-neutral-400 block uppercase tracking-wider mb-2">Unpaid Arrears Found In (Click to Settle Period):</span>
              <div className="flex flex-wrap gap-2">
                {hostUnpaidNodes.map((node) => (
                  <button
                    key={node.key}
                    type="button"
                    onClick={() => onOpenAddTransaction({
                      type: 'incoming', source: 'manual', fromMemberId: activeMember.id, ...({ memberId: activeMember.id }),
                      amount: node.amount,
                      description: `Cash settlement for ${node.label} - ${activeMember.name}`, category: 'Other',
                      date: `${node.key}-02`
                    } as any)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all shadow-2xs cursor-pointer group"
                  >
                    <span className="text-neutral-600 group-hover:text-rose-800">{node.label}:</span>
                    <span className="font-mono text-rose-600 font-bold">{formatCurrency(node.amount, currencySymbol)}</span>
                    <Plus className="w-3 h-3 text-rose-400 group-hover:text-rose-600 ml-0.5" />
                  </button>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Bills tables — your original */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><ReceiptText className="w-4 h-4 text-blue-600" /><span>Active Bills Assigned ({participatingBills.length})</span></h4>
              <span className="text-xs font-semibold text-neutral-700 font-mono">Total: {formatCurrency(balance.totalMonthlyShare, currencySymbol)}</span>
            </div>
            <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
              {participatingBills.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">This member does not participate in any shared bills.</div>
              ) : (
                participatingBills.map((bill) => {
                  const share = getMemberShareForBill(activeMember.id, bill, currentMonthKey);
                  return (
                    <div key={bill.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div>
                        <div className="font-semibold text-xs text-neutral-900">{bill.name}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">{bill.category} · Split {bill.participatingMemberIds.length} ways (Total: {formatCurrency(bill.amount, currencySymbol)})</div>
                      </div>
                      <div className="text-right font-mono font-bold text-xs text-neutral-900">{formatCurrency(share, currencySymbol)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><Ban className="w-4 h-4 text-amber-600" /><span>Excluded Bills ({excludedBills.length})</span></h4>
              <span className="text-xs text-neutral-500">Member pays £0.00</span>
            </div>
            <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
              {excludedBills.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">{activeMember.name} participates in all household bills.</div>
              ) : (
                excludedBills.map((bill) => {
                  const activeCount = bill.participatingMemberIds ? bill.participatingMemberIds.length : 0;
                  const perPersonActive = activeCount > 0 ? Math.round((bill.amount / activeCount) * 100) / 100 : 0;
                  return (
                    <div key={bill.id} className="p-3.5 flex items-center justify-between bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
                      <div>
                        <div className="font-semibold text-xs text-neutral-700 flex items-center gap-1.5">
                          <span>{bill.name}</span><span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Excluded</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Split among remaining {activeCount} housemates ({formatCurrency(perPersonActive, currencySymbol)} each)</div>
                      </div>
                      <div className="text-right font-mono text-xs text-neutral-400">£0.00</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Payment history — your original */}
        <div className="pt-4 border-t border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /><span>Payments Received from {activeMember.name}</span></h4>
            <span className="text-xs text-neutral-500">Bank transfers and cash payments</span>
          </div>
          <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {memberTransactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">No payment entries recorded from {activeMember.name} yet.</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {memberTransactions.map((tx) => (
                  <div key={tx.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-neutral-900">{tx.description}</div>
                      <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                        <span>{formatDate(tx.date)}</span>·<span>{tx.paymentMethod === 'cash' ? 'Cash' : 'Bank transfer'}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono font-semibold text-xs text-emerald-700">+{formatCurrency(tx.amount, currencySymbol)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};