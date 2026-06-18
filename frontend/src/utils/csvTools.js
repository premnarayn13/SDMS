import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

const isNumeric = (value) => {
  if (value === null || value === undefined || value === '') return false;
  return !Number.isNaN(Number(String(value).trim()));
};

export const parseCsvText = (content, delimiter = ',') => {
  const parsed = Papa.parse(content || '', {
    delimiter,
    skipEmptyLines: false
  });
  const rows = parsed.data || [];
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalized = rows.map((row) => {
    const copy = [...row];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });
  return { rows: normalized, errors: parsed.errors || [] };
};

export const detectHeaderRow = (rows) => {
  if (!rows?.length) return 0;
  const first = rows[0] || [];
  const score = first.reduce((acc, value) => acc + (isNumeric(value) ? 0 : 1), 0);
  return score >= Math.ceil(first.length / 2) ? 0 : -1;
};

export const buildHeaders = (rows, headerIndex = 0) => {
  if (!rows?.length) return [];
  if (headerIndex >= 0 && rows[headerIndex]) {
    return rows[headerIndex].map((value, idx) => String(value || `Column ${idx + 1}`));
  }
  const width = rows[0]?.length || 0;
  return Array.from({ length: width }, (_, idx) => `Column ${idx + 1}`);
};

export const detectColumnTypes = (headers, rows) => {
  const dataRows = rows || [];
  return headers.map((header, index) => {
    const values = dataRows.map((row) => row[index]).filter((value) => value !== '' && value !== null && value !== undefined);
    const numericCount = values.filter((value) => isNumeric(value)).length;
    const dateCount = values.filter((value) => !Number.isNaN(Date.parse(value))).length;

    let type = 'text';
    if (values.length > 0 && numericCount === values.length) type = 'number';
    else if (values.length > 0 && dateCount === values.length) type = 'date';

    return {
      header,
      index,
      type,
      sample: values[0] ?? ''
    };
  });
};

export const sortByColumn = (rows, columnIndex, direction = 'asc') => {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = a[columnIndex] ?? '';
    const bv = b[columnIndex] ?? '';

    if (isNumeric(av) && isNumeric(bv)) {
      return Number(av) - Number(bv);
    }

    return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
};

export const filterByColumnValues = (rows, filters = {}) => {
  const entries = Object.entries(filters).filter(([, value]) => String(value || '').trim().length > 0);
  if (!entries.length) return rows;

  return rows.filter((row) => entries.every(([index, value]) => {
    const cell = String(row[Number(index)] ?? '').toLowerCase();
    return cell.includes(String(value).toLowerCase());
  }));
};

export const removeDuplicateRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const trimWhitespace = (rows) => rows.map((row) => row.map((cell) => String(cell ?? '').trim()));

export const convertDelimiter = (rows, delimiter = ';') => Papa.unparse(rows, { delimiter });

export const validateNumericColumns = (headers, rows, numericColumnIndexes = []) => {
  const report = [];
  numericColumnIndexes.forEach((index) => {
    let invalid = 0;
    rows.forEach((row) => {
      const value = row[index];
      if (String(value ?? '').trim() !== '' && !isNumeric(value)) invalid += 1;
    });
    report.push({
      column: headers[index] || `Column ${index + 1}`,
      invalidRows: invalid,
      valid: invalid === 0
    });
  });
  return report;
};

export const toJsonText = (headers, rows) => {
  const json = rows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? '';
    });
    return obj;
  });
  return JSON.stringify(json, null, 2);
};

export const toXlsxBlob = async (headers, rows, sheetName = 'Sheet1') => {
  const XLSX = await import('xlsx');
  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([array], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
};

export const toPdfTableBlob = (headers, rows, title = 'CSV Table') => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const startX = 40;
  let y = 60;
  const lineHeight = 20;
  const maxColumns = Math.max(1, headers.length);
  const pageWidth = pdf.internal.pageSize.getWidth() - 80;
  const colWidth = pageWidth / maxColumns;

  pdf.setFontSize(14);
  pdf.text(title, startX, 30);

  pdf.setFontSize(10);
  headers.forEach((header, idx) => {
    pdf.text(String(header), startX + idx * colWidth, y);
  });

  y += lineHeight;
  rows.forEach((row) => {
    if (y > pdf.internal.pageSize.getHeight() - 30) {
      pdf.addPage();
      y = 30;
    }
    row.forEach((cell, idx) => {
      pdf.text(String(cell ?? ''), startX + idx * colWidth, y);
    });
    y += lineHeight;
  });

  return pdf.output('blob');
};
