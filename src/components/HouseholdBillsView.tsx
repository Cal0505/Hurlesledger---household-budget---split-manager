import React, { useState } from 'react';
import { 
  ReceiptText, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Calendar, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { HouseholdBill, Member } from '../types/budget';
import { formatCurrency, formatDate, formatMonthLabel, getOrdinalSuffix } from '../utils/formatters';
import { getBillPerPersonShare } from '../utils/storage';

interface HouseholdBillsViewProps {
  bills: HouseholdBill[];
  members: Member[];
  canManageBills: boolean;
  currencySymbol: string;
  onOpenAddBill: () => void;
  onEditBill: (bill: HouseholdBill) => void;
  onDeleteBill: (id: string) => void;
  onToggleMemberInBill: (billId: string, memberId: string) => void;
  onToggleBillActive: (billId: string) => void;
}

export const HouseholdBillsView: React.FC<HouseholdBillsViewProps> = ({
  bills,
  members,
  canManageBills,
  currencySymbol,
  onOpenAddBill,
  onEditBill,
  onDeleteBill,
  onToggleMemberInBill,
  onToggleBillActive,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredBills = bills.filter((b) => {
    if (categoryFilter === 'all') return true;
    return b.category === categoryFilter;
  });

  const totalMonthlyActive = bills
    .filter((b) => b.isActive && b.frequency !== 'one-off')
    .reduce((sum, b) => sum + b.amount, 0);

  const categories = Array.from(new Set(bills.map((b) => b.category)));
  const groupedBills = new Map<string, HouseholdBill[]>();
  filteredBills.forEach((bill) => {
    const groupKey = bill.frequency === 'one-off'
      ? bill.incurredDate?.slice(0, 7) || 'undated'
      : 'recurring';
    groupedBills.set(groupKey, [...(groupedBills.get(groupKey) || []), bill]);
  });
  const billGroups = Array.from(groupedBills, ([key, groupBills]) => ({ key, bills: groupBills }))
    .sort((a, b) => {
      if (a.key === 'recurring') return -1;
      if (b.key === 'recurring') return 1;
      return b.key.localeCompare(a.key);
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
            Household Bills & Split Rules
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Manage shared household expenses. If a member does not use a bill, exclude them to split it only among active users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddBill}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Household Bill</span>
          </button>
        </div>
      </div>

      {/* Info Callout explaining Deezer & exclusion rule */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-neutral-700 leading-relaxed">
          <strong className="font-semibold text-neutral-900">Custom Participation Rule in Action: </strong>
          Check or uncheck member tags on any bill below to include or exclude them instantly. 
          For example, if <strong>Carl</strong> does not use the <strong>Deezer Family</strong> subscription, 
          unchecking Carl splits the £14.99 equally between <strong>Chelsea, Ebony, and Lora (£5.00 each)</strong>, 
          leaving Carl's share at £0.00.
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Total Monthly Shared Bills
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalMonthlyActive, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            {bills.filter((b) => b.isActive && b.frequency !== 'one-off').length} active recurring commitments
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Household Size
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {members.length} Members
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            {members.map((m) => m.name).join(', ')}
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Primary Direct Debit Account
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700">
            Carl's Bank Account
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Collects split reimbursements
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-md overflow-x-auto">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            categoryFilter === 'all'
              ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          All Bills ({bills.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              categoryFilter === cat
                ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {cat} ({bills.filter((b) => b.category === cat).length})
          </button>
        ))}
      </div>

      {/* Bills Cards Grid */}
      <div className="space-y-8">
        {billGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <h3 className="text-sm font-bold text-neutral-800">
                {group.key === 'recurring'
                  ? 'Recurring household bills'
                  : group.key === 'undated' ? 'Statement bills · date unavailable' : `Statement bills · ${formatMonthLabel(group.key)}`}
              </h3>
              {group.key !== 'recurring' && (
                <span className="text-xs font-semibold text-neutral-600 tabular-nums">
                  {formatCurrency(group.bills.reduce((sum, bill) => sum + bill.amount, 0), currencySymbol)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {group.bills.map((bill) => {
          const perPerson = getBillPerPersonShare(bill);
          const participantCount = bill.participatingMemberIds.length;
          const payerIds = bill.payerMemberIds?.length ? bill.payerMemberIds : [bill.payerMemberId];
          const payers = members.filter((member) => payerIds.includes(member.id));
          const excludedMembers = members.filter((m) => !bill.participatingMemberIds.includes(m.id));

          return (
            <div
              key={bill.id}
              className={`bg-white border rounded-lg p-5 flex flex-col justify-between transition-all shadow-2xs ${
                bill.isActive ? 'border-neutral-200 hover:border-neutral-300' : 'border-neutral-200 opacity-60 bg-neutral-50/50'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                        {bill.name}
                      </h3>
                      {!bill.isActive && (
                        <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-600 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{bill.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {bill.frequency === 'one-off'
                          ? `Statement date ${bill.incurredDate ? formatDate(bill.incurredDate) : getOrdinalSuffix(bill.dueDay)}`
                          : `Due ${getOrdinalSuffix(bill.dueDay)} of month`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Paid by {payers.length > 0
                          ? `${payers.map((member) => member.name).join(' & ')}${payers.length > 1 ? ' (joint account)' : ''}`
                          : 'account holder'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold text-neutral-900 tabular-nums">
                      {formatCurrency(bill.amount, currencySymbol)}
                    </div>
                    <div className="text-xs text-neutral-600 tabular-nums font-medium">
                      {bill.frequency}
                    </div>
                  </div>
                </div>

                {bill.notes && (
                  <p className="text-xs text-neutral-600 mt-3 pt-3 border-t border-neutral-100 leading-relaxed">
                    {bill.notes}
                  </p>
                )}

                {/* Interactive Member Split Toggles */}
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      Participants ({participantCount} of {members.length})
                    </span>
                    <span className="text-xs font-semibold text-blue-700 tabular-nums">
                      {participantCount > 0 
                        ? `${formatCurrency(perPerson, currencySymbol)} each` 
                        : 'No participants'}
                    </span>
                  </div>

                  {/* Toggle Chips */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {members.map((member) => {
                      const isIncluded = bill.participatingMemberIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => onToggleMemberInBill(bill.id, member.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                            isIncluded
                              ? 'border-neutral-900 bg-neutral-900 text-white font-medium shadow-2xs'
                              : 'border-dashed border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                              style={{ backgroundColor: member.avatarColor }}
                            >
                              {member.name.charAt(0)}
                            </div>
                            <span className="truncate">{member.name}</span>
                          </div>
                          <div className="shrink-0 tabular-nums ml-1">
                            {isIncluded ? (
                              <span className="text-[11px] font-mono text-neutral-200">
                                {formatCurrency(perPerson, currencySymbol)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-400">
                                £0 (excluded)
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {excludedMembers.length > 0 && (
                    <div className="text-[11px] text-amber-700 mt-2 flex items-center gap-1 font-medium">
                      <span>Excluded:</span>
                      <span>{excludedMembers.map((m) => m.name).join(', ')}</span>
                      <span className="text-neutral-400">· saves {formatCurrency(perPerson, currencySymbol)} each</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={() => onToggleBillActive(bill.id)}
                  className="text-xs text-neutral-600 hover:text-neutral-900 font-medium"
                >
                  {bill.isActive ? 'Pause Bill' : 'Resume Bill'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditBill(bill)}
                    className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors"
                    title="Edit bill details"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteBill(bill.id)}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="Delete bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
