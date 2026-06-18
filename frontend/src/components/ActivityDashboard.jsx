import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../utils/helpers';
import { megaSettingsApi } from '../utils/settingsApi';

const Icon = ({ name, size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    dangerouslySetInnerHTML={{ __html: Icons[name] || '' }}
  />
);

const MODULES = [
  {
    id: 'activity-overview',
    title: 'Activity Overview',
    icon: 'activity',
    tone: 'from-cyan-500 to-blue-600',
    subtitle: 'System-wide interaction pulse',
    highlights: ['Trend depth', 'Action mix', 'Live logs']
  },
  {
    id: 'ai-intelligence',
    title: 'AI Intelligence',
    icon: 'zap',
    tone: 'from-amber-500 to-orange-600',
    subtitle: 'AI efficiency and prompt behavior',
    highlights: ['Success rate', 'Prompt reuse', 'Latency']
  },
  {
    id: 'document-insights',
    title: 'Document Insights',
    icon: 'document',
    tone: 'from-indigo-500 to-blue-700',
    subtitle: 'Document lifecycle and engagement',
    highlights: ['Top documents', 'Edit intensity', 'Open frequency']
  },
  {
    id: 'time-productivity',
    title: 'Time & Productivity',
    icon: 'clock',
    tone: 'from-emerald-500 to-teal-600',
    subtitle: 'When users perform best',
    highlights: ['Peak hour', 'Session length', 'AI time saved']
  },
  {
    id: 'file-type-analytics',
    title: 'File Type Analytics',
    icon: 'layers',
    tone: 'from-violet-500 to-fuchsia-600',
    subtitle: 'Format-level intelligence',
    highlights: ['Format mix', 'Efficiency by type', 'Usage rank']
  },
  {
    id: 'automation-triggers',
    title: 'Automation & Triggers',
    icon: 'refresh',
    tone: 'from-sky-500 to-indigo-600',
    subtitle: 'Rules, triggers, and outcomes',
    highlights: ['Rule count', 'Trigger timeline', 'Success ratio']
  },
  {
    id: 'behavior-patterns',
    title: 'Behavior Patterns',
    icon: 'lineNumbers',
    tone: 'from-blue-500 to-cyan-600',
    subtitle: 'Recurring user behavior signatures',
    highlights: ['Clusters', 'Predictions', 'Workflow loops']
  },
  {
    id: 'leaderboard-rankings',
    title: 'Leaderboard & Rankings',
    icon: 'star',
    tone: 'from-yellow-500 to-amber-600',
    subtitle: 'Gamified productivity benchmarking',
    highlights: ['Streaks', 'Scorecards', 'Top days']
  },
  {
    id: 'alerts-anomalies',
    title: 'Alerts & Anomalies',
    icon: 'warning',
    tone: 'from-rose-500 to-red-600',
    subtitle: 'Risk and anomaly surveillance',
    highlights: ['Spike detection', 'Severity map', 'Status health']
  },
  {
    id: 'reports-export',
    title: 'Reports & Export',
    icon: 'export',
    tone: 'from-slate-500 to-slate-700',
    subtitle: 'Insights packaging and export',
    highlights: ['Scheduled output', 'PDF/CSV', 'History']
  }
];

const MODULE_PALETTES = {
  'activity-overview': { primary: '#0ea5e9', secondary: '#0284c7', soft: '#e0f2fe', dark: '#0c4a6e' },
  'ai-intelligence': { primary: '#f59e0b', secondary: '#ea580c', soft: '#fff7ed', dark: '#7c2d12' },
  'document-insights': { primary: '#6366f1', secondary: '#1d4ed8', soft: '#eef2ff', dark: '#312e81' },
  'time-productivity': { primary: '#10b981', secondary: '#0d9488', soft: '#ecfdf5', dark: '#064e3b' },
  'file-type-analytics': { primary: '#a855f7', secondary: '#d946ef', soft: '#faf5ff', dark: '#581c87' },
  'automation-triggers': { primary: '#3b82f6', secondary: '#2563eb', soft: '#eff6ff', dark: '#1e3a8a' },
  'behavior-patterns': { primary: '#06b6d4', secondary: '#0284c7', soft: '#ecfeff', dark: '#164e63' },
  'leaderboard-rankings': { primary: '#eab308', secondary: '#f59e0b', soft: '#fefce8', dark: '#713f12' },
  'alerts-anomalies': { primary: '#f43f5e', secondary: '#ef4444', soft: '#fff1f2', dark: '#881337' },
  'reports-export': { primary: '#64748b', secondary: '#334155', soft: '#f8fafc', dark: '#1e293b' }
};

const ACTION_COLORS = {
  upload: '#00b894',
  edit: '#0ea5e9',
  delete: '#ef4444',
  ai: '#f59e0b',
  alert: '#fb7185'
};

const fmtNum = (value) => Number(value || 0).toLocaleString();

const safeDate = (value) => {
  const dt = value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return new Date();
  return dt;
};

const matchesDateRange = (date, range) => {
  if (range === 'all') return true;
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (range === '7d') return diff <= 7;
  if (range === '30d') return diff <= 30;
  if (range === '90d') return diff <= 90;
  return true;
};

const fileFormat = (name = '') => {
  const ext = String(name).split('.').pop()?.toLowerCase();
  if (!ext || ext === name.toLowerCase()) return 'other';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'txt' || ext === 'md') return 'txt';
  return 'other';
};

const classifyAction = (action = '') => {
  const normalized = action.toLowerCase();
  if (/(upload|created|import)/.test(normalized)) return 'upload';
  if (/(delete|trash|removed)/.test(normalized)) return 'delete';
  if (/(edit|rename|update|annotat|mark)/.test(normalized)) return 'edit';
  if (/(ai|docky|summar|extract|classif|prompt|template|autom)/.test(normalized)) return 'ai';
  return 'manual';
};

const isAIAction = (action = '') => classifyAction(action) === 'ai';

const getModulePalette = (moduleId) => MODULE_PALETTES[moduleId] || MODULE_PALETTES['activity-overview'];

const Sparkline = ({ points, stroke = '#0ea5e9' }) => {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" className="h-8 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={path}
      />
    </svg>
  );
};

const MiniBars = ({ bars = [], color = '#0ea5e9' }) => {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex h-8 items-end gap-1">
      {bars.map((value, idx) => (
        <div
          key={idx}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(16, (value / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.3 + (value / max) * 0.7
          }}
        />
      ))}
    </div>
  );
};

const AreaChart = ({ points = [], stroke = '#0ea5e9', fill = 'rgba(14, 165, 233, 0.22)' }) => {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 48 - ((value - min) / range) * 42;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `0,48 ${coords} 100,48`;

  return (
    <svg viewBox="0 0 100 50" className="h-28 w-full">
      <polyline fill={fill} stroke="none" points={area} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
};

const RadarChart = ({ values = [], color = '#06b6d4' }) => {
  const size = 140;
  const center = size / 2;
  const radius = 52;
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(values.length, 1) - Math.PI / 2;
    const normalized = Math.min(Math.max(v, 0), 1);
    return {
      x: center + Math.cos(angle) * radius * normalized,
      y: center + Math.sin(angle) * radius * normalized
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size} className="mx-auto block">
      {[0.25, 0.5, 0.75, 1].map((step) => (
        <circle
          key={step}
          cx={center}
          cy={center}
          r={radius * step}
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeDasharray="3 3"
        />
      ))}
      <polygon points={polygon} fill="rgba(6,182,212,0.24)" stroke={color} strokeWidth="2" />
      {points.map((p, idx) => (
        <circle key={idx} cx={p.x} cy={p.y} r="2.5" fill={color} />
      ))}
    </svg>
  );
};

const TimelineBand = ({ points = [], color = '#3b82f6' }) => {
  const max = Math.max(...points, 1);
  return (
    <div className="relative h-12">
      <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200" />
      <div className="relative flex h-full items-center justify-between">
        {points.slice(0, 12).map((value, idx) => (
          <div
            key={idx}
            className="rounded-full border-2 border-white"
            style={{
              width: `${8 + Math.round((value / max) * 8)}px`,
              height: `${8 + Math.round((value / max) * 8)}px`,
              backgroundColor: color,
              opacity: 0.45 + (value / max) * 0.55
            }}
            title={`Bucket ${idx + 1}: ${value}`}
          />
        ))}
      </div>
    </div>
  );
};

const ProgressRing = ({ value = 0, color = '#0ea5e9' }) => {
  const pct = Math.max(0, Math.min(100, value));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="transparent" stroke="rgba(148,163,184,0.3)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{pct}%</div>
    </div>
  );
};

const LegendChip = ({ active, color, label, value, onClick }) => (
  <button
    onClick={onClick}
    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
  >
    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
    {label}
    <span className="ml-1.5 text-[11px] opacity-80">{value}</span>
  </button>
);

const HubGlyph = ({ metric = 0, bars = [], palette }) => {
  const ring = Math.max(14, Math.min(94, Math.round(metric)));
  const max = Math.max(...bars, 1);
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r="25" fill="transparent" stroke="rgba(255,255,255,0.32)" strokeWidth="7" />
          <circle
            cx="32"
            cy="32"
            r="25"
            fill="transparent"
            stroke={palette.primary}
            strokeWidth="7"
            strokeDasharray={`${ring * 1.57} 180`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-800">{ring}%</span>
      </div>
      <div className="space-y-1.5">
        {bars.slice(0, 4).map((value, idx) => (
          <div key={idx} className="h-2 overflow-hidden rounded-full bg-white/45">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(8, Math.round((value / max) * 100))}%`,
                backgroundColor: idx % 2 === 0 ? palette.primary : palette.secondary
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const Donut = ({ segments = [], centerLabel = '' }) => {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  let start = 0;

  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
        {segments.map((seg, idx) => {
          const pct = (seg.value / total) * 100;
          const dashArray = `${pct} ${100 - pct}`;
          const dashOffset = -start;
          start += pct;
          return (
            <circle
              key={idx}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={seg.color}
              strokeWidth="6"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
        <div>
          <div className="text-xl font-bold text-slate-800">{centerLabel}</div>
          <div className="text-xs text-slate-500">Distribution</div>
        </div>
      </div>
    </div>
  );
};

const Table = ({ columns, rows }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80">
    <div className="max-h-60 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-semibold">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={columns.length}>No data for current filters.</td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-slate-100 text-slate-700">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SectionCard = ({ title, subtitle, children, onExpand, legends = [], accent = '#0ea5e9' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-medium">
    <div className="mb-3 flex items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1">
        {onExpand && (
          <button
            onClick={onExpand}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Fullscreen
          </button>
        )}
      </div>
    </div>
    {legends.length > 0 && (
      <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 p-2">
        {legends.map((legend) => (
          <LegendChip
            key={`${legend.group}-${legend.value}`}
            active={legend.active}
            color={legend.color || accent}
            label={legend.label}
            value={legend.count}
            onClick={legend.onClick}
          />
        ))}
      </div>
    )}
    {children}
  </div>
);

const Badge = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-lg font-bold text-slate-800">{value}</div>
  </div>
);

export default function ActivityDashboard({ items = [], history = [], isOpen, onClose }) {
  const [expandedModule, setExpandedModule] = useState(null);
  const [loadingModule, setLoadingModule] = useState(null);
  const [lazyModules, setLazyModules] = useState({});
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [fullscreenPanel, setFullscreenPanel] = useState(null);
  const [liveTick, setLiveTick] = useState(Date.now());
  const [legendFilters, setLegendFilters] = useState({
    actions: ['upload', 'edit', 'delete', 'ai'],
    formats: ['pdf', 'docx', 'txt', 'other']
  });
  const [filters, setFilters] = useState({
    dateRange: '30d',
    fileType: 'all',
    actionType: 'all',
    actorMode: 'all',
    search: ''
  });
  const [megaInfo, setMegaInfo] = useState({
    connected: false,
    files: 0,
    usedBytes: 0,
    remainingBytes: 20 * 1024 * 1024 * 1024,
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(() => setLiveTick(Date.now()), 8000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setExpandedModule(null);
      setLoadingModule(null);
      setShowRawLogs(false);
      setFullscreenPanel(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    const loadMegaMeta = async () => {
      try {
        const status = await megaSettingsApi.getStatus();
        if (!status?.connected) {
          if (!cancelled) {
            setMegaInfo((prev) => ({ ...prev, connected: false, files: 0, usedBytes: 0, remainingBytes: prev.remainingBytes }));
          }
          return;
        }
        const filesRes = await megaSettingsApi.listFiles();
        const files = filesRes?.files || [];
        const used = files.reduce((sum, file) => sum + (Number(file?.size_bytes) || 0), 0);
        const total = 20 * 1024 * 1024 * 1024;
        if (!cancelled) {
          setMegaInfo({
            connected: true,
            files: files.length,
            usedBytes: used,
            remainingBytes: Math.max(0, total - used),
          });
        }
      } catch {
        if (!cancelled) {
          setMegaInfo((prev) => ({ ...prev, connected: false, files: 0, usedBytes: 0, remainingBytes: prev.remainingBytes }));
        }
      }
    };

    loadMegaMeta();
    return () => {
      cancelled = true;
    };
  }, [isOpen, liveTick]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (fullscreenPanel) {
        setFullscreenPanel(null);
        return;
      }
      if (expandedModule) {
        setExpandedModule(null);
        return;
      }
      onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedModule, fullscreenPanel, isOpen, onClose]);

  const baseEvents = useMemo(() => {
    const fromItemHistory = (items || []).flatMap((item) =>
      (item.history || []).map((entry, idx) => ({
        id: `${item.id}-${idx}-${entry.date || ''}`,
        fileId: item.id,
        fileName: item.name || 'Untitled',
        fileType: fileFormat(item.name || item.fileType || ''),
        action: entry.action || 'Updated',
        actor: entry.user || 'System',
        model: /gpt|docky|ai/i.test(entry.action || '') ? 'Docky AI' : 'Manual',
        ts: safeDate(entry.date || item.date),
        durationSec: 20 + ((idx + item.id.toString().length) % 160),
        promptType: /summar/i.test(entry.action || '')
          ? 'Summarize'
          : /extract/i.test(entry.action || '')
            ? 'Extract'
            : /classif/i.test(entry.action || '')
              ? 'Classify'
              : 'General'
      }))
    );

    const fromHistoryProp = (history || []).map((entry, idx) => ({
      id: `global-${idx}-${entry.date || ''}`,
      fileId: `global-${idx}`,
      fileName: entry.itemName || 'Workspace Activity',
      fileType: 'other',
      action: entry.action || 'Updated',
      actor: entry.user || 'System',
      model: /gpt|docky|ai/i.test(entry.action || '') ? 'Docky AI' : 'Manual',
      ts: safeDate(entry.date),
      durationSec: 20 + (idx % 180),
      promptType: /summar/i.test(entry.action || '') ? 'Summarize' : 'General'
    }));

    const merged = [...fromItemHistory, ...fromHistoryProp].sort((a, b) => b.ts - a.ts);

    if (merged.length > 0) return merged;

    const now = new Date();
    return Array.from({ length: 42 }).map((_, idx) => {
      const ts = new Date(now.getTime() - idx * 12 * 60 * 60 * 1000);
      const names = ['Policy.docx', 'Quarterly.pdf', 'Roadmap.txt', 'Budget.pdf', 'Brief.docx'];
      const actions = ['Uploaded file', 'Edited content', 'AI summarize', 'Classified document', 'Deleted draft'];
      const action = actions[idx % actions.length];
      return {
        id: `seed-${idx}`,
        fileId: `seed-file-${idx % 5}`,
        fileName: names[idx % names.length],
        fileType: fileFormat(names[idx % names.length]),
        action,
        actor: idx % 4 === 0 ? 'Docky AI' : 'Admin',
        model: idx % 4 === 0 ? 'Docky AI' : 'Manual',
        ts,
        durationSec: 35 + (idx % 120),
        promptType: idx % 4 === 0 ? ['Summarize', 'Extract', 'Classify'][idx % 3] : 'General'
      };
    });
  }, [items, history, liveTick]);

  const filteredEvents = useMemo(() => {
    return baseEvents.filter((event) => {
      const actionBucket = classifyAction(event.action);
      if (!matchesDateRange(event.ts, filters.dateRange)) return false;
      if (filters.fileType !== 'all' && event.fileType !== filters.fileType) return false;
      if (filters.actionType !== 'all' && actionBucket !== filters.actionType) return false;
      if (filters.actorMode === 'ai' && !isAIAction(event.action)) return false;
      if (filters.actorMode === 'manual' && isAIAction(event.action)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!`${event.fileName} ${event.action} ${event.actor}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [baseEvents, filters]);

  const visualEvents = useMemo(() => {
    return filteredEvents.filter((event) => {
      const actionKind = classifyAction(event.action);
      const actionAllowed = legendFilters.actions.includes(actionKind);
      const formatAllowed = legendFilters.formats.includes(event.fileType);
      return actionAllowed && formatAllowed;
    });
  }, [filteredEvents, legendFilters]);

  const stats = useMemo(() => {
    const now = new Date();
    const daily = Array.from({ length: 30 }).map((_, idx) => {
      const day = new Date(now.getTime() - (29 - idx) * 24 * 60 * 60 * 1000);
      const count = visualEvents.filter((e) => e.ts.toDateString() === day.toDateString()).length;
      return count;
    });

    const uploads = visualEvents.filter((e) => classifyAction(e.action) === 'upload').length;
    const edits = visualEvents.filter((e) => classifyAction(e.action) === 'edit').length;
    const deletions = visualEvents.filter((e) => classifyAction(e.action) === 'delete').length;
    const aiEvents = visualEvents.filter((e) => isAIAction(e.action)).length;

    const fileTypeTotals = visualEvents.reduce(
      (acc, event) => {
        acc[event.fileType] = (acc[event.fileType] || 0) + 1;
        return acc;
      },
      { pdf: 0, docx: 0, txt: 0, other: 0 }
    );

    const byHour = Array.from({ length: 24 }).map((_, hour) =>
      visualEvents.filter((e) => e.ts.getHours() === hour).length
    );
    const topHour = byHour.indexOf(Math.max(...byHour, 0));

    const filesMap = visualEvents.reduce((acc, event) => {
      const key = `${event.fileId}`;
      if (!acc[key]) {
        acc[key] = { name: event.fileName, edits: 0, opens: 0, actions: 0 };
      }
      acc[key].actions += 1;
      if (classifyAction(event.action) === 'edit') acc[key].edits += 1;
      if (/view|open/i.test(event.action)) acc[key].opens += 1;
      return acc;
    }, {});

    const filesList = Object.values(filesMap).sort((a, b) => b.actions - a.actions);

    const aiPromptDist = visualEvents.reduce(
      (acc, event) => {
        if (!isAIAction(event.action)) return acc;
        const key = event.promptType || 'General';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { Summarize: 0, Extract: 0, Classify: 0, General: 0 }
    );

    const successRate = visualEvents.length
      ? Math.round(((visualEvents.length - deletions) / visualEvents.length) * 100)
      : 100;

    const productiveWindow = `${String(topHour).padStart(2, '0')}:00-${String((topHour + 2) % 24).padStart(2, '0')}:00`;

    const averageSession = visualEvents.length
      ? Math.round(visualEvents.reduce((sum, e) => sum + e.durationSec, 0) / visualEvents.length)
      : 0;

    const aiHoursSaved = Math.max(0.5, (aiEvents * 2.5) / 60).toFixed(1);

    const alertSpikes = daily
      .map((value, idx) => ({ value, idx }))
      .filter(({ value }) => value > Math.max(4, Math.round(visualEvents.length / 18)))
      .slice(-5);

    return {
      total: visualEvents.length,
      daily,
      uploads,
      edits,
      deletions,
      aiEvents,
      manualEvents: visualEvents.length - aiEvents,
      fileTypeTotals,
      byHour,
      topHour,
      filesList,
      aiPromptDist,
      successRate,
      productiveWindow,
      averageSession,
      aiHoursSaved,
      alertSpikes
    };
  }, [visualEvents]);

  const moduleSummaries = useMemo(() => {
    const rankScore = (stats.edits * 2) + stats.uploads + stats.aiEvents;
    return {
      'activity-overview': {
        metric: `${fmtNum(stats.total)} events`,
        spark: stats.daily.slice(-14),
        bars: [stats.uploads, stats.edits, stats.deletions, stats.aiEvents]
      },
      'ai-intelligence': {
        metric: `${Math.round((stats.aiEvents / Math.max(stats.total, 1)) * 100)}% AI driven`,
        spark: stats.daily.map((d, i) => (i % 3 === 0 ? d + 1 : Math.max(0, d - 1))).slice(-14),
        bars: Object.values(stats.aiPromptDist)
      },
      'document-insights': {
        metric: `${fmtNum(stats.filesList.length)} active docs`,
        spark: stats.filesList.slice(0, 14).map((f) => f.actions || 0),
        bars: stats.filesList.slice(0, 4).map((f) => f.actions || 0)
      },
      'time-productivity': {
        metric: `${stats.productiveWindow}`,
        spark: stats.byHour.slice(8, 22),
        bars: stats.byHour.slice(9, 13)
      },
      'file-type-analytics': {
        metric: `${Object.entries(stats.fileTypeTotals).sort((a, b) => b[1] - a[1])[0]?.[0]?.toUpperCase() || 'N/A'} dominant`,
        spark: Object.values(stats.fileTypeTotals),
        bars: Object.values(stats.fileTypeTotals)
      },
      'automation-triggers': {
        metric: `${Math.max(2, Math.round(stats.aiEvents / 5))} active rules`,
        spark: stats.daily.map((v, i) => Math.max(0, Math.round(v * (i % 2 ? 0.8 : 1.1)))).slice(-14),
        bars: [Math.max(2, Math.round(stats.aiEvents / 5)), Math.round(stats.successRate), 100 - Math.round(stats.successRate)]
      },
      'behavior-patterns': {
        metric: `${stats.topHour}:00 peak habit`,
        spark: stats.byHour,
        bars: [stats.byHour[stats.topHour], stats.byHour[(stats.topHour + 1) % 24], stats.byHour[(stats.topHour + 2) % 24]]
      },
      'leaderboard-rankings': {
        metric: `${fmtNum(rankScore)} score`,
        spark: stats.daily.slice(-14).map((n, idx) => n + (idx % 2)),
        bars: [rankScore, Math.round(rankScore * 0.8), Math.round(rankScore * 0.7)]
      },
      'alerts-anomalies': {
        metric: `${stats.alertSpikes.length} flagged`,
        spark: stats.daily,
        bars: [stats.alertSpikes.length, Math.max(1, Math.round(stats.deletions / 2)), Math.max(1, Math.round(stats.uploads / 5))]
      },
      'reports-export': {
        metric: `${Math.max(1, Math.round(stats.total / 20))} reports ready`,
        spark: stats.daily.map((v, i) => Math.max(0, Math.round(v * (i % 5 === 0 ? 1.4 : 0.6)))).slice(-14),
        bars: [Math.max(1, Math.round(stats.total / 20)), Math.max(1, Math.round(stats.total / 25)), Math.max(1, Math.round(stats.total / 30))]
      }
    };
  }, [stats]);

  const moduleCards = useMemo(() => MODULES.map((module) => ({
    ...module,
    summary: moduleSummaries[module.id]
  })), [moduleSummaries]);

  const activeExpandedModule = useMemo(
    () => MODULES.find((module) => module.id === expandedModule),
    [expandedModule]
  );

  const recentRows = useMemo(() => {
    return visualEvents.slice(0, 15).map((event) => ({
      date: event.ts.toLocaleString(),
      action: event.action,
      file: event.fileName,
      actor: event.actor,
      model: event.model
    }));
  }, [visualEvents]);

  const openModule = (moduleId) => {
    if (lazyModules[moduleId]) {
      setExpandedModule(moduleId);
      return;
    }
    setLoadingModule(moduleId);
    setTimeout(() => {
      setLazyModules((prev) => ({ ...prev, [moduleId]: true }));
      setLoadingModule(null);
      setExpandedModule(moduleId);
    }, 420);
  };

  const openFullscreen = (panelId) => setFullscreenPanel(panelId);

  const toggleLegend = (group, value) => {
    setLegendFilters((prev) => {
      const current = prev[group] || [];
      const exists = current.includes(value);
      const next = exists ? current.filter((item) => item !== value) : [...current, value];
      return {
        ...prev,
        [group]: next.length === 0 ? current : next
      };
    });
  };

  const renderFullscreenPanel = () => {
    if (!fullscreenPanel) return null;

    if (fullscreenPanel === 'activity-trend') {
      return <AreaChart points={stats.daily} stroke="#0ea5e9" fill="rgba(56, 189, 248, 0.2)" />;
    }
    if (fullscreenPanel === 'activity-heatmap') {
      return (
        <div className="grid grid-cols-10 gap-1 md:grid-cols-15">
          {stats.daily.map((v, idx) => (
            <div
              key={idx}
              className="h-8 rounded"
              style={{ backgroundColor: `rgba(14, 165, 233, ${0.12 + Math.min(v / 8, 0.88)})` }}
            />
          ))}
        </div>
      );
    }
    if (fullscreenPanel === 'time-histogram') {
      return <MiniBars bars={visualEvents.slice(0, 36).map((event) => event.durationSec)} color="#10b981" />;
    }
    if (fullscreenPanel === 'behavior-radar') {
      const radarValues = [
        Math.min(1, stats.uploads / Math.max(stats.total, 1) + 0.25),
        Math.min(1, stats.edits / Math.max(stats.total, 1) + 0.25),
        Math.min(1, stats.aiEvents / Math.max(stats.total, 1) + 0.2),
        Math.min(1, stats.byHour[stats.topHour] / Math.max(...stats.byHour, 1)),
        Math.min(1, stats.successRate / 100),
        Math.min(1, stats.filesList.length / 10)
      ];
      return <RadarChart values={radarValues} color="#06b6d4" />;
    }
    if (fullscreenPanel === 'filetype-donut') {
      const segs = Object.entries(stats.fileTypeTotals).map(([label, value], idx) => ({
        label,
        value,
        color: ['#ef4444', '#2563eb', '#14b8a6', '#64748b'][idx % 4]
      }));
      return <Donut segments={segs} centerLabel={fmtNum(stats.total)} />;
    }

    return null;
  };

  if (!isOpen) return null;

  const topControlBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-soft lg:flex-nowrap">
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        value={filters.dateRange}
        onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
      >
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="all">All time</option>
      </select>
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        value={filters.fileType}
        onChange={(e) => setFilters((prev) => ({ ...prev, fileType: e.target.value }))}
      >
        <option value="all">All file types</option>
        <option value="pdf">PDF</option>
        <option value="docx">DOCX</option>
        <option value="txt">TXT</option>
        <option value="other">Others</option>
      </select>
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        value={filters.actionType}
        onChange={(e) => setFilters((prev) => ({ ...prev, actionType: e.target.value }))}
      >
        <option value="all">All actions</option>
        <option value="upload">Upload</option>
        <option value="edit">Edit</option>
        <option value="delete">Delete</option>
        <option value="ai">AI action</option>
      </select>
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        value={filters.actorMode}
        onChange={(e) => setFilters((prev) => ({ ...prev, actorMode: e.target.value }))}
      >
        <option value="all">AI + Manual</option>
        <option value="ai">Only AI</option>
        <option value="manual">Only Manual</option>
      </select>
      <input
        value={filters.search}
        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        className="h-10 w-32 rounded-xl border border-slate-200 px-3 text-sm md:w-44 lg:flex-1 lg:min-w-[180px]"
        placeholder="Search logs"
      />
      <div className="ml-1 mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</div>
      <LegendChip active={legendFilters.actions.includes('upload')} color={ACTION_COLORS.upload} label="Upload" value={stats.uploads} onClick={() => toggleLegend('actions', 'upload')} />
      <LegendChip active={legendFilters.actions.includes('edit')} color={ACTION_COLORS.edit} label="Edit" value={stats.edits} onClick={() => toggleLegend('actions', 'edit')} />
      <LegendChip active={legendFilters.actions.includes('delete')} color={ACTION_COLORS.delete} label="Delete" value={stats.deletions} onClick={() => toggleLegend('actions', 'delete')} />
      <LegendChip active={legendFilters.actions.includes('ai')} color={ACTION_COLORS.ai} label="AI" value={stats.aiEvents} onClick={() => toggleLegend('actions', 'ai')} />
      <div className="ml-2 mr-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Format</div>
      {['pdf', 'docx', 'txt', 'other'].map((fmt, idx) => (
        <LegendChip
          key={fmt}
          active={legendFilters.formats.includes(fmt)}
          color={['#ef4444', '#2563eb', '#14b8a6', '#64748b'][idx]}
          label={fmt.toUpperCase()}
          value={stats.fileTypeTotals[fmt] || 0}
          onClick={() => toggleLegend('formats', fmt)}
        />
      ))}
      <div className="ml-auto hidden items-center gap-2 lg:flex">
        <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
          Events: {fmtNum(stats.total)}
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
          AI Share: {Math.round((stats.aiEvents / Math.max(stats.total, 1)) * 100)}%
        </div>
        <button
          onClick={() => {
            setFilters({ dateRange: '30d', fileType: 'all', actionType: 'all', actorMode: 'all', search: '' });
            setLegendFilters({ actions: ['upload', 'edit', 'delete', 'ai'], formats: ['pdf', 'docx', 'txt', 'other'] });
          }}
          className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
        >
          Reset
        </button>
      </div>
    </div>
  );

  const renderModuleDetail = () => {
    const moduleId = expandedModule;

    if (!moduleId) return null;
    const activeModule = MODULES.find((m) => m.id === moduleId);
    const palette = getModulePalette(moduleId);

    const aiSplit = [
      { label: 'AI', value: stats.aiEvents, color: ACTION_COLORS.ai },
      { label: 'Manual', value: stats.manualEvents, color: '#334155' }
    ];

    const actionLegends = [
      {
        group: 'actions',
        value: 'upload',
        label: 'Upload',
        color: ACTION_COLORS.upload,
        count: stats.uploads,
        active: legendFilters.actions.includes('upload'),
        onClick: () => toggleLegend('actions', 'upload')
      },
      {
        group: 'actions',
        value: 'edit',
        label: 'Edit',
        color: ACTION_COLORS.edit,
        count: stats.edits,
        active: legendFilters.actions.includes('edit'),
        onClick: () => toggleLegend('actions', 'edit')
      },
      {
        group: 'actions',
        value: 'delete',
        label: 'Delete',
        color: ACTION_COLORS.delete,
        count: stats.deletions,
        active: legendFilters.actions.includes('delete'),
        onClick: () => toggleLegend('actions', 'delete')
      },
      {
        group: 'actions',
        value: 'ai',
        label: 'AI',
        color: ACTION_COLORS.ai,
        count: stats.aiEvents,
        active: legendFilters.actions.includes('ai'),
        onClick: () => toggleLegend('actions', 'ai')
      }
    ];

    const formatLegends = ['pdf', 'docx', 'txt', 'other'].map((fmt, idx) => ({
      group: 'formats',
      value: fmt,
      label: fmt.toUpperCase(),
      color: ['#ef4444', '#2563eb', '#14b8a6', '#64748b'][idx],
      count: stats.fileTypeTotals[fmt] || 0,
      active: legendFilters.formats.includes(fmt),
      onClick: () => toggleLegend('formats', fmt)
    }));

    if (moduleId === 'activity-overview') {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <SectionCard
            title="Daily / Weekly / Monthly Activity"
            subtitle="Toggle action legends to refine trend"
            legends={actionLegends}
            accent={palette.primary}
            onExpand={() => openFullscreen('activity-trend')}
          >
            <AreaChart points={stats.daily} stroke="#0ea5e9" fill="rgba(56, 189, 248, 0.2)" />
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Badge label="Daily Avg" value={Math.round(stats.total / 30)} />
              <Badge label="Weekly" value={stats.daily.slice(-7).reduce((s, v) => s + v, 0)} />
              <Badge label="Monthly" value={stats.total} />
            </div>
          </SectionCard>
          <SectionCard title="Uploads vs Edits vs Deletions" legends={actionLegends} accent={palette.primary}>
            <MiniBars bars={[stats.uploads, stats.edits, stats.deletions]} color={ACTION_COLORS.upload} />
            <div className="mt-3 text-xs text-slate-600">
              Uploads {stats.uploads} | Edits {stats.edits} | Deletes {stats.deletions}
            </div>
          </SectionCard>
          <SectionCard title="Calendar Heatmap" subtitle="Activity density by day" legends={actionLegends} accent={palette.primary} onExpand={() => openFullscreen('activity-heatmap')}>
            <div className="grid grid-cols-10 gap-1">
              {stats.daily.map((v, idx) => (
                <div
                  key={idx}
                  className="h-4 rounded"
                  style={{ backgroundColor: `rgba(14, 165, 233, ${0.12 + Math.min(v / 8, 0.88)})` }}
                />
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-600">Each square = one day</div>
          </SectionCard>
          <SectionCard title="Interactive Timeline View" subtitle="Fast trend scanning" legends={actionLegends} accent={palette.primary}>
            <TimelineBand points={stats.daily.slice(-12)} color="#2563eb" />
            <div className="mt-2 text-xs text-slate-600">Trend timeline for quick drill navigation</div>
          </SectionCard>
          <div className="lg:col-span-4">
            <SectionCard title="Recent Actions (Sortable Raw View)">
              <Table
                columns={[
                  { key: 'date', label: 'Date / Time' },
                  { key: 'action', label: 'Action' },
                  { key: 'file', label: 'File' },
                  { key: 'actor', label: 'Actor' }
                ]}
                rows={recentRows}
              />
            </SectionCard>
          </div>
        </div>
      );
    }

    if (moduleId === 'ai-intelligence') {
      const promptSegments = Object.entries(stats.aiPromptDist).map(([label, value], idx) => ({
        label,
        value,
        color: ['#f59e0b', '#fb923c', '#f97316', '#facc15'][idx % 4]
      }));

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard title="AI vs Manual Actions (Pie)" legends={actionLegends} accent={palette.primary}>
            <Donut segments={aiSplit} centerLabel={`${Math.round((stats.aiEvents / Math.max(stats.total, 1)) * 100)}%`} />
          </SectionCard>
            <SectionCard title="AI Task Distribution (Donut)" legends={actionLegends} accent={palette.primary}>
            <Donut segments={promptSegments} centerLabel={fmtNum(stats.aiEvents)} />
          </SectionCard>
          <SectionCard title="AI KPI Panel">
            <div className="grid gap-2">
              <Badge label="AI Success Rate" value={`${stats.successRate}%`} />
              <Badge label="Avg Response Time" value={`${Math.max(1.2, 8 - stats.aiEvents / 25).toFixed(1)}s`} />
              <Badge label="Top Prompt" value={Object.entries(stats.aiPromptDist).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">Prompt Reuse</button>
              <button className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-sm font-semibold text-white hover:from-cyan-700 hover:to-blue-700">Save Template</button>
            </div>
          </SectionCard>
          <div className="lg:col-span-3">
            <SectionCard title="AI Logs">
              <Table
                columns={[
                  { key: 'date', label: 'Time' },
                  { key: 'action', label: 'Prompt' },
                  { key: 'file', label: 'Output Target' },
                  { key: 'model', label: 'Model' }
                ]}
                rows={recentRows.filter((r) => /ai|docky|summar|classif|extract/i.test(r.action)).slice(0, 20)}
              />
            </SectionCard>
          </div>
        </div>
      );
    }

    if (moduleId === 'document-insights') {
      const topOpened = stats.filesList.slice(0, 6).map((f) => ({
        file: f.name,
        opens: f.opens,
        edits: f.edits,
        interactions: f.actions
      }));
      const most = stats.filesList[0];
      const least = stats.filesList[stats.filesList.length - 1];

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="File Interaction Frequency" legends={formatLegends} accent={palette.primary}>
            <MiniBars bars={stats.filesList.slice(0, 8).map((f) => f.actions)} color={ACTION_COLORS.edit} />
            <div className="mt-3 text-xs text-slate-600">Lifecycle trend: upload {'->'} edit {'->'} archive (derived from activity history)</div>
          </SectionCard>
          <SectionCard title="KPI">
            <div className="grid gap-2">
              <Badge label="Most Active Document" value={most?.name || 'N/A'} />
              <Badge label="Least Used Document" value={least?.name || 'N/A'} />
            </div>
          </SectionCard>
          <div className="lg:col-span-2">
            <SectionCard title="Most Opened / Most Edited Tables">
              <Table
                columns={[
                  { key: 'file', label: 'File' },
                  { key: 'opens', label: 'Opened' },
                  { key: 'edits', label: 'Edited' },
                  { key: 'interactions', label: 'Total' }
                ]}
                rows={topOpened}
              />
            </SectionCard>
          </div>
        </div>
      );
    }

    if (moduleId === 'time-productivity') {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="Active Hours Heatmap" legends={actionLegends} accent={palette.primary}>
            <div className="grid grid-cols-6 gap-1">
              {stats.byHour.map((v, idx) => (
                <div
                  key={idx}
                  className="h-5 rounded text-center text-[10px] leading-5 text-slate-700"
                  style={{ backgroundColor: `rgba(16, 185, 129, ${0.15 + Math.min(v / 10, 0.85)})` }}
                >
                  {idx}
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Session Duration Histogram" legends={actionLegends} accent={palette.primary} onExpand={() => openFullscreen('time-histogram')}>
            <MiniBars bars={visualEvents.slice(0, 20).map((event) => event.durationSec)} color="#10b981" />
            <div className="mt-3 text-xs text-slate-600">Average session: {stats.averageSession}s</div>
          </SectionCard>
          <SectionCard title="Daily Time Spent (Area)" legends={actionLegends} accent={palette.primary}>
            <AreaChart
              points={stats.daily.map((d, idx) => Math.max(0, Math.round((d * 6) + (idx % 4) * 3)))}
              stroke="#10b981"
              fill="rgba(16, 185, 129, 0.2)"
            />
            <div className="mt-2 text-xs text-slate-600">Estimated minutes per day</div>
          </SectionCard>
          <SectionCard title="AI Insight Panel">
            <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <div>You are most productive between {stats.productiveWindow}.</div>
              <div>AI saved you {stats.aiHoursSaved} hours this week.</div>
              <div>Most productive hour: {stats.topHour}:00.</div>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'file-type-analytics') {
      const segs = Object.entries(stats.fileTypeTotals).map(([label, value], idx) => ({
        label,
        value,
        color: ['#ef4444', '#2563eb', '#14b8a6', '#64748b'][idx % 4]
      }));

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="Format Distribution (Pie)" legends={formatLegends} accent={palette.primary} onExpand={() => openFullscreen('filetype-donut')}>
            <Donut segments={segs} centerLabel={fmtNum(stats.total)} />
          </SectionCard>
          <SectionCard title="Usage Frequency Per Format" legends={formatLegends} accent={palette.primary}>
            <MiniBars bars={Object.values(stats.fileTypeTotals)} color="#6366f1" />
            <div className="mt-3 text-xs text-slate-600">Most used format: {Object.entries(stats.fileTypeTotals).sort((a, b) => b[1] - a[1])[0]?.[0]?.toUpperCase()}</div>
          </SectionCard>
          <SectionCard title="Performance Metrics">
            <Table
              columns={[
                { key: 'type', label: 'Format' },
                { key: 'usage', label: 'Usage' },
                { key: 'avg_ai', label: 'AI Efficiency' }
              ]}
              rows={Object.entries(stats.fileTypeTotals).map(([type, usage]) => ({
                type: type.toUpperCase(),
                usage,
                avg_ai: `${Math.max(72, 95 - (type === 'other' ? 12 : 0))}%`
              }))}
            />
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'automation-triggers') {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Automation Rules Table">
            <Table
              columns={[
                { key: 'rule', label: 'Rule' },
                { key: 'trigger', label: 'Trigger' },
                { key: 'status', label: 'Status' }
              ]}
              rows={[
                { rule: 'Auto Summary', trigger: 'After Upload', status: 'Active' },
                { rule: 'Classification', trigger: 'On Edit', status: 'Active' },
                { rule: 'Alert Burst', trigger: 'Delete Spike', status: 'Monitoring' }
              ]}
            />
          </SectionCard>
          <SectionCard title="Triggered Timeline & Success vs Failure">
            <Sparkline points={stats.daily.map((v, idx) => Math.max(0, Math.round(v * (idx % 4 === 0 ? 1.5 : 0.7))))} stroke="#0ea5e9" />
            <MiniBars bars={[stats.successRate, 100 - stats.successRate]} color="#22c55e" />
            <div className="mt-2 text-xs text-slate-600">Active automations: {Math.max(2, Math.round(stats.aiEvents / 5))} | Success: {stats.successRate}%</div>
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'behavior-patterns') {
      const radarValues = [
        Math.min(1, stats.uploads / Math.max(stats.total, 1) + 0.25),
        Math.min(1, stats.edits / Math.max(stats.total, 1) + 0.25),
        Math.min(1, stats.aiEvents / Math.max(stats.total, 1) + 0.2),
        Math.min(1, stats.byHour[stats.topHour] / Math.max(...stats.byHour, 1)),
        Math.min(1, stats.successRate / 100),
        Math.min(1, stats.filesList.length / 10)
      ];

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="Recurring Usage Trends" legends={actionLegends} accent={palette.primary}>
            <AreaChart points={stats.byHour} stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.2)" />
            <div className="mt-2 text-xs text-slate-600">Cluster center around {stats.topHour}:00</div>
          </SectionCard>
          <SectionCard title="Workflow Radar Profile" legends={actionLegends} accent={palette.primary} onExpand={() => openFullscreen('behavior-radar')}>
            <RadarChart values={radarValues} color="#06b6d4" />
            <div className="mt-2 text-center text-xs text-slate-600">Upload, Edit, AI, Peak Hour, Success, Coverage</div>
          </SectionCard>
          <SectionCard title="Cluster Analysis">
            <Table
              columns={[
                { key: 'cluster', label: 'Cluster' },
                { key: 'pattern', label: 'Pattern' },
                { key: 'confidence', label: 'Confidence' }
              ]}
              rows={[
                { cluster: 'A', pattern: 'Upload -> AI Summarize -> Edit', confidence: '92%' },
                { cluster: 'B', pattern: 'Open -> Minor edits -> Share', confidence: '88%' },
                { cluster: 'C', pattern: 'Bulk upload on Mondays', confidence: '81%' }
              ]}
            />
          </SectionCard>
          <SectionCard title="Prediction Panel">
            <div className="space-y-3 rounded-xl bg-cyan-50 p-3 text-sm text-cyan-950">
              <div>Likely next action: AI summarize on recently uploaded files.</div>
              <div>Frequently repeated workflow: Upload {'->'} classify {'->'} share.</div>
              <div>Predicted peak usage tomorrow: {stats.topHour}:00.</div>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'leaderboard-rankings') {
      const dailyRanks = stats.daily
        .map((value, idx) => ({
          day: `D-${stats.daily.length - idx}`,
          value
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Top Activity Days & Sessions">
            <Table
              columns={[
                { key: 'rank', label: '#' },
                { key: 'day', label: 'Day' },
                { key: 'value', label: 'Actions' }
              ]}
              rows={dailyRanks.map((row, idx) => ({ rank: idx + 1, ...row }))}
            />
          </SectionCard>
          <SectionCard title="Scoreboard">
            <div className="grid gap-2">
              <Badge label="Daily Usage Streak" value={`${Math.max(3, Math.round(stats.total / 12))} days`} />
              <Badge label="Productivity Score" value={fmtNum((stats.edits * 3) + (stats.uploads * 2))} />
              <Badge label="Efficiency Score" value={`${Math.min(99, 55 + Math.round(stats.successRate / 2))}%`} />
            </div>
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'alerts-anomalies') {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Alert List">
            <Table
              columns={[
                { key: 'alert', label: 'Alert' },
                { key: 'severity', label: 'Severity' },
                { key: 'status', label: 'Status' }
              ]}
              rows={[
                { alert: 'Unusual spike in edits', severity: 'Medium', status: 'Investigating' },
                { alert: 'Large upload batch detected', severity: 'Low', status: 'Observed' },
                { alert: 'Deletion rate above baseline', severity: 'High', status: 'Action Needed' }
              ]}
            />
          </SectionCard>
          <SectionCard title="Anomaly Detection Graph">
            <Sparkline points={stats.daily.map((v, idx) => (idx % 6 === 0 ? v + 3 : v))} stroke={ACTION_COLORS.alert} />
            <div className="mt-3 flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Normal</span>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Warning</span>
              <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Critical</span>
            </div>
          </SectionCard>
        </div>
      );
    }

    if (moduleId === 'reports-export') {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Generate Reports">
            <div className="grid grid-cols-3 gap-2">
              <button className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-sm font-semibold text-white hover:from-cyan-700 hover:to-blue-700">Daily</button>
              <button className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white hover:from-indigo-600 hover:to-violet-700">Weekly</button>
              <button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700">Monthly</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Export PDF</button>
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Export CSV</button>
            </div>
          </SectionCard>
          <SectionCard title="Report History">
            <Table
              columns={[
                { key: 'name', label: 'Report' },
                { key: 'period', label: 'Period' },
                { key: 'export', label: 'Format' }
              ]}
              rows={[
                { name: 'Activity Summary', period: 'Weekly', export: 'PDF' },
                { name: 'AI Efficiency', period: 'Monthly', export: 'CSV' },
                { name: 'Document Lifecycle', period: 'Daily', export: 'PDF' }
              ]}
            />
          </SectionCard>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/55 backdrop-blur-sm">
      <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-100 shadow-strong">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.14),transparent_40%)]" />
        <div className="relative flex h-full flex-col p-4 md:p-5 lg:p-6">
          <div className="mb-3 rounded-2xl border border-white/70 bg-white/85 p-3 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">DocMatrix User Intelligence Command Center</h2>
              <p className="text-sm text-slate-600 lg:text-base">Summary hub with modular drill-down analytics. Heavy panels load only when opened.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="hidden rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 xl:block">
                Peak window: {stats.productiveWindow}
              </div>
              <div className="hidden rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 xl:block">
                Success: {stats.successRate}%
              </div>
              <div className={`hidden rounded-xl px-3 py-1 text-xs font-semibold xl:block ${megaInfo.connected ? 'border border-sky-100 bg-sky-50 text-sky-800' : 'border border-slate-200 bg-slate-100 text-slate-600'}`}>
                {megaInfo.connected
                  ? `MEGA ${megaInfo.files} files · ${fmtNum(Math.round(megaInfo.remainingBytes / (1024 * 1024 * 1024)))}GB free`
                  : 'MEGA not linked'}
              </div>
              {!!expandedModule && (
                <button
                  onClick={() => setExpandedModule(null)}
                  className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  Return to Hub
                </button>
              )}
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                Real-time feed
                <span className="ml-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <button
                onClick={onClose}
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-cyan-700 hover:to-blue-700"
              >
                Close
              </button>
              </div>
            </div>
            <div className="mt-2">{topControlBar}</div>
          </div>

          {!expandedModule && (
            <div className="mt-4 flex-1 overflow-auto rounded-2xl border border-white/70 bg-white/55 p-3 shadow-soft lg:p-4 animate-slide-up">
              <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {moduleCards.map((module) => (
                  <button
                    key={module.id}
                    onClick={() => openModule(module.id)}
                    className="group relative flex h-full min-h-[210px] flex-col justify-between overflow-hidden rounded-3xl border border-white/70 p-4 text-left shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-medium"
                    style={{
                      background: `linear-gradient(145deg, ${getModulePalette(module.id).soft} 0%, #ffffff 52%, ${getModulePalette(module.id).soft} 100%)`
                    }}
                  >
                    <div
                      className="absolute right-0 top-0 h-24 w-24 -translate-y-5 translate-x-5 rounded-full blur-2xl"
                      style={{ backgroundColor: `${getModulePalette(module.id).primary}44` }}
                    />
                    <div className="flex items-center justify-between">
                      <div className={`inline-flex rounded-xl bg-gradient-to-r p-2 text-white ${module.tone}`}>
                        <Icon name={module.icon} size={18} />
                      </div>
                      <span className="rounded-full border border-white/80 bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Open module</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{module.title}</h3>
                      <p className="text-xs font-medium text-slate-500">{module.subtitle}</p>
                      <p className="mt-1 text-[1.75rem] font-black leading-none text-slate-900">{module.summary?.metric || '0'}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {module.highlights.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              borderColor: `${getModulePalette(module.id).primary}55`,
                              color: getModulePalette(module.id).dark,
                              backgroundColor: `${getModulePalette(module.id).soft}`
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/70 bg-white/70 p-2">
                      <HubGlyph
                        metric={Math.round((module.summary?.spark || []).slice(-7).reduce((s, v) => s + v, 0) / 2)}
                        bars={module.summary?.bars?.length ? module.summary.bars : [1, 2, 1, 3]}
                        palette={getModulePalette(module.id)}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!expandedModule && (
            <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-soft lg:p-4 animate-scale-in">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => setExpandedModule(null)}
                  >
                    Back to modules
                  </button>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => setShowRawLogs((v) => !v)}
                  >
                    {showRawLogs ? 'Hide raw logs' : 'Show raw logs'}
                  </button>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {activeExpandedModule?.title}
                </div>
              </div>

              {loadingModule && (
                <div className="flex h-[74vh] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <div className="text-center text-slate-600">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    Loading analytics engine...
                  </div>
                </div>
              )}

              {!loadingModule && (
                <div className="h-[74vh] overflow-auto pr-1">
                  {renderModuleDetail()}
                  {showRawLogs && (
                    <div className="mt-4">
                      <SectionCard title="Raw Logs Drill-down">
                        <Table
                          columns={[
                            { key: 'date', label: 'Date' },
                            { key: 'action', label: 'Action' },
                            { key: 'file', label: 'File' },
                            { key: 'actor', label: 'Actor' },
                            { key: 'model', label: 'Mode' }
                          ]}
                          rows={recentRows}
                        />
                      </SectionCard>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!!fullscreenPanel && (
            <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4">
              <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-strong">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Chart Fullscreen View</h3>
                  <button
                    onClick={() => setFullscreenPanel(null)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {renderFullscreenPanel()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
