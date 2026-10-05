import React, { useState } from 'react';
import { Upload, X, AlertTriangle, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { Member, Transaction } from '../types/budget';
import { formatCurrency } from '../utils/formatters';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  currencySymbol: string;
  onImportTransactions: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

type ImportStep = 'select' | 'map' | 'preview';

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  members,
  currencySymbol,
  onImportTransactions,
}) => {
  const [step, setStep] = useState<ImportStep>('select');
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorLog, setErrorLog] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Column Mapping State Indices
  const [dateColumnIdx, setDateColumnIdx] = useState<number>(0);
  const [descColumnIdx, setDescColumnIdx] = useState<number>(1);
  const [debitColumnIdx, setDebitColumnIdx] = useState<number>(2);
  const [creditColumnIdx, setCreditColumnIdx] = useState<number>(3);

  const [previewTransactions, setPreviewTransactions] = useState<(Omit<Transaction, 'id' | 'createdAt'> & { selected: boolean })[]>([]);

  if (!isOpen) return null;

  const cleanCell = (str: string) => {
    if (!str) return '';
    return str.replace(/^["']|["']\$/g, '').trim();
  };

  // 🎯 FIXED DATE NORMALIZER: Converts UK format "30/09/2026" to database "2026-09-30" cleanly
  const convertToPostgresDate = (dateStr: string): string => {
    const cleanStr = cleanCell(dateStr);
    if (!cleanStr) return new Date().toISOString().split('T')[0];

    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      // Handle standard DD/MM/YYYY format by extracting day, month, and year correctly
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];

      // If the first token is 4 digits, it's already YYYY-MM-DD
      if (day.length === 4) {
        return `${day}-${month}-${year}`;
      }
      
      return `${year}-${month}-${day}`;
    }

    return cleanStr;
  };

  const splitCsvLine = (line: string) => {
    const result: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cleanCell(currentCell));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    result.push(cleanCell(currentCell));
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorLog('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text.trim()) {
        setErrorLog('The uploaded spreadsheet file appears to be completely empty.');
        setIsProcessing(false);
        return;
      }

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        setErrorLog('Insufficient rows found. Make sure your sheet contains a header row and data rows.');
        setIsProcessing(false);
        return;
      }

      const parsedHeaders = splitCsvLine(lines[0]);
      const parsedDataRows = lines.slice(1).map(line => splitCsvLine(line));

      setHeaders(parsedHeaders);
      setRawRows(parsedDataRows);
      
      const lowerHeaders = parsedHeaders.map(h => h.toLowerCase());
      const dIdx = lowerHeaders.findIndex(h => h.includes('date') || h.includes('time'));
      const deIdx = lowerHeaders.findIndex(h => h.includes('desc') || h.includes('name') || h.includes('detail') || h.includes('narrative'));
      const dbIdx = lowerHeaders.findIndex(h => h.includes('debit') || h.includes('out') || h.includes('paid out'));
      const crIdx = lowerHeaders.findIndex(h => h.includes('credit') || h.includes('in') || h.includes('paid in'));

      setDateColumnIdx(dIdx !== -1 ? dIdx : 0);
      setDescColumnIdx(deIdx !== -1 ? deIdx : 1);
      setDebitColumnIdx(dbIdx !== -1 ? dbIdx : 2);
      setCreditColumnIdx(crIdx !== -1 ? crIdx : 3);

      setStep('map');
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setErrorLog('Failed to process spreadsheet file configuration.');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleGeneratePreview = () => {
    setErrorLog('');
    if (dateColumnIdx === descColumnIdx || debitColumnIdx === creditColumnIdx) {
      setErrorLog('Validation Warning: Core mapping selectors must match unique spreadsheet columns.');
      return;
    }

    try {
      const compiledList = rawRows.map((row) => {
        const maxIdx = Math.max(dateColumnIdx, descColumnIdx, debitColumnIdx, creditColumnIdx);
        if (row.length <= maxIdx) return null;

        const rawDate = row[dateColumnIdx];
        const dateStr = convertToPostgresDate(rawDate);
        const descriptionStr = row[descColumnIdx] || 'Imported Transaction';
        
        const rawDebit = row[debitColumnIdx].replace(/[$\u00A3\u20AC,]/g, '').trim();
        const rawCredit = row[creditColumnIdx].replace(/[$\u00A3\u20AC,]/g, '').trim();

        const debitAmount = parseFloat(rawDebit);
        const creditAmount = parseFloat(rawCredit);

        let finalAmount = 0;
        let txType: 'incoming' | 'outgoing' = 'outgoing';

        if (!isNaN(debitAmount) && debitAmount > 0) {
          finalAmount = debitAmount;
          txType = 'outgoing';
        } else if (!isNaN(creditAmount) && creditAmount > 0) {
          finalAmount = creditAmount;
          txType = 'incoming';
        } else {
          return null; 
        }

        return {
          date: dateStr,
          description: descriptionStr,
          amount: finalAmount,
          type: txType,
          category: txType === 'outgoing' ? 'Other Expense' : 'Household Reimbursement',
          source: 'csv-import' as const,
          paymentMethod: 'bank' as const,
          account: 'main',
          selected: true
        };
      }).filter((t): t is NonNullable<typeof t> => t !== null);

      if (compiledList.length === 0) {
        throw new Error('No valid financial transactions detected. Ensure your Debit or Credit mapping indices match numbers.');
      }

      setPreviewTransactions(compiledList);
      setStep('preview');
    } catch (err) {
      setErrorLog(err instanceof Error ? err.message : 'Failed to generate review ledger structures.');
    }
  };
  const handleSubmitImport = () => {
    setIsProcessing(true);
    setErrorLog('');
    
    const finalSelection = previewTransactions.filter(t => t.selected).map(({ selected, ...rest }) => rest);
    
    if (finalSelection.length === 0) {
      setErrorLog('Please select at least one transaction to import.');
      setIsProcessing(false);
      return;
    }

    try {
      onImportTransactions(finalSelection);
      setSuccessCount(finalSelection.length);
      setTimeout(() => {
        onClose();
        setStep('select');
        setSuccessCount(null);
      }, 1500);
    } catch (err) {
      setErrorLog('Failed to persist ledger entries inside live database tables.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = previewTransactions.every(t => t.selected);
    setPreviewTransactions(previewTransactions.map(t => ({ ...t, selected: !allSelected })));
  };

  const toggleTransaction = (idx: number) => {
    setPreviewTransactions(previewTransactions.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal App Header */}
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-neutral-800">
            <Upload className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Split-Column Bank CSV Importer</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Flow Banner */}
        <div className="bg-neutral-100 px-5 py-2 border-b border-neutral-200 flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
          <span className={step === 'select' ? 'text-neutral-900 underline' : ''}>1. Select File</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === 'map' ? 'text-neutral-900 underline' : ''}>2. Map Columns</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === 'preview' ? 'text-neutral-900 underline' : ''}>3. Review Live Table</span>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {errorLog && (
            <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-normal">{errorLog}</p>
            </div>
          )}

          {successCount !== null && (
            <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-bold">Successfully imported {successCount} rows straight into Supabase!</p>
            </div>
          )}

          {/* STEP 1: Picker View */}
          {step === 'select' && (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 bg-neutral-50 text-center space-y-4">
              <div className="text-sm font-semibold text-neutral-700">Select Statement Spreadsheet</div>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">Upload your CSV statement to dynamically configure split Debit/Credit layout columns.</p>
              <div>
                <label htmlFor="comp-csv-picker" className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md shadow-2xs cursor-pointer transition-all">
                  Browse Statement Files
                </label>
                <input id="comp-csv-picker" type="file" accept=".csv, text/csv" className="sr-only" onChange={handleFileChange} />
              </div>
            </div>
          )}
          {/* STEP 2: Multi-Dropdown Mapper View */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <strong>Configuring 4-Column Array Mapping:</strong> Choose the match parameters for each ledger row below.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Transaction Date</label>
                  <select value={dateColumnIdx} onChange={(e) => setDateColumnIdx(Number(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-neutral-300 bg-white">
                    {headers.map((h, i) => <option key={i} value={i}>Col {i+1}: {h || `Column ${i+1}`}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Description / Note</label>
                  <select value={descColumnIdx} onChange={(e) => setDescColumnIdx(Number(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-neutral-300 bg-white">
                    {headers.map((h, i) => <option key={i} value={i}>Col {i+1}: {h || `Column ${i+1}`}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Debit (Money Out)</label>
                  <select value={debitColumnIdx} onChange={(e) => setDebitColumnIdx(Number(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-rose-300 bg-white">
                    {headers.map((h, i) => <option key={i} value={i}>Col {i+1}: {h || `Column ${i+1}`}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Credit (Money In)</label>
                  <select value={creditColumnIdx} onChange={(e) => setCreditColumnIdx(Number(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-emerald-300 bg-white">
                    {headers.map((h, i) => <option key={i} value={i}>Col {i+1}: {h || `Column ${i+1}`}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t flex justify-end gap-2">
                <button type="button" onClick={() => setStep('select')} className="px-3 py-1.5 text-xs border rounded-md">Back</button>
                <button type="button" onClick={handleGeneratePreview} className="px-4 py-1.5 text-xs font-bold text-white bg-neutral-900 rounded-md">Generate Table Preview</button>
              </div>
            </div>
          )}

          {/* STEP 3: Complete Table Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-600">{previewTransactions.filter(t=>t.selected).length} rows ready to save</span>
                <button type="button" onClick={toggleSelectAll} className="text-xs text-blue-600 font-bold hover:underline">Toggle Select All</button>
              </div>
              <div className="border border-neutral-200 rounded-lg overflow-x-auto max-h-[40vh] bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-2.5 w-8"></th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {previewTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-2.5 text-center">
                          <input type="checkbox" checked={tx.selected} onChange={() => toggleTransaction(idx)} className="rounded text-neutral-900 focus:ring-neutral-900" />
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-neutral-500 font-mono">{tx.date}</td>
                        <td className="p-2.5 font-medium text-neutral-800 truncate max-w-[220px]">{tx.description}</td>
                        <td className={`p-2.5 text-right font-mono font-bold ${tx.type === 'incoming' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-4 border-t flex justify-end gap-2">
                <button type="button" onClick={() => setStep('map')} className="px-3 py-1.5 text-xs border rounded-md" disabled={isProcessing}>Back</button>
                <button type="button" onClick={handleSubmitImport} className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-2xs" disabled={isProcessing}>
                  {isProcessing ? 'Saving to Database...' : 'Confirm & Save Transactions'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
