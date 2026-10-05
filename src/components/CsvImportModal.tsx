import React, { useState } from 'react';
import { Upload, X, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { Member, Transaction } from '../types/budget';
import { formatCurrency } from '../utils/formatters';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  currencySymbol: string;
  onImportTransactions: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

// 🌟 EXPORTED EXPLICITLY AS A NAMED COMPONENT CONSTANT (Matches App.tsx perfectly!)
export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  members,
  currencySymbol,
  onImportTransactions,
}) => {
  const [csvData, setCsvData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorLog, setErrorLog] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleProcessCsv = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorLog('');
    setSuccessCount(null);

    try {
      if (!csvData.trim()) {
        throw new Error('Please paste your bank CSV statement rows first.');
      }

      const rows = csvData.split('\n');
      const parsedTransactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];

      // CSV parser logic matching bank row array segments
      rows.forEach((row, index) => {
        const cleanRow = row.trim();
        if (!cleanRow || index === 0) return; // Skip headers or empty trailing slots safely

        const columns = cleanRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*\$)/);
        if (columns.length < 3) return;

        const dateStr = columns[0]?.replace(/"/g, '').trim() || new Date().toISOString().split('T')[0];
        const descriptionStr = columns[1]?.replace(/"/g, '').trim() || 'Imported Transaction';
        const rawAmount = parseFloat(columns[2]?.replace(/"/g, '').trim() || '0');

        if (isNaN(rawAmount) || rawAmount === 0) return;

        parsedTransactions.push({
          date: dateStr,
          description: descriptionStr,
          amount: Math.abs(rawAmount),
          type: rawAmount < 0 ? 'outgoing' : 'incoming',
          category: rawAmount < 0 ? 'Other Expense' : 'Household Reimbursement',
          source: 'csv-import',
          paymentMethod: 'bank', // 🎯 FIXED: Aligned with your strict type definition
          account: 'main'        // 🎯 FIXED: Declared required account property parameter
        });
      });

      if (parsedTransactions.length === 0) {
        throw new Error('No valid financial transactions detected. Verify column orders (Date, Description, Amount).');
      }

      onImportTransactions(parsedTransactions);
      setSuccessCount(parsedTransactions.length);
      setCsvData('');
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
      }, 1500);

    } catch (err) {
      setErrorLog(err instanceof Error ? err.message : 'Unable to parse provided statement text layout boundaries.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header Drawer Block */}
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-800">
            <Upload className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Import Bank CSV Statement</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content Area */}
        <form onSubmit={handleProcessCsv} className="p-5 space-y-4 flex-1 overflow-y-auto">
          <p className="text-xs text-neutral-600 leading-relaxed">
            Paste raw text segments directly from your exported online banking statement. Ensure ordering values align with: <code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-bold">Date, Description, Amount</code>.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="csv-paste-area" className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Raw Statement Text</label>
            <textarea
              id="csv-paste-area"
              rows={8}
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder={`"2026-10-01","E.ON Next Energy Utility Account",-120.00\n"2026-10-02","Roommate Reimbursement Split",45.50`}
              className="w-full font-mono text-xs p-3 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 shadow-inner"
            />
          </div>

          {/* Alert Status Feedback Elements */}
          {errorLog && (
            <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-normal">{errorLog}</p>
            </div>
          )}

          {successCount !== null && (
            <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex gap-2.5 text-xs text-emerald-800 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-bold leading-normal">Successfully added {successCount} unlinked rows into active statements window ledger!</p>
            </div>
          )}

          {/* Bottom Control Drawer Bar */}
          <div className="pt-2 border-t border-neutral-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !csvData.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-2xs disabled:opacity-50 disabled:bg-neutral-400 flex items-center gap-1.5"
            >
              {isProcessing ? 'Processing…' : <><span>Process Import</span><FileText className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
