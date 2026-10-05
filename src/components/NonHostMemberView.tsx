import React, { useState } from 'react';
import { 
  ReceiptText, 
  AlertCircle, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  Ban,
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

  // 1. Generate options looking back 12 cycles for the dropdown menu component
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

  // 2. Compute variables strictly isolated inside the target select date drop-down frame
  const activePeriodData = (() => {
    const ledgerBox = {
      charges: [] as { name: string; category: string; share: number; totalBill: number }[],
      totalOwed: 0,
      totalPaid: 0,
    };

    bills.filter(b => b.isActive).forEach(bill => {
      const individualShare = getMemberShareForBill(activeMember.id, bill, currentMonthKey);
      if (individualShare > 0) {
        ledgerBox.charges.push({
          name: bill.name,
          category: bill.category,
          share: individualShare,
          totalBill: bill.amount
        });
        ledgerBox.totalOwed = Math.round((ledgerBox.totalOwed + individualShare) * 100) / 100;
      }
    });

    transactions
      .filter(tx => tx.type === 'incoming' && 
                    (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) &&
                    tx.date.slice(0, 7) === currentMonthKey)
      .forEach(tx => {
        ledgerBox.totalPaid = Math.round((ledgerBox.totalPaid + tx.amount) * 100) / 100;
      });

    return ledgerBox;
  })();

  // 3. Scans the past 12 months to isolate exactly which items remain unpaid
  const unpaidMonthNodes = (() => {
    const unpaidList: { key: string; label: string; amount: number }[] = [];
    
    filterOptions.forEach(opt => {
      let monthBills = 0;
      let monthPaid = 0;
      
      bills.filter(b => b.isActive).forEach(bill => {
        monthBills += getMemberShareForBill(activeMember.id, bill, opt.key);
      });

      transactions
        .filter(tx => tx.type === 'incoming' && 
                      (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id) && 
                      tx.date.slice(0, 7) === opt.key)
        .forEach(tx => {
          monthPaid += tx.amount;
        });

      const monthOwed = Math.max(0, Math.round((monthBills - monthPaid) * 100) / 100);
      
      if (monthOwed > 0) {
        const shortLabel = new Date(`${opt.key}-02T00:00:00`).toLocaleDateString('en-GB', { month: 'short' });
        unpaidList.push({ key: opt.key, label: shortLabel, amount: monthOwed });
      }
    });
    
    return unpaidList;
  })();
  // 4. Compute running global balance due across the entire timeline array sequence
  const allTimeOutstandingDue = (() => {
    let totalBillsAllTime = 0;
    let totalPaymentsAllTime = 0;
    
    filterOptions.forEach(opt => {
      bills.filter(b => b.isActive).forEach(bill => {
        totalBillsAllTime += getMemberShareForBill(activeMember.id, bill, opt.key);
      });
    });

    transactions
      .filter(tx => tx.type === 'incoming' && (tx.fromMemberId === activeMember.id || (tx as any).memberId === activeMember.id))
      .forEach(tx => {
        totalPaymentsAllTime += tx.amount;
      });

    return Math.max(0, Math.round((totalBillsAllTime - totalPaymentsAllTime) * 100) / 100);
  })();

  const coveragePercent = activePeriodData.totalOwed > 0 
    ? Math.min(100, Math.round((activePeriodData.totalPaid / activePeriodData.totalOwed) * 100)) 
    : 100;

  const participatingBills = bills.filter(
    (b) => b.isActive && b.participatingMemberIds.includes(activeMember.id) && (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  );

  const excludedBills = bills.filter(
    (b) => b.isActive && !b.participatingMemberIds.includes(activeMember.id) && (b.frequency !== 'one-off' || b.incurredDate?.startsWith(currentMonthKey))
  );

  // 🎯 FIXED: Filtering by the selected month slice ensures your history feed updates on dropdown clicks!
  const memberTransactions = transactions
    .filter((t) => 
      t.type === 'incoming' && 
      t.fromMemberId === activeMember.id &&
      t.date.slice(0, 7) === currentMonthKey
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* Upgraded Member Dashboard Header */}
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
          <button onClick={handleCopyShareText} className=" Richmond inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors">
            {copiedNotification ? (
              <div className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /><span className="text-emerald-700">Copied Overview!</span></div>
            ) : (
              <div className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /><span>Copy Shares</span></div>
            )}
          </button>
          <button onClick={() => onEditMember(activeMember)} className="Richmond inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit My Profile</span>
          </button>
        </div>
      </div>
      {/* Dynamic Period Dropdown Bar */}
      <div className="flex items-center justify-end gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
        <label htmlFor="period-select" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Statement Period:</label>
        <select
          id="period-select"
          value={currentMonthKey}
          onChange={(e) => setSelectedMonthDate(new Date(`${e.target.value}-02T00:00:00`))}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-2xs"
        >
          {filterOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Upgraded 4-Column Grid (Keeps design structure but masks bank data entries) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Monthly Share ({currentMonthName})</span>
          <div className="text-2xl font-bold text-neutral-900 mt-2 font-mono tabular-nums">{formatCurrency(activePeriodData.totalOwed, currencySymbol)}</div>
          <span className="text-xs text-neutral-400 mt-1 block">{participatingBills.length} active bills assigned</span>
        </div>

        <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-2xs">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Payments Settled ({currentMonthName})</span>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">{formatCurrency(activePeriodData.totalPaid, currencySymbol)}</div>
          <span className="text-xs text-neutral-400 mt-1 block">{coveragePercent}% covered this cycle</span>
        </div>

        <div className="p-4 rounded-lg bg-white border border-neutral-200 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Total Balance Due</span>
            <div className={`text-2xl font-bold mt-2 font-mono tabular-nums ${allTimeOutstandingDue === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {allTimeOutstandingDue === 0 ? 'Settled' : formatCurrency(allTimeOutstandingDue, currencySymbol)}
            </div>
          </div>
          {unpaidMonthNodes.length > 0 && (
            <div className="text-[10px] font-bold text-rose-700 mt-2 pt-1 border-t border-neutral-100 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Arrears exist in past statements</span>
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 shadow-2xs flex flex-col justify-between">
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
      {unpaidMonthNodes.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-neutral-400 block uppercase tracking-wider mb-2">Unpaid Arrears Found In:</span>
          <div className="flex flex-wrap gap-1.5">
            {unpaidMonthNodes.map((node) => (
              <button
                key={node.key}
                type="button"
                onClick={() => setSelectedMonthDate(new Date(`${node.key}-02T00:00:00`))}
                className="Richmond inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors"
              >
                <span>{node.label}</span>
                <span className="font-mono text-neutral-400 font-normal">({formatCurrency(node.amount, currencySymbol)})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><ReceiptText className="w-4 h-4 text-blue-600" /><span>Active Bills Assigned ({participatingBills.length})</span></h4>
          <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {participatingBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500">No shared bills assigned to you this period.</div>
            ) : (
              participatingBills.map((bill) => {
                const share = getMemberShareForBill(activeMember.id, bill, currentMonthKey);
                return (
                  <div key={bill.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                    <div>
                      <div className="font-semibold text-xs text-neutral-900">{bill.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{bill.category} · Bill total: {formatCurrency(bill.amount, currencySymbol)}</div>
                    </div>
                    <div className="text-right font-mono font-bold text-xs text-neutral-900 tabular-nums">{formatCurrency(share, currencySymbol)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><Ban className="w-4 h-4 text-amber-600" /><span>Excluded From Bills ({excludedBills.length})</span></h4>
          <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg overflow-hidden bg-white">
            {excludedBills.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500">You participate in all shared household bills this month.</div>
            ) : (
              excludedBills.map((bill) => (
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
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-200 space-y-3">
        <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /><span>My Personal Payment History</span></h4>
        <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
          {memberTransactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">No payment records logged under your profile index yet for this period.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {memberTransactions.map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                  <div>
                    <div className="font-medium text-xs text-neutral-900">{tx.description}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{formatDate(tx.date)} · {tx.paymentMethod === 'cash' ? 'Cash Settlement' : 'Bank Transfer'}</div>
                  </div>
                  <div className="font-mono font-semibold text-xs text-emerald-700 tabular-nums">+{formatCurrency(tx.amount, currencySymbol)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
