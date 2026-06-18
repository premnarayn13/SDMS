import React, { useEffect, useMemo, useState } from 'react';
import {
  parseCsvText,
  detectHeaderRow,
  buildHeaders,
  detectColumnTypes,
  sortByColumn,
  filterByColumnValues,
  removeDuplicateRows,
  trimWhitespace,
  convertDelimiter,
  validateNumericColumns,
  toJsonText,
  toXlsxBlob,
  toPdfTableBlob
} from '../utils/csvTools';

const move = (arr, from, to) => {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export default function CsvWorkbench({ item, csvText, onCreateDerivedFile }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [delimiter, setDelimiter] = useState(',');
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  const [freezeColumns, setFreezeColumns] = useState(0);
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDirection, setSortDirection] = useState('asc');
  const [filters, setFilters] = useState({});
  const [types, setTypes] = useState([]);
  const [validationReport, setValidationReport] = useState([]);

  useEffect(() => {
    const { rows: parsed } = parseCsvText(csvText || '', delimiter);
    if (!parsed.length) {
      setRows([]);
      setHeaders([]);
      return;
    }
    const headerRowIndex = detectHeaderRow(parsed);
    const detectedHeaders = buildHeaders(parsed, headerRowIndex);
    const dataRows = headerRowIndex >= 0 ? parsed.slice(headerRowIndex + 1) : parsed;
    setHeaders(detectedHeaders);
    setRows(dataRows);
  }, [csvText, delimiter]);

  useEffect(() => {
    setTypes(detectColumnTypes(headers, rows));
  }, [headers, rows]);

  const visibleIndexes = useMemo(() => headers.map((_, idx) => idx).filter((idx) => !hiddenColumns.has(idx)), [headers, hiddenColumns]);
  const filteredRows = useMemo(() => filterByColumnValues(rows, filters), [rows, filters]);

  const updateCell = (rowIndex, colIndex, value) => {
    setRows((prev) => prev.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const copy = [...row];
      copy[colIndex] = value;
      return copy;
    }));
  };

  const addRow = () => setRows((prev) => [...prev, Array.from({ length: headers.length }, () => '')]);
  const removeRow = (rowIndex) => setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));

  const addColumn = () => {
    setHeaders((prev) => [...prev, `Column ${prev.length + 1}`]);
    setRows((prev) => prev.map((row) => [...row, '']));
  };

  const removeColumn = (colIndex) => {
    setHeaders((prev) => prev.filter((_, idx) => idx !== colIndex));
    setRows((prev) => prev.map((row) => row.filter((_, idx) => idx !== colIndex)));
    setHiddenColumns((prev) => {
      const next = new Set();
      [...prev].forEach((idx) => {
        if (idx < colIndex) next.add(idx);
        if (idx > colIndex) next.add(idx - 1);
      });
      return next;
    });
  };

  const renameColumn = (colIndex, name) => {
    setHeaders((prev) => prev.map((header, idx) => (idx === colIndex ? name : header)));
  };

  const reorderColumn = (from, to) => {
    if (to < 0 || to >= headers.length) return;
    setHeaders((prev) => move(prev, from, to));
    setRows((prev) => prev.map((row) => move(row, from, to)));
  };

  const applySort = () => setRows((prev) => sortByColumn(prev, Number(sortIndex), sortDirection));

  const detectTypesNow = () => setTypes(detectColumnTypes(headers, rows));
  const detectHeaderNow = () => {
    const merged = [headers, ...rows];
    const idx = detectHeaderRow(merged);
    if (idx === 0) return;
    const newHeaders = buildHeaders(merged, idx);
    setHeaders(newHeaders);
  };

  const convertAndSaveDelimiter = async (targetDelimiter) => {
    const content = convertDelimiter([headers, ...rows], targetDelimiter);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    await onCreateDerivedFile?.(`${(item?.name || 'table').replace(/\.csv$/i, '')}_${targetDelimiter === ';' ? 'semicolon' : 'comma'}.csv`, blob);
  };

  const exportJson = async () => {
    const json = toJsonText(headers, rows);
    const blob = new Blob([json], { type: 'application/json' });
    await onCreateDerivedFile?.(`${(item?.name || 'table').replace(/\.csv$/i, '')}.json`, blob);
  };

  const exportXlsx = async () => {
    const blob = await toXlsxBlob(headers, rows, 'CSV Export');
    await onCreateDerivedFile?.(`${(item?.name || 'table').replace(/\.csv$/i, '')}.xlsx`, blob);
  };

  const exportPdf = async () => {
    const blob = toPdfTableBlob(headers, rows, item?.name || 'CSV Table');
    await onCreateDerivedFile?.(`${(item?.name || 'table').replace(/\.csv$/i, '')}.pdf`, blob);
  };

  const runNumericValidation = () => {
    const numericIndexes = types.filter((entry) => entry.type === 'number').map((entry) => entry.index);
    setValidationReport(validateNumericColumns(headers, rows, numericIndexes));
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow p-3 space-y-2 text-xs">
        <h4 className="text-sm font-semibold text-slate-800">CSV Operations</h4>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={addRow} className="px-2 py-1 rounded bg-slate-100">Add Row</button>
          <button onClick={addColumn} className="px-2 py-1 rounded bg-slate-100">Add Column</button>
          <button onClick={() => setRows((prev) => removeDuplicateRows(prev))} className="px-2 py-1 rounded bg-slate-100">Remove Duplicates</button>
          <button onClick={() => setRows((prev) => trimWhitespace(prev))} className="px-2 py-1 rounded bg-slate-100">Trim Whitespace</button>
          <button onClick={detectTypesNow} className="px-2 py-1 rounded bg-slate-100">Detect Data Types</button>
          <button onClick={detectHeaderNow} className="px-2 py-1 rounded bg-slate-100">Detect Header Row</button>
          <button onClick={runNumericValidation} className="px-2 py-1 rounded bg-slate-100">Validate Numeric</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label>Sort col</label>
          <select value={sortIndex} onChange={(e) => setSortIndex(Number(e.target.value))} className="border rounded px-2 py-1">
            {headers.map((header, idx) => <option value={idx} key={header + idx}>{header}</option>)}
          </select>
          <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)} className="border rounded px-2 py-1">
            <option value="asc">ASC</option>
            <option value="desc">DESC</option>
          </select>
          <button onClick={applySort} className="px-2 py-1 rounded bg-blue-600 text-white">Apply Sort</button>

          <label className="ml-2">Freeze cols</label>
          <input type="number" min="0" max={headers.length} value={freezeColumns} onChange={(e) => setFreezeColumns(Number(e.target.value || 0))} className="w-16 border rounded px-2 py-1" />

          <label className="ml-2">Delimiter</label>
          <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="border rounded px-2 py-1">
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
            <option value="\t">Tab</option>
            <option value="|">Pipe</option>
          </select>
          <button onClick={() => convertAndSaveDelimiter(';')} className="px-2 py-1 rounded bg-slate-100">To ;</button>
          <button onClick={() => convertAndSaveDelimiter(',')} className="px-2 py-1 rounded bg-slate-100">To ,</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportJson} className="px-2 py-1 rounded bg-emerald-600 text-white">CSV to JSON</button>
          <button onClick={exportXlsx} className="px-2 py-1 rounded bg-emerald-600 text-white">CSV to XLSX</button>
          <button onClick={exportPdf} className="px-2 py-1 rounded bg-emerald-600 text-white">CSV to PDF Table</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 overflow-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr>
              {headers.map((header, colIdx) => {
                if (hiddenColumns.has(colIdx)) return null;
                return (
                  <th
                    key={`${header}-${colIdx}`}
                    className={`border px-2 py-1 text-left bg-slate-100 ${colIdx < freezeColumns ? 'sticky left-0 z-10' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <input value={header} onChange={(e) => renameColumn(colIdx, e.target.value)} className="w-full bg-white border rounded px-1 py-0.5" />
                      <button onClick={() => reorderColumn(colIdx, colIdx - 1)} title="Move left">◀</button>
                      <button onClick={() => reorderColumn(colIdx, colIdx + 1)} title="Move right">▶</button>
                      <button onClick={() => removeColumn(colIdx)} title="Remove col">✕</button>
                      <button onClick={() => setHiddenColumns((prev) => {
                        const next = new Set(prev);
                        next.add(colIdx);
                        return next;
                      })} title="Hide col">Hide</button>
                    </div>
                    <input
                      value={filters[colIdx] || ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [colIdx]: e.target.value }))}
                      placeholder="Filter"
                      className="mt-1 w-full bg-white border rounded px-1 py-0.5"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50">
                {row.map((cell, colIdx) => {
                  if (hiddenColumns.has(colIdx)) return null;
                  return (
                    <td key={`${rowIdx}-${colIdx}`} className={`border px-2 py-1 ${colIdx < freezeColumns ? 'sticky left-0 bg-white z-10' : ''}`}>
                      <input
                        value={cell ?? ''}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        className="w-full bg-transparent outline-none"
                      />
                    </td>
                  );
                })}
                <td className="border px-2 py-1">
                  <button onClick={() => removeRow(rowIdx)} className="text-rose-600">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hiddenColumns.size > 0 && (
          <div className="mt-3 text-xs">
            <span className="font-semibold text-slate-600">Hidden columns:</span>
            {Array.from(hiddenColumns).map((idx) => (
              <button
                key={idx}
                onClick={() => setHiddenColumns((prev) => {
                  const next = new Set(prev);
                  next.delete(idx);
                  return next;
                })}
                className="ml-2 px-2 py-1 rounded bg-slate-100"
              >
                Show {headers[idx] || `Column ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        {types.length > 0 && (
          <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
            <p className="font-semibold text-slate-700 mb-1">Detected types</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {types.map((entry) => (
                <p key={entry.header + entry.index}>{entry.header}: <span className="font-semibold">{entry.type}</span></p>
              ))}
            </div>
          </div>
        )}

        {validationReport.length > 0 && (
          <div className="mt-3 p-2 bg-slate-50 rounded text-xs">
            <p className="font-semibold text-slate-700 mb-1">Numeric validation</p>
            {validationReport.map((entry) => (
              <p key={entry.column}>{entry.column}: {entry.valid ? 'Valid' : `${entry.invalidRows} invalid row(s)`}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
