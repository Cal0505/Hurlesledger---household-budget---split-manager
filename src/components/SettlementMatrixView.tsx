import React, { useState } from 'react';
import { 
  Scale, 
  Copy, 
  Check, 
  Download, 
  HelpCircle, 
  ArrowRight,
  Sparkles,
  Users
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency } from '../utils/formatters';
import { getBillPerPersonShare, getMemberBalanceStatus, getMemberShareForBill, getPrimaryAccountLabel } from '../utils/storage';
import { triggerFileDownload } from '../utils/csv';

interface SettlementMatrixViewProps {
  members: Member[];
  bills: HouseholdBill[];
  transactions: Transaction[];
  primaryUserId: string;
  currencySymbol: string;
}

export const SettlementMatrixView: React.FC<SettlementMatrixViewProps> = ({
  members,
  bills,
  transactions,
  primaryUserId,
  currencySymbol,
}) => {
  const [copied, setCopied] = useState(false);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const activeBills = bills.filter((bill) =>
    bill.isActive
    && (bill.frequency !== 'one-off' || bill.incurredDate?.startsWith(currentMonthKey))
  );

  // Balances
  const memberStatuses = members.map((m) => {
    return {
      member: m,
      ...getMemberBalanceStatus(m, bills, transactions, currentMonthKey),
    };
  });

  const totalMonthlyHouseholdCost = activeBills.reduce((sum, bill) => sum + bill.amount, 0);

  // Group chat summary copy
  const handleCopyHouseholdSummary = () => {
    let lines = [`🏠 *Household Budget Split - ${currentMonthName}* 🏠`];
    lines.push(`Total Household Bills: ${formatCurrency(totalMonthlyHouseholdCost, currencySymbol)}`);
    lines.push('────────────────────────');
    lines.push('');
    lines.push('*Bills Breakdown:*');
    activeBills.forEach((b) => {
      const per = getBillPerPersonShare(b);
      const excluded = members.filter((m) => !b.participatingMemberIds.includes(m.id));
      const exclText = excluded.length > 0 ? ` (${excluded.map((e) => e.name).join(', ')} excluded)` : '';
      lines.push(`• ${b.name}: ${formatCurrency(b.amount, currencySymbol)} → ${formatCurrency(per, currencySymbol)}/ea${exclText}`);
    });

    lines.push('');
    lines.push('*Monthly Balances & Due:*');
    memberStatuses.forEach(({ member, totalMonthlyShare, totalPaid, remainingDue, isSettled }) => {
      if (member.isAccountHolder) {
        lines.push(`• ${member.name} (Account Host): Share ${formatCurrency(totalMonthlyShare, currencySymbol)} (debited directly)`);
      } else if (isSettled) {
        lines.push(`• ${member.name}: ${formatCurrency(totalMonthlyShare, currencySymbol)} ✅ Settled in full`);
      } else {
        lines.push(`• ${member.name}: ${formatCurrency(totalMonthlyShare, currencySymbol)} (Paid ${formatCurrency(totalPaid, currencySymbol)} · *Owes ${formatCurrency(remainingDue, currencySymbol)}*)`);
      }
    });

    lines.push('');
    lines.push(`Transfers go to ${getPrimaryAccountLabel(members)}. Thank you!`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportMatrixCsv = () => {
    let csv = `Bill Name,Category,Total Amount,Frequency,${members.map((m) => m.name).join(',')}\n`;
    activeBills.forEach((b) => {
      const row = [
        `"${b.name}"`,
        `"${b.category}"`,
        b.amount.toFixed(2),
        b.frequency,
        ...members.map((m) => {
          const share = getMemberShareForBill(m.id, b);
          return share.toFixed(2);
        }),
      ];
      csv += row.join(',') + '\n';
    });

    // Total Share row
    csv += `Total Share,All,${totalMonthlyHouseholdCost.toFixed(2)},monthly,${memberStatuses.map((s) => s.totalMonthlyShare.toFixed(2)).join(',')}\n`;
    // Paid row
    csv += `Paid This Month,Payments Received,,${memberStatuses.map((s) => s.totalPaid.toFixed(2)).join(',')}\n`;
    // Due row
    csv += `Net Remaining Due,Balance,,${memberStatuses.map((s) => s.remainingDue.toFixed(2)).join(',')}\n`;

    triggerFileDownload(csv, `household_split_matrix_${currentMonthKey}.csv`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
            Household Settlement Matrix
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Transparent line-by-line view of every shared bill, individual member allocations, and net transfers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyHouseholdSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied Group Text!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Group Chat Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportMatrixCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50/90 border-b border-neutral-200 text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 min-w-[220px]">Household Bill</th>
                <th className="px-4 py-4 text-right">Bill Total</th>
                {members.map((m) => (
                  <th key={m.id} className="px-4 py-4 text-right min-w-[120px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: m.avatarColor }}
                      >
                        {m.name.charAt(0)}
                      </div>
                      <span className="truncate">{m.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeBills.map((bill) => {
                const per = getBillPerPersonShare(bill);
                return (
                  <tr key={bill.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-neutral-900 text-xs">{bill.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {bill.category} · {bill.participatingMemberIds.length} of {members.length} split
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-medium text-neutral-800 tabular-nums">
                      {formatCurrency(bill.amount, currencySymbol)}
                    </td>
                    {members.map((m) => {
                      const isParticipating = bill.participatingMemberIds.includes(m.id);
                      const share = isParticipating ? per : 0;
                      return (
                        <td key={m.id} className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                          {isParticipating ? (
                            <span className="text-neutral-900 font-medium">
                              {formatCurrency(share, currencySymbol)}
                            </span>
                          ) : (
                            <span className="text-neutral-400 font-normal">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Summary Rows Footer */}
            <tfoot className="border-t-2 border-neutral-200 bg-neutral-50/80 text-xs">
              <tr className="font-semibold text-neutral-900">
                <td className="px-5 py-3.5">Monthly Share Total</td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-neutral-900">
                  {formatCurrency(totalMonthlyHouseholdCost, currencySymbol)}
                </td>
                {memberStatuses.map((s) => (
                  <td key={s.member.id} className="px-4 py-3.5 text-right font-mono font-bold tabular-nums">
                    {formatCurrency(s.totalMonthlyShare, currencySymbol)}
                  </td>
                ))}
              </tr>

              <tr className="text-neutral-600 border-t border-neutral-200">
                <td className="px-5 py-3">Paid / Transferred</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">—</td>
                {memberStatuses.map((s) => (
                  <td key={s.member.id} className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold tabular-nums">
                    {s.member.isAccountHolder ? 'Direct Debit' : `+${formatCurrency(s.totalPaid, currencySymbol)}`}
                  </td>
                ))}
              </tr>

              <tr className="bg-neutral-100 font-bold border-t border-neutral-300">
                <td className="px-5 py-3.5 text-neutral-900">Remaining Balance Due</td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums">—</td>
                {memberStatuses.map((s) => (
                  <td key={s.member.id} className="px-4 py-3.5 text-right font-mono tabular-nums">
                    {s.member.isAccountHolder ? (
                      <span className="text-blue-700">Host Account</span>
                    ) : s.isSettled ? (
                      <span className="text-emerald-700 flex items-center justify-end gap-1 font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        Settled
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        {formatCurrency(s.remainingDue, currencySymbol)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Explanatory Settlement Card */}
      <div className="p-5 rounded-lg border border-neutral-200 bg-white shadow-2xs space-y-3">
        <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Settlement Action Plan for {currentMonthName}</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {memberStatuses
            .filter((s) => !s.member.isAccountHolder)
            .map((s) => (
              <div key={s.member.id} className="p-3.5 rounded-md border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-xs text-neutral-900">
                    <div
                      className="w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: s.member.avatarColor }}
                    >
                      {s.member.name.charAt(0)}
                    </div>
                    <span>{s.member.name}</span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-2">
                    {s.isSettled ? (
                      <span className="text-emerald-700 font-medium">Fully settled for this cycle.</span>
                    ) : (
                      <span>Owes <strong className="text-neutral-900">{formatCurrency(s.remainingDue, currencySymbol)}</strong> to {getPrimaryAccountLabel(members)}.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
