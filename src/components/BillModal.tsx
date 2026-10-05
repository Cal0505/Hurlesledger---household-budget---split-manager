import React, { useState, useEffect } from 'react';
import { X, ReceiptText, Users, AlertCircle, Info } from 'lucide-react';
import { BillCategory, BillFrequency, HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency } from '../utils/formatters';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBill: (
    billData: Omit<HouseholdBill, 'id' | 'createdAt'>,
    billId?: string,
    outgoingTransactionIds?: string[]
  ) => void;
  members: Member[];
  importedTransactions: Transaction[];
  billToEdit?: HouseholdBill | null;
  currencySymbol: string;
}

const CATEGORIES: BillCategory[] = [
  'Utilities',
  'Internet & Tech',
  'Entertainment & Subscriptions',
  'Housing & Rent',
  'Groceries & Household',
  'Insurance & Tax',
  'Other',
];

export const BillModal: React.FC<BillModalProps> = ({
  isOpen,
  onClose,
  onSaveBill,
  members,
  importedTransactions,
  billToEdit,
  currencySymbol,
}) => {
  const [selectedDebitGroupKey, setSelectedDebitGroupKey] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BillCategory>('Utilities');
  const [amount, setAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [dueDay, setDueDay] = useState<number>(1);
  const [payerMemberIds, setPayerMemberIds] = useState<string[]>([]);
  const [participatingMemberIds, setParticipatingMemberIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Dynamic state selectors to lock targets on manual entries
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [manualBillingMonth, setManualBillingMonth] = useState(currentMonthKey);

  // Generate a scrolling historical list of target choices
  const selectableMonths = React.useMemo(() => {
    const list = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      list.push({ key, label });
    }
    return list;
  }, []);
  const importedDebitGroups = React.useMemo(() => {
    const groups = new Map<string, {
      key: string;
      description: string;
      monthKey: string;
      incurredDate: string;
      amount: number;
      transactionIds: string[];
    }>();

    importedTransactions
      .filter((transaction) =>
        transaction.type === 'outgoing'
        && transaction.source === 'csv-import'
        && !transaction.linkedBillId
      )
      .forEach((transaction) => {
        const description = transaction.description.trim() || 'Bank debit';
        const monthKey = transaction.date.slice(0, 7);
        const key = `${monthKey}:${description.toLocaleLowerCase()}`;
        const group = groups.get(key);
        if (group) {
          group.amount = Math.round((group.amount + transaction.amount) * 100) / 100;
          group.incurredDate = transaction.date < group.incurredDate ? transaction.date : group.incurredDate;
          group.transactionIds.push(transaction.id);
        } else {
          groups.set(key, {
            key,
            description,
            monthKey,
            incurredDate: transaction.date,
            amount: transaction.amount,
            transactionIds: [transaction.id],
          });
        }
      });

    return Array.from(groups.values()).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey) || a.description.localeCompare(b.description)
    );
  }, [importedTransactions]);

  useEffect(() => {
    if (billToEdit) {
      setSelectedDebitGroupKey('');
      setName(billToEdit.name);
      setCategory(billToEdit.category);
      setAmount(billToEdit.amount.toString());
      setFrequency(billToEdit.frequency);
      setDueDay(billToEdit.dueDay);
      setPayerMemberIds(billToEdit.payerMemberIds || [billToEdit.payerMemberId]);
      setParticipatingMemberIds(billToEdit.participatingMemberIds);
      setNotes(billToEdit.notes || '');
      
      if (billToEdit.incurredDate) {
        setManualBillingMonth(billToEdit.incurredDate.slice(0, 7));
      } else {
        setManualBillingMonth(currentMonthKey);
      }
    } else {
      setSelectedDebitGroupKey('');
      setName('');
      setCategory('Internet & Tech');
      setAmount('');
      setFrequency('monthly');
      setDueDay(1);
      setPayerMemberIds(members.filter((member) => member.isAccountHolder).map((member) => member.id));
      setParticipatingMemberIds(members.map((m) => m.id));
      setNotes('');
      setManualBillingMonth(currentMonthKey);
    }
    setErrorMsg('');
  }, [billToEdit, isOpen, members, currentMonthKey]);

  if (!isOpen) return null;

  const toggleMember = (memberId: string) => {
    if (participatingMemberIds.includes(memberId)) {
      setParticipatingMemberIds(participatingMemberIds.filter((id) => id !== memberId));
    } else {
      setParticipatingMemberIds([...participatingMemberIds, memberId]);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const participantCount = participatingMemberIds.length;
  const perPersonShare = participantCount > 0 ? Math.round((parsedAmount / participantCount) * 100) / 100 : 0;
  const excludedMembers = members.filter((m) => !participatingMemberIds.includes(m.id));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDebitGroup = importedDebitGroups.find((group) => group.key === selectedDebitGroupKey);
    if (!name.trim()) {
      setErrorMsg('Please enter a bill name.');
      return;
    }
    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }
    if (participatingMemberIds.length === 0) {
      setErrorMsg('At least one member must participate in this bill.');
      return;
    }
    if (payerMemberIds.length === 0) {
      setErrorMsg('Choose at least one account holder or payer.');
      return;
    }

    // FIXED: Construct a complete date string mapping context if it's manual
    const finalIncurredDate = frequency === 'one-off'
      ? selectedDebitGroup?.incurredDate || 
        billToEdit?.incurredDate || 
        `${manualBillingMonth}-${String(dueDay).padStart(2, '0')}`
      : undefined;

    onSaveBill(
      {
        name: name.trim(),
        category,
        amount: parsedAmount,
        frequency,
        dueDay,
        incurredDate: finalIncurredDate,
        payerMemberId: payerMemberIds[0],
        payerMemberIds,
        participatingMemberIds,
        notes: notes.trim(),
        isActive: billToEdit ? billToEdit.isActive : true,
      },
      billToEdit?.id,
      selectedDebitGroup?.transactionIds
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <ReceiptText className="w-5 h-5 text-neutral-800" />
            <h3 className="text-base font-bold text-neutral-900">
              {billToEdit ? 'Edit Household Bill' : 'Add New Household Bill'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {!billToEdit && importedDebitGroups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Select an imported host-account debit (optional)
              </label>
              <select
                value={selectedDebitGroupKey}
                onChange={(event) => {
                  const group = importedDebitGroups.find((item) => item.key === event.target.value);
                  setSelectedDebitGroupKey(group?.key || '');
                  if (group) {
                    const transactionDate = new Date(`${group.incurredDate}T00:00:00`);
                    setName(group.description);
                    setAmount(group.amount.toFixed(2));
                    setCategory('Other');
                    setFrequency('one-off');
                    setDueDay(Number.isNaN(transactionDate.getTime()) ? 1 : transactionDate.getDate());
                    setNotes(`Imported from bank statement for ${group.monthKey}`);
                  } else {
                    setName('');
                    setAmount('');
                    setCategory('Internet & Tech');
                    setFrequency('monthly');
                    setDueDay(1);
                    setNotes('');
                  }
                }}
                className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-xs"
              >
                <option value="">Create a bill manually</option>
                {importedDebitGroups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.description} · {new Date(`${group.monthKey}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} · {formatCurrency(group.amount, currencySymbol)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Bill Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Deezer Family, Virgin Media, British Gas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs md:text-sm border border-neutral-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BillCategory)}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Total Amount ({currencySymbol}) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md px-3 py-2 font-mono"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Billing Cycle
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BillFrequency)}
                disabled={!!selectedDebitGroupKey}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white disabled:opacity-70"
              >
                <option value="monthly">Monthly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
                <option value="one-off">One-Off</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Due Day of Month (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                className="w-full text-xs border border-neutral-300 rounded-md px-3 py-2 font-mono"
              />
            </div>
          </div>

          {/* 🌟 NEW: Custom target calendar month assignment panel */}
          {frequency === 'one-off' && !selectedDebitGroupKey && (
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <label className="block text-xs font-bold text-neutral-800 mb-1.5 uppercase tracking-wider">
                Target Billing Month *
              </label>
              <select
                value={manualBillingMonth}
                onChange={(e) => setManualBillingMonth(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white font-medium focus:ring-1 focus:ring-neutral-900"
              >
                {selectableMonths.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-neutral-500">
                Choose the specific statement month block this variable manual bill will be cataloged inside.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Paid from household bank account
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-200 p-2.5">
              {members.filter((member) =>
                member.isAccountHolder || payerMemberIds.includes(member.id)
              ).map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={payerMemberIds.includes(m.id)}
                    onChange={() => setPayerMemberIds((current) => current.includes(m.id)
                      ? current.filter((id) => id !== m.id)
                      : [...current, m.id])}
                    className="rounded border-neutral-300 text-neutral-900"
                  />
                  <span>{m.name}{m.isAccountHolder ? ' (Account holder)' : ''}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Split Participants
              </label>
              <span className="text-xs font-bold text-blue-700 tabular-nums">
                {participantCount > 0 
                  ? `${formatCurrency(perPersonShare, currencySymbol)} / person` 
                  : 'Select participants'}
              </span>
            </div>

            <div className="space-y-2">
              {members.map((member) => {
                const isChecked = participatingMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-colors ${
                      isChecked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} 
                        className="rounded border-neutral-300 text-neutral-900"
                      />
                      <div
                        className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-neutral-900">{member.name}</span>
                    </div>
                    <div className="text-xs font-mono font-medium text-neutral-900">
                      {isChecked ? formatCurrency(perPersonShare, currencySymbol) : '£0.00'}
                    </div>
                  </div>
                );
              })}
            </div>

            {excludedMembers.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{excludedMembers.map((m) => m.name).join(', ')}</strong> excluded from this split.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Notes & Reference (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Statement tracking references or notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-neutral-300 rounded-md p-2.5"
            />
          </div>

          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-900 text-white rounded-md text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
            >
              {billToEdit ? 'Save Changes' : 'Create Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
