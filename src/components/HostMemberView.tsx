import React, { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  ReceiptText, 
  CheckCircle2, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  Ban 
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getMemberShareForBill, getPrimaryAccountLabel } from '../utils/storage';

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

  const filterOptions = (() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      options.push({ key, label });
    }
    return options;
  })();

  const hostTimelineOverview = (() => {
    if (activeMember.isAccountHolder) {
      return { accumulatedDebtPriorToCurrent: 0, grandTotalOutstanding: 0 };
    }

    const uniqueMonths = new Set<string>();
    bills.forEach(b => b.incurredDate && uniqueMonths.add(b.incurredDate.slice(0, 7)));
    uniqueMonths.add(currentMonthKey);

    let totalBillsAllTime = 0;
    let totalPaymentsAllTime = 0;

    uniqueMonths.forEach(mKey => {
      bills
        .filter(b => b.isActive && b.incurredDate && b.incurredDate.startsWith(mKey))
        .forEach(bill => {
          totalBillsAllTime += getMemberShareForBill(activeMember.id, bill, mKey);
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
            const uniqueMonths = new Set<string>();
            bills.forEach(b => b.incurredDate && uniqueMonths.add(b.incurredDate.slice(0, 7)));
            uniqueMonths.add(currentMonthKey);

            uniqueMonths.forEach(mKey => {
              bills.filter(b => b.isActive).forEach(bill => {
                totalBillsAllTime += getMemberShareForBill(m.id, bill, mKey);
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
              className={`flex items-center gap-2.5 Richmond px-3.5 py-2 rounded-lg border text-xs transition-all whitespace-nowrap ${
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* 🌟 UPGRADED: Quick-settle arrears toolbar block loops historic database records to add a cash prefill anchor */}
        {!activeMember.isAccountHolder && (() => {
          const hostUnpaidNodes: { key: string; label: string; amount: number }[] = [];
          filterOptions.forEach(opt => {
            let monthBills = 0;
            let monthPaid = 0;
            bills.filter(b => b.isActive).forEach(bill => {
              monthBills += getMemberShareForBill(activeMember.id, bill, opt.key);
            });
            transactions
              .filter(tx => tx.type === 'incoming' && (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) && tx.date.slice(0, 7) === opt.key)
              .forEach(tx => { monthPaid += tx.amount; });
            const monthOwed = Math.max(0, Math.round((monthBills - monthPaid) * 100) / 100);
            if (monthOwed > 0) {
              const labelStr = new Date(`${opt.key}-02T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
              hostUnpaidNodes.push({ key: opt.key, label: labelStr, amount: monthOwed });
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
