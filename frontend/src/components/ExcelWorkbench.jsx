import React, { useEffect, useMemo, useState } from 'react';
import {
  parseWorkbookBlob,
  buildWorkbookBlob,
  detectColumnTypes,
  exportSheetAsCsvBlob,
  exportSheetAsJsonBlob,
  exportSheetAsPdfBlob
} from '../utils/excelTools';

const move = (arr, from, to) => {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export default function ExcelWorkbench({ item, sourceBlob, onCreateDerivedFile }) {
  const [sheets, setSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [filters, setFilters] = useState({});
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDirection, setSortDirection] = useState('asc');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadWorkbook = async () => {
      if (!sourceBlob) return;
      setStatus('Loading workbook...');
      setError('');
      try {
        const parsed = await parseWorkbookBlob(sourceBlob);
        if (cancelled) return;
        setSheets(parsed);
        setActiveSheetIndex(0);
        setStatus(`Loaded ${parsed.length} sheet(s)`);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Failed to parse workbook');
        setStatus('');
      }
    };

    loadWorkbook();

    return () => {
      cancelled = true;
    };
  }, [sourceBlob]);

  const activeSheet = sheets[activeSheetIndex] || { name: 'Sheet1', headers: [], rows: [] };

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => String(v || '').trim());
    if (!activeFilters.length) return activeSheet.rows;
    return activeSheet.rows.filter((row) => activeFilters.every(([idx, filterValue]) => {
      const cell = String(row[Number(idx)] ?? '').toLowerCase();
      return cell.includes(String(filterValue).toLowerCase());
    }));
  }, [activeSheet.rows, filters]);

  const detectedTypes = useMemo(() => detectColumnTypes(activeSheet.headers, activeSheet.rows), [activeSheet.headers, activeSheet.rows]);

  const updateSheet = (updater) => {
    setSheets((prev) => prev.map((sheet, idx) => (idx === activeSheetIndex ? updater(sheet) : sheet)));
  };

  const renameSheet = (name) => {
    updateSheet((sheet) => ({ ...sheet, name }));
  };

  const addSheet = () => {
    setSheets((prev) => [...prev, { name: `Sheet${prev.length + 1}`, headers: ['Column 1'], rows: [] }]);
    setActiveSheetIndex(sheets.length);
  };

  const removeSheet = (idx) => {
    if (sheets.length <= 1) return;
    setSheets((prev) => prev.filter((_, i) => i !== idx));
    setActiveSheetIndex((prev) => Math.max(0, Math.min(prev, sheets.length - 2)));
  };

  const updateCell = (rowIndex, colIndex, value) => {
    updateSheet((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row, rIdx) => {
        if (rIdx !== rowIndex) return row;
        const copy = [...row];
        copy[colIndex] = value;
        return copy;
      })
    }));
  };

  const addRow = () => {
    updateSheet((sheet) => ({
      ...sheet,
      rows: [...sheet.rows, Array.from({ length: sheet.headers.length }, () => '')]
    }));
  };

  const removeRow = (rowIndex) => {
    updateSheet((sheet) => ({
      ...sheet,
      rows: sheet.rows.filter((_, idx) => idx !== rowIndex)
    }));
  };

  const addColumn = () => {
    updateSheet((sheet) => ({
      ...sheet,
      headers: [...sheet.headers, `Column ${sheet.headers.length + 1}`],
      rows: sheet.rows.map((row) => [...row, ''])
    }));
  };

  const removeColumn = (colIndex) => {
    updateSheet((sheet) => ({
      ...sheet,
      headers: sheet.headers.filter((_, idx) => idx !== colIndex),
      rows: sheet.rows.map((row) => row.filter((_, idx) => idx !== colIndex))
    }));
  };

  const renameColumn = (colIndex, value) => {
    updateSheet((sheet) => ({
      ...sheet,
      headers: sheet.headers.map((header, idx) => (idx === colIndex ? value : header))
    }));
  };

  const reorderColumn = (from, to) => {
    if (to < 0 || to >= activeSheet.headers.length) return;
    updateSheet((sheet) => ({
      ...sheet,
      headers: move(sheet.headers, from, to),
      rows: sheet.rows.map((row) => move(row, from, to))
    }));
  };

  const sortByColumn = () => {
    const idx = Number(sortIndex);
    updateSheet((sheet) => {
      const sorted = [...sheet.rows].sort((a, b) => {
        const av = a[idx] ?? '';
        const bv = b[idx] ?? '';
        const avNum = Number(av);
        const bvNum = Number(bv);
        const bothNumeric = !Number.isNaN(avNum) && !Number.isNaN(bvNum) && String(av).trim() !== '' && String(bv).trim() !== '';
        if (bothNumeric) return avNum - bvNum;
        return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
      });
      return {
        ...sheet,
        rows: sortDirection === 'desc' ? sorted.reverse() : sorted
      };
    });
  };

  const saveWorkbook = async () => {
    try {
      setStatus('Saving workbook...');
      setError('');
      const blob = await buildWorkbookBlob(sheets);
      const baseName = (item?.name || 'workbook').replace(/\.(xls|xlsx)$/i, '');
      await onCreateDerivedFile?.(`${baseName}_edited.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setStatus('Workbook saved as copy');
    } catch (err) {
      setError(err?.message || 'Failed to save workbook');
      setStatus('');
    }
  };

  const exportActiveSheetCsv = async () => {
    const blob = await exportSheetAsCsvBlob(activeSheet.headers, activeSheet.rows);
    await onCreateDerivedFile?.(`${activeSheet.name || 'sheet'}.csv`, blob, 'text/csv;charset=utf-8');
  };

  const exportActiveSheetJson = async () => {
    const blob = exportSheetAsJsonBlob(activeSheet.headers, activeSheet.rows);
    await onCreateDerivedFile?.(`${activeSheet.name || 'sheet'}.json`, blob, 'application/json;charset=utf-8');
  };

  const exportActiveSheetPdf = async () => {
    const blob = exportSheetAsPdfBlob(activeSheet.name, activeSheet.headers, activeSheet.rows);
    await onCreateDerivedFile?.(`${activeSheet.name || 'sheet'}.pdf`, blob, 'application/pdf');
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">Excel Operations</h4>
          {status && <span className="text-emerald-700">{status}</span>}
          {error && <span className="text-rose-700">{error}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sheets.map((sheet, idx) => (
            <button
              key={`${sheet.name}-${idx}`}
              onClick={() => setActiveSheetIndex(idx)}
              className={`px-2 py-1 rounded ${idx === activeSheetIndex ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}
            >
              {sheet.name || `Sheet ${idx + 1}`}
            </button>
          ))}
          <button onClick={addSheet} className="px-2 py-1 rounded bg-slate-100">+ Sheet</button>
          <button onClick={() => removeSheet(activeSheetIndex)} className="px-2 py-1 rounded bg-rose-100 text-rose-700" disabled={sheets.length <= 1}>Remove Sheet</button>
          <input
            value={activeSheet.name || ''}
            onChange={(e) => renameSheet(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="Sheet name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addRow} className="px-2 py-1 rounded bg-slate-100">Add Row</button>
          <button onClick={addColumn} className="px-2 py-1 rounded bg-slate-100">Add Column</button>
          <button onClick={saveWorkbook} className="px-2 py-1 rounded bg-emerald-600 text-white">Save Workbook Copy</button>
          <button onClick={exportActiveSheetCsv} className="px-2 py-1 rounded bg-slate-100">Sheet to CSV</button>
          <button onClick={exportActiveSheetJson} className="px-2 py-1 rounded bg-slate-100">Sheet to JSON</button>
          <button onClick={exportActiveSheetPdf} className="px-2 py-1 rounded bg-slate-100">Sheet to PDF</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label>Sort col</label>
          <select value={sortIndex} onChange={(e) => setSortIndex(Number(e.target.value))} className="border rounded px-2 py-1">
            {activeSheet.headers.map((header, idx) => (
              <option value={idx} key={`${header}-${idx}`}>{header}</option>
            ))}
          </select>
          <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)} className="border rounded px-2 py-1">
            <option value="asc">ASC</option>
            <option value="desc">DESC</option>
          </select>
          <button onClick={sortByColumn} className="px-2 py-1 rounded bg-blue-600 text-white">Apply Sort</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 overflow-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr>
              {activeSheet.headers.map((header, colIdx) => (
                <th key={`${header}-${colIdx}`} className="border px-2 py-1 text-left bg-slate-100">
                  <div className="flex items-center gap-1">
                    <input
                      value={header}
                      onChange={(e) => renameColumn(colIdx, e.target.value)}
                      className="w-full bg-white border rounded px-1 py-0.5"
                    />
                    <button onClick={() => reorderColumn(colIdx, colIdx - 1)} title="Move left">◀</button>
                    <button onClick={() => reorderColumn(colIdx, colIdx + 1)} title="Move right">▶</button>
                    <button onClick={() => removeColumn(colIdx)} title="Remove col">✕</button>
                  </div>
                  <input
                    value={filters[colIdx] || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [colIdx]: e.target.value }))}
                    placeholder="Filter"
                    className="mt-1 w-full bg-white border rounded px-1 py-0.5"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50">
                {activeSheet.headers.map((_, colIdx) => (
                  <td key={`${rowIdx}-${colIdx}`} className="border px-2 py-1">
                    <input
                      value={row[colIdx] ?? ''}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      className="w-full bg-transparent outline-none"
                    />
                  </td>
                ))}
                <td className="border px-2 py-1">
                  <button onClick={() => removeRow(rowIdx)} className="text-rose-600">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {detectedTypes.length > 0 && (
          <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
            <p className="font-semibold text-slate-700 mb-1">Detected types</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {detectedTypes.map((entry) => (
                <p key={`${entry.header}-${entry.index}`}>
                  {entry.header}: <span className="font-semibold">{entry.type}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
