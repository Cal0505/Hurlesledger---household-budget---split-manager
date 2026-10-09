import React, { useState, useMemo } from 'react';
import { Upload, Plus, Search, ChevronDown, ChevronUp, Trash2, Edit3 } from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate } from '../utils/formatters';

interface OutgoingViewProps {
  transactions: Transaction[];
  bills: HouseholdBill[];
  members: Member[];
  currencySymbol: string;
  onOpenImportCsv: () => void;
  onDeleteTransaction: (id: string) => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction> | null, editId?: string) => void;
}

export const OutgoingView: React.FC<OutgoingViewProps> = ({
  transactions,
  bills,
  members,
  currencySymbol,
  onOpenImportCsv,
  onDeleteTransaction,
  onOpenAddTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  const outgoing = useMemo(() =>
    transactions.filter(tx => tx.type === 'outgoing'),
    [transactions]
  );

  const months = useMemo(() => {
    const set = new Set(outgoing.map(tx => tx.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [outgoing]);

  const filtered = useMemo(() => {
    let list = selectedMonth === 'all'
      ? outgoing
      : outgoing.filter(tx => tx.date.startsWith(selectedMonth));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(tx =>
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.notes && tx.notes.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [outgoing, selectedMonth, searchQuery]);

  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Outgoing Money</h2>
          <p className="text-sm text-gray-500">Track all money spent</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenImportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Upload size={14} /> Import CSV
          </button>
          <button
            onClick={() => onOpenAddTransaction()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            {selectedMonth === 'all' ? 'All Months' : selectedMonth}
            {showMonthDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showMonthDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <button
                onClick={() => { setSelectedMonth('all'); setShowMonthDropdown(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                All Months
              </button>
              {months.map(month => (
                <button
                  key={month}
                  onClick={() => { setSelectedMonth(month); setShowMonthDropdown(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {month}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">Total Outgoing</p>
        <p className="text-2xl font-bold text-blue-800">{currencySymbol}{total.toFixed(2)}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Paid To</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No outgoing transactions found. Click "Add Transaction" to get started.
                </td>
              </tr>
            ) : (
              filtered.map(tx => {
                const linkedBill = bills.find(b => b.id === tx.linkedBillId);
                return (
                  <tr key={tx.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 text-gray-900">{tx.description}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {linkedBill ? linkedBill.name : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {currencySymbol}{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="hl-action-buttons justify-end">
                        <button
                          onClick={() => onOpenAddTransaction(tx, tx.id)}
                          className="hl-btn-icon"
                          title="Edit"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="hl-btn-icon hl-btn-icon--delete"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};