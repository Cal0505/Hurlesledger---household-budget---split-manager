export interface ParsedCsvRow {
  date: string;
  description: string;
  amount: number;
  type: 'incoming' | 'outgoing';
  category?: string;
  notes?: string;
  raw: Record<string, string>;
}

export interface CsvColumnMapping {
  dateCol: string;
  descriptionCol: string;
  amountCol: string;
  creditCol?: string; // Some banks have separate Credit and Debit columns
  debitCol?: string;
  typeCol?: string;
  categoryCol?: string;
}

/**
 * Robust CSV line splitter that respects quoted strings containing commas and escaped quotes.
 */
export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiterCounts = [',', '\t', ';'].map((delimiter) => {
    let count = 0;
    let insideQuotes = false;

    for (let i = 0; i < lines[0].length; i++) {
      const char = lines[0][i];
      if (char === '"') {
        if (insideQuotes && lines[0][i + 1] === '"') {
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        count++;
      }
    }

    return { delimiter, count };
  });
  const delimiter = delimiterCounts.reduce((best, candidate) =>
    candidate.count > best.count ? candidate : best
  ).delimiter;

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c !== ''));

  return { headers, rows };
}

/**
 * Intelligently auto-detects column mappings based on common bank CSV header names.
 */
export function detectColumnMapping(headers: string[]): CsvColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());

  const findHeader = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };

  const dateCol = findHeader(['date', 'transaction date', 'posted date', 'time']);
  const descriptionCol = findHeader(['description', 'narrative', 'payee', 'merchant', 'details', 'name', 'memo', 'reference']);
  const creditCol = findHeader(['credit', 'money in', 'inflow', 'received', 'paid in']);
  const debitCol = findHeader(['debit', 'money out', 'outflow', 'paid out']);
  const amountCol = creditCol && debitCol ? '' : findHeader(['amount', 'value', 'transaction amount', 'total']);
  const typeCol = findHeader(['transaction type', 'type']);
  const categoryCol = findHeader(['category', 'tag']);

  return {
    dateCol: dateCol || (headers[0] ?? ''),
    descriptionCol: descriptionCol || (headers[1] ?? ''),
    amountCol: amountCol || (!creditCol ? (headers[2] ?? '') : ''),
    creditCol,
    debitCol,
    typeCol,
    categoryCol,
  };
}

/**
 * Parses normalized date string to YYYY-MM-DD
 */
export function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const clean = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, '0');
    const month = ukMatch[2].padStart(2, '0');
    const year = ukMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback Date object
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Converts CSV rows into standardized ParsedCsvRow objects using the chosen mapping
 */
export function convertRowsToTransactions(
  headers: string[],
  rows: string[][],
  mapping: CsvColumnMapping,
  defaultType?: 'incoming' | 'outgoing'
): ParsedCsvRow[] {
  const dateIdx = headers.indexOf(mapping.dateCol);
  const descIdx = headers.indexOf(mapping.descriptionCol);
  const amountIdx = headers.indexOf(mapping.amountCol);
  const creditIdx = mapping.creditCol ? headers.indexOf(mapping.creditCol) : -1;
  const debitIdx = mapping.debitCol ? headers.indexOf(mapping.debitCol) : -1;
  const typeIdx = mapping.typeCol ? headers.indexOf(mapping.typeCol) : -1;
  const catIdx = mapping.categoryCol ? headers.indexOf(mapping.categoryCol) : -1;

  const results: ParsedCsvRow[] = [];

  for (const row of rows) {
    const rawRecord: Record<string, string> = {};
    headers.forEach((h, i) => {
      rawRecord[h] = row[i] ?? '';
    });

    const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
    const rawDesc = descIdx !== -1 ? row[descIdx] : 'Bank Transaction';

    let amount = 0;
    let type: 'incoming' | 'outgoing' = defaultType || 'incoming';

    if (creditIdx !== -1 || debitIdx !== -1) {
      const creditText = creditIdx !== -1 ? (row[creditIdx] || '').trim() : '';
      const debitText = debitIdx !== -1 ? (row[debitIdx] || '').trim() : '';
      const creditVal = parseFloat(creditText.replace(/[^0-9.-]/g, ''));
      const debitVal = parseFloat(debitText.replace(/[^0-9.-]/g, ''));

      if (creditText && !isNaN(creditVal) && creditVal > 0) {
        amount = creditVal;
        type = 'incoming';
      } else if (debitText && !isNaN(debitVal) && debitVal > 0) {
        amount = debitVal;
        type = 'outgoing';
      }
    } else if (amountIdx !== -1) {
      const cleanAmt = (row[amountIdx] || '0').replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleanAmt);
      if (!isNaN(num)) {
        if (num < 0) {
          amount = Math.abs(num);
          type = 'outgoing';
        } else {
          amount = num;
          type = defaultType || 'incoming';
        }

        const explicitType = typeIdx !== -1 ? (row[typeIdx] || '').trim().toLowerCase() : '';
        if (/^(debit|deb|dr|outgoing|withdrawal|withdraw)$/.test(explicitType)) {
          type = 'outgoing';
        } else if (/^(credit|cre|cr|incoming|deposit)$/.test(explicitType)) {
          type = 'incoming';
        }
      }
    }

    if (amount > 0) {
      results.push({
        date: normalizeDate(rawDate),
        description: rawDesc || 'Imported Entry',
        amount: Math.round(amount * 100) / 100,
        type,
        category: catIdx !== -1 && row[catIdx] ? row[catIdx] : undefined,
        raw: rawRecord,
      });
    }
  }

  return results;
}

/**
 * Generates sample CSV content ready for direct download and testing
 */
export function getSampleBankCsv(): string {
  return `Date,Description,Amount,Type,Notes
2026-10-01,Carl Monthly Salary Employer Ltd,2850.00,Credit,Monthly salary
2026-10-02,Chelsea House Bill Transfer,85.00,Credit,Internet & Energy share
2026-10-02,Ebony Transfer Bills,72.50,Credit,Household split October
2026-10-03,Lora Transfer House Account,72.50,Credit,October utilities
2026-10-03,Freelance Design Client,450.00,Credit,Weekend project
2026-10-01,Deezer Family Subscription,-14.99,Debit,Music split between 3
2026-10-01,Virgin Media Broadband,-48.00,Debit,Fiber internet 4-way split
2026-10-02,British Gas Direct Debit,-160.00,Debit,Gas & electricity bill
2026-10-03,Tesco Superstore Household,-64.80,Debit,Cleaning supplies & groceries`;
}

/**
 * Helper to download text as a file in the browser
 */
export function triggerFileDownload(content: string, filename: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
