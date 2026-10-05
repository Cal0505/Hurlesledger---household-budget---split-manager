import React, { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  Upload, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  ReceiptText,
  FileSpreadsheet,
  Link as LinkIcon
} from 'lucide-react';
import { HouseholdBill, Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate, formatMonthLabel } from '../utils/formatters';

interface OutgoingViewProps {
  transactions: Transaction[];
  bills: HouseholdBill[];
  members: Member[];
  currencySymbol: string;
  onOpenImportCsv: () => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
}

export const OutgoingView: React.FC<OutgoingViewProps> = ({
  transactions,
  bills,
  members,
  currencySymbol,
  onOpenImportCsv,
  onOpenAddTransaction,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter outgoing transactions
  const outgoingTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'outgoing');
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    outgoingTransactions.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [outgoingTransactions]);

  const filteredTransactions = useMemo(() => {
    return outgoingTransactions.filter((tx) => {
      const matchesSearch = 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [outgoingTransactions, searchQuery, selectedCategory]);

  const totalOutgoing = outgoingTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalBillsOutgoing = outgoingTransactions
    .filter((t) => t.category === 'Household Bills')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalGroceries = outgoingTransactions
    .filter((t) => t.category === 'Groceries')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOther = totalOutgoing - totalBillsOutgoing - totalGroceries;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
            Outgoing Expenses & Debits
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Monitor bank outflows, direct debits, shared utility payments, and personal purchases.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenImportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => onOpenAddTransaction({ type: 'outgoing', category: 'Household Bills' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Outgoing</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Total Outflows
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalOutgoing, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            {outgoingTransactions.length} recorded payments
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Household Shared Bills
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-blue-700 tabular-nums">
            {formatCurrency(totalBillsOutgoing, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Split utilities & streaming
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            House Groceries
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalGroceries, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Shared kitchen & supplies
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Personal / Other
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalOther, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Non-household spending
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search outgoing payments by description or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs md:text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="cat-filter" className="text-xs text-neutral-600 font-medium">
            Category:
          </label>
          <select
            id="cat-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-neutral-300 rounded-md py-1.5 px-2.5 bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Description</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Account / Linked Bill</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-700">No outgoing transactions found</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Import statement CSV or record your outgoing payments.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const linkedBill = tx.linkedBillId ? bills.find((b) => b.id === tx.linkedBillId) : null;
                  const monthKey = tx.date.slice(0, 7);
                  const previousMonthKey = index > 0 ? filteredTransactions[index - 1].date.slice(0, 7) : '';
                  return (
                    <React.Fragment key={tx.id}>
                    {monthKey !== previousMonthKey && (
                      <tr className="bg-neutral-100">
                        <td colSpan={6} className="px-6 py-2 text-xs font-bold text-neutral-700">
                          {formatMonthLabel(monthKey)}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-neutral-50/70 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs text-neutral-600 font-mono">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-neutral-900">{tx.description}</div>
                        {tx.notes && (
                          <div className="text-xs text-neutral-500 mt-0.5 truncate max-w-md">
                            {tx.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-700">{tx.category}</span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {linkedBill ? (
                          <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                            <ReceiptText className="w-3.5 h-3.5" />
                            <span>{linkedBill.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-600">{tx.account}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-neutral-900">
                        -{formatCurrency(tx.amount, currencySymbol)}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
