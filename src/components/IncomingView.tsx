import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  Upload, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  UserCheck, 
  Calendar,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Member, Transaction } from '../types/budget';
import { formatCurrency, formatDate, formatMonthLabel } from '../utils/formatters';
import { getSampleBankCsv, triggerFileDownload } from '../utils/csv';

interface IncomingViewProps {
  transactions: Transaction[];
  members: Member[];
  currencySymbol: string;
  onOpenImportCsv: () => void;
  onOpenAddTransaction: (prefill?: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
}

export const IncomingView: React.FC<IncomingViewProps> = ({
  transactions,
  members,
  currencySymbol,
  onOpenImportCsv,
  onOpenAddTransaction,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'reimbursements' | 'salary' | 'other'>('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');

  // Filter incoming transactions
  const incomingTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'incoming');
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return incomingTransactions.filter((tx) => {
      // Search
      const matchesSearch = 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Type filter
      if (selectedFilter === 'reimbursements' && tx.category !== 'Household Reimbursement') return false;
      if (selectedFilter === 'salary' && tx.category !== 'Salary / Wage') return false;
      if (selectedFilter === 'other' && (tx.category === 'Household Reimbursement' || tx.category === 'Salary / Wage')) return false;

      // Member filter
      if (selectedMemberFilter !== 'all' && tx.fromMemberId !== selectedMemberFilter) return false;

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incomingTransactions, searchQuery, selectedFilter, selectedMemberFilter]);

  // Aggregate stats
  const totalIncoming = incomingTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalBankIncoming = incomingTransactions
    .filter((t) => t.paymentMethod !== 'cash')
    .reduce((sum, t) => sum + t.amount, 0);
  const cashTransactions = incomingTransactions.filter((t) => t.paymentMethod === 'cash');
  const totalCashIncoming = cashTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalReimbursements = incomingTransactions
    .filter((t) => t.category === 'Household Reimbursement')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSalary = incomingTransactions
    .filter((t) => t.category === 'Salary / Wage')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOther = totalIncoming - totalReimbursements - totalSalary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
            Incoming Money & Payments
          </h2>
          <p className="text-sm text-neutral-600 mt-0.5">
            Track bank deposits, cash payments, roommate split transfers, and salary deposits.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => triggerFileDownload(getSampleBankCsv(), 'sample_bank_statement.csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"
            title="Download test CSV format"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sample CSV</span>
          </button>

          <button
            onClick={onOpenImportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => onOpenAddTransaction({ type: 'incoming', category: 'Household Reimbursement' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Incoming</span>
          </button>
          <button
            onClick={() => onOpenAddTransaction({
              type: 'incoming',
              category: 'Household Reimbursement',
              paymentMethod: 'cash',
            })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Cash Payment</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Bank Inflows
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalBankIncoming, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Bank deposits only
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Cash Received
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
            {formatCurrency(totalCashIncoming, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            {cashTransactions.length} cash payments
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Roommate Split Transfers
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
            {formatCurrency(totalReimbursements, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Bank and cash payments for bills
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Salary & Wages
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalSalary, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Primary income
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-2xs">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider block">
            Freelance / Other
          </span>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {formatCurrency(totalOther, currencySymbol)}
          </div>
          <span className="text-xs text-neutral-600 mt-1 block">
            Transfers, refunds & gifts
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, payee, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-md shrink-0">
            {(['all', 'reimbursements', 'salary', 'other'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                  selectedFilter === tab
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab === 'all' ? 'All Inflows' : tab}
              </button>
            ))}
          </div>

          {/* Member dropdown filter */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="member-filter" className="text-xs text-neutral-600 font-medium">
              From:
            </label>
            <select
              id="member-filter"
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              className="text-xs border border-neutral-300 rounded-md py-1.5 px-2.5 bg-white text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="all">All Sources</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Description & Reference</th>
                <th className="px-6 py-3.5">Payment Method / Member</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    <FileSpreadsheet className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-700">No incoming transactions found</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchQuery || selectedFilter !== 'all' || selectedMemberFilter !== 'all'
                        ? 'Try clearing filters or search terms.'
                        : 'Import a bank CSV statement or manually record an incoming flow.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx, index) => {
                  const member = tx.fromMemberId ? members.find((m) => m.id === tx.fromMemberId) : null;
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
                        {member ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                              style={{ backgroundColor: member.avatarColor }}
                            >
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-neutral-900 block">{member.name}</span>
                              <span className="text-[11px] text-neutral-500 block">
                                {tx.paymentMethod === 'cash' ? 'Cash' : 'Bank transfer'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-600">
                            {tx.paymentMethod === 'cash' ? 'Cash' : tx.account || 'Direct Deposit'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className="text-xs text-neutral-700">{tx.category}</span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-emerald-700">
                        +{formatCurrency(tx.amount, currencySymbol)}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete transaction"
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
