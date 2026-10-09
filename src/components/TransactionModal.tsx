import React, { useState, useEffect } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, AlertCircle } from 'lucide-react';
import { HouseholdBill, Member, Transaction, TransactionType } from '../types/budget';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>, existingId?: string) => void;
  members: Member[];
  bills: HouseholdBill[];
  currencySymbol: string;
  prefill?: Partial<Transaction> | null;
  editId?: string;
}

const INCOMING_CATEGORIES = [
  'Household Reimbursement',
  'Salary / Wage / Benefits',
  'Freelance / Side Gig',
  'Transfer / Refund',
  'Investment / Interest',
  'Other Income',
];

const OUTGOING_CATEGORIES = [
  'Household Bills',
  'Rent / Mortgage',
  'Groceries',
  'Personal Subscriptions',
  'Dining & Takeout',
  'Transport',
  'Shopping & Goods',
  'Healthcare',
  'Other Expense',
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSaveTransaction,
  members,
  bills,
  currencySymbol,
  prefill,
  editId,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<TransactionType>('incoming');
  const [date, setDate] = useState(todayStr);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Household Reimbursement');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash'>('bank');
  const [fromMemberId, setFromMemberId] = useState('');
  const [linkedBillId, setLinkedBillId] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (prefill) {
      setType(prefill.type || 'incoming');
      setDate(prefill.date || todayStr);
      setDescription(prefill.description || '');
      setAmount(prefill.amount ? prefill.amount.toString() : '');
      setCategory(prefill.category || (prefill.type === 'outgoing' ? 'Household Bills' : 'Household Reimbursement'));
      setPaymentMethod(prefill.paymentMethod || 'bank');
      setFromMemberId(prefill.fromMemberId || (prefill as any).memberId || '');
      setLinkedBillId(prefill.linkedBillId || '');
      setNotes(prefill.notes || '');
    } else {
      setType('incoming');
      setDate(todayStr);
      setDescription('');
      setAmount('');
      setCategory('Household Reimbursement');
      setPaymentMethod('bank');
      setFromMemberId('');
      setLinkedBillId('');
      setNotes('');
    }
    setErrorMsg('');
  }, [prefill, isOpen, todayStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setErrorMsg('Please enter a description.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    const finalMemberId = type === 'incoming' && fromMemberId ? fromMemberId : undefined;

    onSaveTransaction(
      {
        date,
        type,
        paymentMethod: type === 'incoming' ? paymentMethod : 'bank',
        description: description.trim(),
        amount: parsedAmount,
        category,
        account: prefill?.account || (type === 'incoming' && paymentMethod === 'cash' ? 'Cash' : 'Primary Shared Account'),
        fromMemberId: finalMemberId,
        linkedBillId: type === 'outgoing' && linkedBillId ? linkedBillId : undefined,
        notes: notes.trim(),
        source: 'manual',
        ...((prefill as any)?.memberId || finalMemberId ? { memberId: (prefill as any)?.memberId || finalMemberId } : {}),
      } as any,
      editId
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2">
            {type === 'incoming' ? (
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-amber-600" />
            )}
            <h3 className="text-base font-bold text-neutral-900">
              {editId ? 'Edit Transaction' : (
                type === 'incoming'
                  ? paymentMethod === 'cash' ? 'Record Cash Payment' : 'Record Bank Inflow'
                  : 'Record Bank Outflow'
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-md">
            <button
              type="button"
              onClick={() => {
                setType('incoming');
                setCategory('Household Reimbursement');
              }}
              className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                type === 'incoming'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Incoming Inflow (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('outgoing');
                setCategory('Household Bills');
              }}
              className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                type === 'outgoing'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Outgoing Outflow (-)
            </button>
          </div>

          {type === 'incoming' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'bank' | 'cash')}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white"
              >
                <option value="bank">Bank transfer / deposit</option>
                <option value="cash">Cash payment</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs md:text-sm border border-neutral-300 rounded-md px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Description / Payee *
            </label>
            <input
              type="text"
              placeholder={type === 'incoming' ? 'e.g. Chelsea Transfer - Energy share' : 'e.g. British Gas Direct Debit'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs md:text-sm border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white"
            >
              {(type === 'incoming' ? INCOMING_CATEGORIES : OUTGOING_CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {type === 'incoming' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Reimbursement From Household Member (Optional)
              </label>
              <select
                value={fromMemberId}
                onChange={(e) => setFromMemberId(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white"
              >
                <option value="">None (Salary / External Deposit)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isAccountHolder ? '(Self Transfer)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-neutral-500 mt-0.5 block">
                Linking to a member will automatically credit their settlement balance.
              </span>
            </div>
          )}

          {type === 'outgoing' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Link to Household Bill (Optional)
              </label>
              <select
                value={linkedBillId}
                onChange={(e) => setLinkedBillId(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-md px-2.5 py-2 bg-white"
              >
                <option value="">None (General Outflow)</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.frequency})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              placeholder="Optional notes or statement reference"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-neutral-300 rounded-md px-3 py-2"
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
              {editId ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};