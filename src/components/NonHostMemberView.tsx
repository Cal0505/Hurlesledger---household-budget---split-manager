import React, { useState, useMemo, useRef } from 'react';
import {
  ReceiptText,
  Ban,
  Calendar,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ArrowDownLeft,
  Edit3
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getMemberShareForBill } from '../utils/storage';

interface NonHostMemberViewProps {
  activeMember: Member;
  bills: HouseholdBill[];
  transactions: Transaction[];
  currencySymbol: string;
  currentMonthKey: string;
  currentMonthName: string;
  onEditMember: (member: Member) => void;
  setSelectedMonthDate: React.Dispatch<React.SetStateAction<Date>>;
}

const ITEMS_PER_PAGE = 4;
const STEP_DEG = 28;
const Z_DEPTH = 135;

export const NonHostMemberView: React.FC<NonHostMemberViewProps> = ({
  activeMember,
  bills,
  transactions,
  currencySymbol,
  currentMonthKey,
  currentMonthName,
  onEditMember,
  setSelectedMonthDate,
}) => {
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [excludedPage, setExcludedPage] = useState(1);
  const isMoving = useRef(false);

  // Generate 12-month timeline — NEWEST FIRST
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

  // Timeline data: billed / paid / arrears per month
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

  // All-time outstanding
  const allTimeOutstandingDue = useMemo(() => {
    let totalBills = 0, totalPaid = 0;
    filterOptions.forEach(opt => {
      const m = timelineDataMap[opt.key];
      if (m) { totalBills += m.billed; totalPaid += m.paid; }
    });
    return Math.max(0, Math.round((totalBills - totalPaid) * 100) / 100);
  }, [filterOptions, timelineDataMap]);

  // Unpaid months list
  const unpaidMonthNodes = useMemo(() => {
    return filterOptions
      .filter(opt => (timelineDataMap[opt.key]?.arrears ?? 0) > 0)
      .map(opt => ({
        key: opt.key,
        label: new Date(`${opt.key}-02T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
        amount: timelineDataMap[opt.key]?.arrears ?? 0
      }));
  }, [filterOptions, timelineDataMap]);

  // Timeline navigation
  const goToIndex = (newIdx: number) => {
    if (isMoving.current) return;
    if (newIdx < 0 || newIdx >= filterOptions.length) return;
    isMoving.current = true;
    setSelectedMonthDate(filterOptions[newIdx].dateObj);
    setActivePage(1);
    setExcludedPage(1);
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

  // Bills filtering
  const participatingBills = useMemo(() => bills.filter(
    b => b.isActive && b.participatingMemberIds.includes(activeMember.id) &&
        (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  ), [bills, activeMember.id, currentMonthKey]);

  const excludedBills = useMemo(() => bills.filter(
    b => b.isActive && !b.participatingMemberIds.includes(activeMember.id) &&
        (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  ), [bills, activeMember.id, currentMonthKey]);

  // Pagination
  const totalActivePages = Math.ceil(participatingBills.length / ITEMS_PER_PAGE) || 1;
  const totalExcludedPages = Math.ceil(excludedBills.length / ITEMS_PER_PAGE) || 1;

  const paginatedActiveBills = useMemo(() => {
    const offset = (activePage - 1) * ITEMS_PER_PAGE;
    return participatingBills.slice(offset, offset + ITEMS_PER_PAGE);
  }, [participatingBills, activePage]);

  const paginatedExcludedBills = useMemo(() => {
    const offset = (excludedPage - 1) * ITEMS_PER_PAGE;
    return excludedBills.slice(offset, offset + ITEMS_PER_PAGE);
  }, [excludedBills, excludedPage]);

  // Payments history
  const memberTransactions = useMemo(() => transactions
    .filter(t =>
      t.type === 'incoming' &&
      t.fromMemberId === activeMember.id &&
      t.date.slice(0, 7) === currentMonthKey
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [transactions, activeMember.id, currentMonthKey]);

  const coveragePercent = useMemo(() => {
    const owed = timelineDataMap[currentMonthKey]?.billed ?? 0;
    const paid = timelineDataMap[currentMonthKey]?.paid ?? 0;
    return owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 100;
  }, [timelineDataMap, currentMonthKey]);

  const handleCopyShareText = () => {
    let lines = [`*${currentMonthName} Split Breakdown for ${activeMember.name}*`];
    participatingBills.forEach((b) => {
      const share = getMemberShareForBill(activeMember.id, b, currentMonthKey);
      lines.push(`• ${b.name}: ${formatCurrency(share, currencySymbol)}`);
    });
    lines.push(`*Total Balance Due: ${formatCurrency(allTimeOutstandingDue, currencySymbol)}*`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // ─── RENDER ───
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* Header — YOUR ORIGINAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full text-white text-xl font-bold flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: activeMember.avatarColor }}>
            {activeMember.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-900 tracking-tight">{activeMember.name}</h3>
            <p className="text-xs text-neutral-600 mt-1">{activeMember.email || 'No email specified'} · {activeMember.notes || 'Household Flatmate'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button onClick={handleCopyShareText} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors">
            {copiedNotification ? (
              <div className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700">Copied Overview!</span></div>
            ) : (
              <div className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /><span>Copy Shares</span></div>
            )}
          </button>
          <button onClick={() => onEditMember(activeMember)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit My Profile</span>
          </button>
        </div>
      </div>

      {/* Tumbler + Metrics — Tumbler Added, Your Cards Restored */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 3D Cylinder Tumbler — ONLY NEW THING ADDED */}
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

        {/* YOUR ORIGINAL 4 METRIC CARDS — UNCHANGED */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-sm">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Monthly Share ({currentMonthName})</span>
            <div className="text-2xl font-bold text-neutral-900 mt-2 font-mono tabular-nums">
              {formatCurrency(timelineDataMap[currentMonthKey]?.billed || 0, currencySymbol)}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">{participatingBills.length} active bills assigned</span>
          </div>
          <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-sm">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Payments Settled ({currentMonthName})</span>
            <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">
              {formatCurrency(timelineDataMap[currentMonthKey]?.paid || 0, currencySymbol)}
            </div>
            <span className="text-xs text-neutral-400 mt-1 block">{coveragePercent}% covered this cycle</span>
          </div>
          <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Total Balance Due</span>
              <div className={`text-2xl font-bold mt-2 font-mono tabular-nums ${allTimeOutstandingDue === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {allTimeOutstandingDue === 0 ? 'Settled' : formatCurrency(allTimeOutstandingDue, currencySymbol)}
              </div>
            </div>
            {allTimeOutstandingDue > 0 && (
              <div className="text-[10px] font-bold text-rose-700 mt-2 pt-1 border-t border-neutral-100 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Arrears exist in past statements</span>
              </div>
            )}
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Ledger Status</span>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Your profile is verified and linked to this household ledger.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider pt-2 border-t border-neutral-100">
              HearthLedger Verified
            </div>
          </div>
        </div>
      </div>

      {/* YOUR ORIGINAL Arrears Section */}
      {unpaidMonthNodes.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-neutral-400 block uppercase tracking-wider mb-2">Unpaid Arrears Found In:</span>
          <div className="flex flex-wrap gap-1.5">
            {unpaidMonthNodes.map((node) => (
              <button
                key={node.key}
                type="button"
                onClick={() => setSelectedMonthDate(new Date(`${node.key}-02T00:00:00`))}
                className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <span>{node.label}</span>
                <span className="font-mono text-neutral-400 font-normal">({formatCurrency(node.amount, currencySymbol)})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* YOUR ORIGINAL Bills Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-blue-600" />
            <span>Active Bills Assigned ({participatingBills.length})</span>
          </h4>
          <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {paginatedActiveBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500">No shared bills assigned to you this period.</div>
            ) : (
              paginatedActiveBills.map((bill) => {
                const share = getMemberShareForBill(activeMember.id, bill, currentMonthKey);
                return (
                  <div key={bill.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                    <div>
                      <div className="font-semibold text-xs text-neutral-900">{bill.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{bill.category} · Bill total: {formatCurrency(bill.amount, currencySymbol)}</div>
                    </div>
                    <div className="text-right font-mono font-bold text-xs text-neutral-900 tabular-nums">
                      {formatCurrency(share, currencySymbol)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {totalActivePages > 1 && (
            <div className="flex items-center justify-between px-1">
              <button type="button" disabled={activePage === 1} onClick={() => setActivePage(p => p - 1)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" /><span>Prev</span>
              </button>
              <span className="text-[10px] font-bold opacity-50">Page {activePage} of {totalActivePages}</span>
              <button type="button" disabled={activePage === totalActivePages} onClick={() => setActivePage(p => p + 1)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 disabled:opacity-30">
                <span>Next</span><ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <Ban className="w-4 h-4 text-amber-600" />
            <span>Excluded From Bills ({excludedBills.length})</span>
          </h4>
          <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {paginatedExcludedBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500">You participate in all shared household bills this month.</div>
            ) : (
              paginatedExcludedBills.map((bill) => (
                <div key={bill.id} className="p-3.5 flex items-center justify-between bg-neutral-50/40 hover:bg-neutral-50 transition-colors">
                  <div>
                    <div className="font-semibold text-xs text-neutral-700">{bill.name}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{bill.category} · Total: {formatCurrency(bill.amount, currencySymbol)}</div>
                  </div>
                  <div className="font-mono text-xs text-neutral-400">£0.00</div>
                </div>
              ))
            )}
          </div>
          {totalExcludedPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <button type="button" disabled={excludedPage === 1} onClick={() => setExcludedPage(p => p - 1)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" /><span>Prev</span>
              </button>
              <span className="text-[10px] font-bold opacity-50">Page {excludedPage} of {totalExcludedPages}</span>
              <button type="button" disabled={excludedPage === totalExcludedPages} onClick={() => setExcludedPage(p => p + 1)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 disabled:opacity-30">
                <span>Next</span><ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* YOUR ORIGINAL Payment History */}
      <div className="pt-4 border-t border-neutral-200 space-y-3">
        <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          <span>My Personal Payment History</span>
        </h4>
        <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
          {memberTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">No payment records logged under your profile index yet for this period.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {memberTransactions.map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                  <div>
                    <div className="font-medium text-xs text-neutral-900">{tx.description}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {formatDate(tx.date)} · {tx.paymentMethod === 'cash' ? 'Cash Settlement' : 'Bank Transfer'}
                    </div>
                  </div>
                  <div className="font-mono font-semibold text-xs text-emerald-700 tabular-nums">
                    +{formatCurrency(tx.amount, currencySymbol)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};