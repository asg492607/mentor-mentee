/**
 * Utility module for parsing Excel (.xlsx, .xls) and CSV files into 2D row matrices,
 * and filtering out empty or whitespace-only rows.
 */

export async function ensureXLSXLoaded() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS library. Please check your network connection.'));
    document.head.appendChild(script);
  });
}

export function parseCSVString(text) {
  const rows = [];
  let cells = [];
  let value = '';
  let quoted = false;
  const finishCell = () => { cells.push(value.trim()); value = ''; };
  const finishRow = () => {
    finishCell();
    if (cells.some(cell => cell.length > 0)) rows.push(cells);
    cells = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === ',') {
      finishCell();
    } else if (!quoted && (char === '\n' || char === '\r')) {
      finishRow();
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('CSV file has an unclosed quoted field. Check the row formatting and try again.');
  if (value.length || cells.length) finishRow();
  return rows;
}

export function normalizeImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  if (!text) return '';
  let year;
  let month;
  let day;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (match) [, day, month, year] = match;
    else {
      const serial = Number(text);
      if (!Number.isInteger(serial) || serial < 20000 || serial > 80000) return '';
      const parsed = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
    }
  }
  year = Number(year);
  month = Number(month);
  day = Number(day);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function parseImportFile(file) {
  if (!file) return [];
  const fileName = (file.name || '').toLowerCase();
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
  if (!isExcel) {
    if (!fileName.endsWith('.csv')) throw new Error('Choose a CSV or Excel file (.csv, .xlsx, .xls).');
    return parseCSVString(await file.text());
  }

  try {
    const XLSX = await ensureXLSXLoaded();
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

    // Filter out completely empty rows
    return rawRows.filter(row => {
      if (!Array.isArray(row) || row.length === 0) return false;
      return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });
  } catch (err) {
    console.warn('SheetJS parsing fallback trigger:', err);
    throw new Error('Unable to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
  }
}

export function isRowObjectEmpty(rowData) {
  if (!rowData || typeof rowData !== 'object') return true;
  const keysToCheck = Object.keys(rowData).filter(k => k !== 'sr');
  const hasValue = keysToCheck.some(k => {
    const val = rowData[k];
    return val !== null && val !== undefined && String(val).trim() !== '';
  });
  return !hasValue;
}
