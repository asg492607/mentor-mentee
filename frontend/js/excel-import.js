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
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    if (cols.some(cell => cell.length > 0)) {
      rows.push(cols);
    }
  }
  return rows;
}

export async function parseImportFile(file) {
  if (!file) return [];
  const fileName = (file.name || '').toLowerCase();
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

  try {
    const XLSX = await ensureXLSXLoaded();
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Filter out completely empty rows
    return rawRows.filter(row => {
      if (!Array.isArray(row) || row.length === 0) return false;
      return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });
  } catch (err) {
    console.warn('SheetJS parsing fallback trigger:', err);
    if (isExcel) {
      throw new Error('Unable to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    }
    const text = await file.text();
    return parseCSVString(text);
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
