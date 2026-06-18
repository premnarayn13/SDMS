import { toPdfTableBlob } from './csvTools';

const normalizeRows = (rows) => {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => {
    const copy = [...row];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });
};

export const parseWorkbookBlob = async (blob) => {
  const XLSX = await import('xlsx');
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheets = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const normalized = normalizeRows(aoa || []);
    const headers = normalized[0]?.length
      ? normalized[0].map((value, idx) => String(value || `Column ${idx + 1}`))
      : ['Column 1'];
    const rows = normalized.length > 1
      ? normalized.slice(1)
      : [];

    return {
      name,
      headers,
      rows
    };
  });

  return sheets.length ? sheets : [{ name: 'Sheet1', headers: ['Column 1'], rows: [] }];
};

export const buildWorkbookBlob = async (sheets) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet, idx) => {
    const sheetName = String(sheet.name || `Sheet${idx + 1}`).slice(0, 31);
    const rows = [sheet.headers || [], ...(sheet.rows || [])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const array = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([array], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
};

export const detectColumnTypes = (headers, rows) => {
  const isNumber = (value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(String(value).trim()));

  return headers.map((header, colIdx) => {
    const values = (rows || []).map((row) => row[colIdx]).filter((value) => String(value ?? '').trim() !== '');
    const numberCount = values.filter((value) => isNumber(value)).length;
    const dateCount = values.filter((value) => !Number.isNaN(Date.parse(value))).length;
    const formulaCount = values.filter((value) => String(value).trim().startsWith('=')).length;

    let type = 'text';
    if (values.length && numberCount === values.length) type = 'number';
    else if (values.length && dateCount === values.length) type = 'date';
    if (formulaCount > 0) type = 'formula';

    return {
      header,
      index: colIdx,
      type,
      sample: values[0] ?? ''
    };
  });
};

export const exportSheetAsCsvBlob = async (headers, rows) => {
  const Papa = (await import('papaparse')).default;
  const csv = Papa.unparse([headers, ...rows]);
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
};

export const exportSheetAsJsonBlob = (headers, rows) => {
  const payload = rows.map((row) => {
    const out = {};
    headers.forEach((header, idx) => {
      out[header] = row[idx] ?? '';
    });
    return out;
  });
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
};

export const exportSheetAsPdfBlob = (sheetName, headers, rows) => {
  return toPdfTableBlob(headers, rows, sheetName || 'Excel Sheet');
};
