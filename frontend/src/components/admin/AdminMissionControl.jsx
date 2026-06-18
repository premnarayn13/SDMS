import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './AdminMissionControl.css';
import { clearAdminSession } from './adminAuth';

const CARD_CONFIG = [
  { key: 'users', title: 'User Analytics', description: 'Growth, DAU/WAU/MAU, cohorts, churn, segmentation', previewBadges: ['DAU/WAU/MAU', 'Retention', 'Cohorts'] },
  { key: 'files', title: 'File System Analytics', description: 'File growth, storage by type, duplicate and compression trends', previewBadges: ['File Mix', 'Storage', 'Duplicates'] },
  { key: 'traffic', title: 'System Traffic & Performance', description: 'RPS, latency, active sessions, endpoint-level behavior', previewBadges: ['RPS', 'Latency', 'Errors'] },
  { key: 'ai', title: 'AI Processing Analytics', description: 'OCR/summarization throughput, queue health, model quality', previewBadges: ['OCR', 'Queue', 'Accuracy'] },
  { key: 'activity', title: 'Activity Timeline & Calendar', description: 'Daily density, action timeline, replay-ready activity streams', previewBadges: ['Calendar', 'Timeline', 'Replay'] },
  { key: 'leaderboard', title: 'Leaderboard & Ranking', description: 'Top users by activity, storage and AI workload intensity', previewBadges: ['Ranks', 'Badges', 'Engagement'] },
  { key: 'security', title: 'Security & Audit Logs', description: 'Auth anomalies, suspicious devices, risk scoring and tracking', previewBadges: ['Risk', 'IP', 'Devices'] },
  { key: 'billing', title: 'Usage & Billing Analytics', description: 'Revenue momentum, plan mix, conversions, LTV and churn impact', previewBadges: ['Revenue', 'Plan Mix', 'LTV'] },
];

const baseUsers = [
  { user: 'Acme Labs', storage: 920, activity: 99, ai: 470, plan: 'Enterprise' },
  { user: 'DataNova', storage: 810, activity: 95, ai: 420, plan: 'Enterprise' },
  { user: 'Lucid Metrics', storage: 630, activity: 89, ai: 350, plan: 'Premium' },
  { user: 'Skyline Ops', storage: 555, activity: 87, ai: 289, plan: 'Premium' },
  { user: 'OrbitOne', storage: 430, activity: 82, ai: 245, plan: 'Business' },
  { user: 'HelixByte', storage: 386, activity: 77, ai: 230, plan: 'Business' },
  { user: 'Flow Junction', storage: 301, activity: 73, ai: 184, plan: 'Free' },
];

const presetDays = {
  'last-24h': 1,
  'last-7-days': 7,
  'last-30-days': 30,
  'last-90-days': 90,
  custom: 30,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function chartTheme() {
  return {
    textStyle: { color: '#2a4d69', fontFamily: 'Space Grotesk, sans-serif' },
    grid: { left: 36, right: 20, top: 24, bottom: 30, containLabel: true },
    xAxis: {
      axisLine: { lineStyle: { color: 'rgba(103,157,192,0.35)' } },
      axisLabel: { color: '#5b83a4', fontSize: 10 },
    },
    yAxis: {
      axisLine: { lineStyle: { color: 'rgba(103,157,192,0.35)' } },
      splitLine: { lineStyle: { color: 'rgba(103,157,192,0.2)', type: 'dashed' } },
      axisLabel: { color: '#5b83a4', fontSize: 10 },
    },
  };
}

function makeTimeline(days, segment, fileType, region, factorQuery) {
  const today = new Date();
  const segmentMult = { all: 1, free: 0.74, premium: 1.08, enterprise: 1.22 }[segment] || 1;
  const fileTypeMult = { all: 1, pdf: 1.12, docx: 1.04, txt: 0.86, images: 1.18 }[fileType] || 1;
  const regionMult = { global: 1, apac: 1.06, emea: 0.97, amer: 1.11 }[region] || 1;

  const q = String(factorQuery || '').toLowerCase().trim();
  let factorMult = 1;
  if (q.includes('traffic')) factorMult += 0.18;
  if (q.includes('upload')) factorMult += 0.15;
  if (q.includes('ai')) factorMult += 0.12;
  if (q.includes('security')) factorMult -= 0.05;
  if (q.includes('new')) factorMult += 0.09;

  const mult = segmentMult * fileTypeMult * regionMult * factorMult;
  const rows = [];
  let storageBase = 620;

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const t = days - i;
    const wave = Math.sin(t / 3.1) * 110 + Math.cos(t / 5.4) * 70;
    const trend = t * 6;

    const active = Math.round((1750 + trend + wave) * mult);
    const newUsers = Math.max(25, Math.round((95 + t * 1.5 + Math.sin(t / 2.4) * 32) * mult));
    const uploads = Math.max(180, Math.round((420 + t * 2.8 + Math.cos(t / 2.7) * 90) * fileTypeMult * regionMult));
    const trafficK = Number((((active / 150) + (uploads / 180) + (Math.sin(t / 2.5) * 1.8)) * regionMult).toFixed(1));
    const concurrentPeak = Math.max(90, Math.round(active * 0.29));
    const peakHour = clamp(9 + Math.round((concurrentPeak / 140) % 8), 8, 17);
    const peakMin = ['00', '10', '20', '30', '40'][t % 5];

    storageBase += uploads * 0.013 * fileTypeMult;

    rows.push({
      date: d.toISOString().slice(0, 10),
      active,
      newUsers,
      uploads,
      trafficK,
      concurrentPeak,
      peakTime: `${String(peakHour).padStart(2, '0')}:${peakMin}`,
      storageTb: Number(storageBase.toFixed(1)),
    });
  }

  return rows;
}

function createActivityLog(rows) {
  return rows.slice(-18).flatMap((row, idx) => (
    ['upload', 'edit', 'share'].map((action, j) => ({
      id: `${row.date}-${action}-${j}`,
      time: `${row.date} ${String(9 + ((idx + j) % 9)).padStart(2, '0')}:${j ? '40' : '15'}`,
      action,
      actor: ['A. Kim', 'N. Roy', 'S. Patel', 'M. Chen', 'J. Walker'][(idx + j) % 5],
      type: ['PDF', 'DOCX', 'TXT', 'PNG', 'XLSX'][(idx + j) % 5],
    }))
  )).slice(-24);
}

function sparkline(values, color) {
  return {
    animation: false,
    grid: { left: 0, right: 0, top: 4, bottom: 2 },
    xAxis: { type: 'category', show: false, data: values.map((_, idx) => idx + 1) },
    yAxis: { type: 'value', show: false },
    series: [{ type: 'line', smooth: true, data: values, showSymbol: false, lineStyle: { width: 2, color } }],
  };
}

function getPreviewOption(cardKey, rows) {
  const take = rows.slice(-8);
  const mapper = {
    users: take.map((r) => Math.round(r.active / 100)),
    files: take.map((r) => Math.round(r.uploads / 20)),
    traffic: take.map((r) => Math.round(r.trafficK * 2)),
    ai: take.map((r) => Math.round((r.uploads * 0.18) / 6)),
    activity: take.map((r) => Math.round((r.active + r.uploads) / 130)),
    leaderboard: take.map((r) => Math.round(r.active / 90)),
    security: take.map((r) => Math.max(2, Math.round((r.trafficK / 2) - 3))),
    billing: take.map((r) => Math.round((r.newUsers / 6) + 10)),
  };
  const colorMap = {
    users: '#26a5ef', files: '#13b58a', traffic: '#d28b1f', ai: '#596be2',
    activity: '#16a2c4', leaderboard: '#8952dd', security: '#d1556e', billing: '#2a7ec7',
  };
  return sparkline(mapper[cardKey], colorMap[cardKey]);
}

function buildOptions(rows) {
  const base = chartTheme();
  const dates = rows.map((r) => r.date.slice(5));
  const active = rows.map((r) => r.active);
  const newUsers = rows.map((r) => r.newUsers);
  const uploads = rows.map((r) => r.uploads);
  const storage = rows.map((r) => r.storageTb);
  const traffic = rows.map((r) => r.trafficK);
  const concurrent = rows.map((r) => r.concurrentPeak);

  return {
    usersGrowth: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value' }, series: [{ type: 'line', smooth: true, data: active, lineStyle: { color: '#2e8dd5', width: 3 }, areaStyle: { color: 'rgba(46,141,213,0.2)' } }] },
    activeVsNew: { ...base, legend: { textStyle: { color: '#527d9f' } }, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value' }, series: [{ name: 'Active Users', type: 'line', smooth: true, data: active, lineStyle: { color: '#2f77bc' } }, { name: 'New Users', type: 'bar', data: newUsers, barWidth: 14, itemStyle: { color: '#17a474' } }] },
    uploadTimeline: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value' }, series: [{ type: 'bar', data: uploads, itemStyle: { color: '#1f9ec7' } }] },
    storageGrowth: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value', name: 'TB' }, series: [{ type: 'line', smooth: true, data: storage, lineStyle: { color: '#5e6fe2', width: 3 }, areaStyle: { color: 'rgba(94,111,226,0.2)' } }] },
    trafficTimeline: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value', name: 'k req/min' }, series: [{ type: 'line', smooth: true, data: traffic, lineStyle: { color: '#d18a2b', width: 3 }, areaStyle: { color: 'rgba(209,138,43,0.2)' } }] },
    concurrentTimeline: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value', name: 'users' }, series: [{ type: 'line', smooth: true, data: concurrent, lineStyle: { color: '#1d8fab', width: 2.5 } }] },
    planMix: { series: [{ type: 'pie', radius: ['42%', '72%'], data: [{ value: 37, name: 'Free' }, { value: 31, name: 'Business' }, { value: 20, name: 'Premium' }, { value: 12, name: 'Enterprise' }], label: { color: '#2a4d69' } }] },
    fileTypeDonut: { series: [{ type: 'pie', radius: ['44%', '72%'], data: [{ value: 40, name: 'PDF' }, { value: 26, name: 'DOCX' }, { value: 14, name: 'TXT' }, { value: 12, name: 'Images' }, { value: 8, name: 'Other' }], label: { color: '#2d4f69' } }] },
    aiCorrelation: { ...base, xAxis: { ...base.xAxis, type: 'value', name: 'CPU %' }, yAxis: { ...base.yAxis, type: 'value', name: 'Tasks/min' }, series: [{ type: 'scatter', symbolSize: (val) => val[2] / 25, data: rows.slice(-10).map((r, i) => [20 + i * 5, Math.round((r.uploads * 0.17) / 1.6), Math.round(r.active / 8)]), itemStyle: { color: '#4f72d5' } }] },
    histogramProc: { ...base, xAxis: { ...base.xAxis, type: 'category', data: ['0-1s', '1-2s', '2-3s', '3-4s', '4-5s', '5-6s'] }, yAxis: { ...base.yAxis, type: 'value' }, series: [{ type: 'bar', data: [210, 398, 340, 222, 143, 78], itemStyle: { color: '#1f9bb8' } }] },
    cpuGauge: { series: [{ type: 'gauge', min: 0, max: 100, axisLine: { lineStyle: { width: 12, color: [[0.5, '#7ad4a8'], [0.8, '#f0c469'], [1, '#e8899f']] } }, detail: { formatter: 'CPU {value}%', color: '#2a4d69', fontSize: 16 }, data: [{ value: clamp(Math.round((traffic.at(-1) || 18) * 3.1), 18, 92) }] }] },
    securityTrend: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value' }, series: [{ name: 'Failed Login', type: 'bar', data: rows.map((r) => Math.max(18, Math.round(r.trafficK * 9))), itemStyle: { color: '#cf5f79' } }, { name: 'Suspicious', type: 'line', smooth: true, data: rows.map((r) => Math.max(3, Math.round(r.trafficK * 0.9))), lineStyle: { color: '#9a4fcd' } }] },
    billingGrowth: { ...base, xAxis: { ...base.xAxis, type: 'category', data: dates }, yAxis: { ...base.yAxis, type: 'value', name: '$k' }, series: [{ type: 'bar', data: rows.map((r) => Math.round(r.newUsers * 1.8)), itemStyle: { color: '#2f82c4' } }] },
    conversionFunnel: { series: [{ type: 'funnel', top: 20, bottom: 20, left: '10%', width: '80%', label: { color: '#294d67' }, data: [{ value: 100, name: 'Visited Pricing' }, { value: 72, name: 'Started Trial' }, { value: 49, name: 'Activated Workspace' }, { value: 31, name: 'Uploaded 10+ Files' }, { value: 18, name: 'Converted to Paid' }] }] },
    calendarHeatmap: (() => {
      const data = rows.map((r) => [r.date, Math.round((r.active + r.uploads) / 45)]);
      return {
        visualMap: { min: 10, max: 95, orient: 'horizontal', top: 2, left: 'center', textStyle: { color: '#587f9e' }, inRange: { color: ['#e8f5ff', '#b8ddf5', '#74bde6', '#2f95cb'] } },
        calendar: { top: 28, left: 14, right: 10, bottom: 10, range: [rows[0].date, rows.at(-1).date], cellSize: ['auto', 13], dayLabel: { color: '#5e86a4' }, monthLabel: { color: '#5e86a4' }, yearLabel: { show: false } },
        series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
      };
    })(),
  };
}

function exportAsCsv(title, rows) {
  const header = ['date', 'active', 'newUsers', 'uploads', 'trafficK', 'concurrentPeak', 'peakTime', 'storageTb'];
  const body = rows.map((r) => [r.date, r.active, r.newUsers, r.uploads, r.trafficK, r.concurrentPeak, r.peakTime, r.storageTb].join(','));
  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-analytics.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ChartCard({ title, option, spanClass, onHover, height = 230 }) {
  return (
    <div className={`glass-widget ${spanClass}`}>
      <div className="widget-title">{title}</div>
      <ReactECharts
        option={option}
        style={{ height }}
        onEvents={{
          mouseover: (params) => onHover(title, params),
          globalout: () => onHover(null, null),
        }}
      />
    </div>
  );
}

function SummaryBoard({ rows, options, onHover }) {
  const latest = rows.at(-1);
  const first = rows[0];
  const highestNew = rows.reduce((max, row) => (row.newUsers > max.newUsers ? row : max), rows[0]);
  const highestUpload = rows.reduce((max, row) => (row.uploads > max.uploads ? row : max), rows[0]);
  const highestConcurrent = rows.reduce((max, row) => (row.concurrentPeak > max.concurrentPeak ? row : max), rows[0]);

  const storageIncrease = latest.storageTb - first.storageTb;
  const storageIncreasePct = (storageIncrease / first.storageTb) * 100;
  const uploadIncreasePct = ((latest.uploads - first.uploads) / first.uploads) * 100;

  const cards = [
    ['Total Users', '48,920', 'All registered tenants'],
    ['Active Users (Latest Date)', String(latest.active), latest.date],
    ['Storage Increase', `+${storageIncrease.toFixed(1)} TB`, `${storageIncreasePct.toFixed(2)}% growth`],
    ['Traffic Peak (Concurrent)', `${highestConcurrent.concurrentPeak}`, `${highestConcurrent.date} @ ${highestConcurrent.peakTime}`],
    ['Highest New Users Day', String(highestNew.newUsers), highestNew.date],
    ['Highest Upload Day', `${highestUpload.uploads} files`, highestUpload.date],
    ['Upload Increase %', `${uploadIncreasePct.toFixed(2)}%`, `${first.date} -> ${latest.date}`],
    ['Current Traffic', `${latest.trafficK}k req/min`, `Peak time ${latest.peakTime}`],
  ];

  return (
    <section className="summary-board">
      <div className="summary-grid">
        {cards.map((c) => (
          <article className="summary-card" key={c[0]}>
            <div className="summary-label">{c[0]}</div>
            <div className="summary-value">{c[1]}</div>
            <div className="summary-note">{c[2]}</div>
          </article>
        ))}
      </div>

      <div className="summary-charts">
        <div className="summary-chart-card"><div className="widget-title">Active Users by Date</div><ReactECharts option={options.usersGrowth} style={{ height: 190 }} onEvents={{ mouseover: (p) => onHover('Active Users by Date', p), globalout: () => onHover(null, null) }} /></div>
        <div className="summary-chart-card"><div className="widget-title">Files Uploaded Timeline</div><ReactECharts option={options.uploadTimeline} style={{ height: 190 }} onEvents={{ mouseover: (p) => onHover('Files Uploaded Timeline', p), globalout: () => onHover(null, null) }} /></div>
        <div className="summary-chart-card"><div className="widget-title">Concurrent Users Timeline</div><ReactECharts option={options.concurrentTimeline} style={{ height: 190 }} onEvents={{ mouseover: (p) => onHover('Concurrent Users Timeline', p), globalout: () => onHover(null, null) }} /></div>
      </div>

      <div className="data-ribbon">
        <span>Latest Date: {latest.date}</span>
        <span>Peak Time: {latest.peakTime}</span>
        <span>Traffic: {latest.trafficK}k req/min</span>
        <span>Storage: {latest.storageTb.toFixed(1)} TB</span>
      </div>
    </section>
  );
}

function SectionCard({ card, onOpen, rows }) {
  const latest = rows.at(-1);
  const kpiMap = {
    users: [['Total Users', '48,920'], ['Live Active', String(latest.active)], ['DAU/WAU/MAU', '2.7k / 14.2k / 49k'], ['Retention', '91.8%']],
    files: [['Total Files', '9.24M'], ['Storage Used', `${latest.storageTb} TB`], ['Avg File Size', '3.6 MB'], ['Growth', '+11.8%']],
    traffic: [['Current RPS', `${latest.trafficK}k`], ['Latency p95', '147 ms'], ['Error Rate', '0.39%'], ['Peak Concurrent', String(latest.concurrentPeak)]],
    ai: [['OCR Jobs', '1.48M'], ['AI Tasks/day', Math.round(latest.uploads * 0.18).toString()], ['Avg Proc Time', '1.92 s'], ['Failure Rate', '1.4%']],
    activity: [['Events Today', Math.round((latest.active + latest.uploads) * 2.3).toString()], ['Peak Time', latest.peakTime], ['Density', 'High'], ['Replay', 'Enabled']],
    leaderboard: [['Top Activity', 'Acme Labs'], ['Top AI', 'DataNova'], ['Avg Score', '84.2'], ['Badges', '1,122']],
    security: [['Failed Logins', String(Math.round(latest.trafficK * 9))], ['Suspicious', String(Math.round(latest.trafficK * 0.9))], ['Risk', '31/100'], ['Blocked IPs', '42']],
    billing: [['MRR', `$${Math.round(latest.newUsers * 1.8)}k`], ['ARR', '$23.2M'], ['Upgrade', '12.8%'], ['LTV', '$8,640']],
  };

  return (
    <motion.article className="section-card" whileHover={{ y: -2, boxShadow: '0 18px 35px rgba(3,19,36,0.2)' }} onClick={() => onOpen(card)} transition={{ duration: 0.2 }}>
      <div className="section-title-row">
        <div className="section-title">{card.title}</div>
        <div style={{ fontSize: 10, color: '#5b87a7' }}>Click to expand</div>
      </div>

      <div style={{ color: '#5f87a6', fontSize: 11, lineHeight: 1.4 }}>{card.description}</div>

      <div className="section-kpi">
        {kpiMap[card.key].map((item) => (
          <div key={item[0]} className="kpi-chip">
            <div className="label">{item[0]}</div>
            <div className="value">{item[1]}</div>
          </div>
        ))}
      </div>

      <div style={{ minHeight: 44 }}>
        <ReactECharts option={getPreviewOption(card.key, rows)} style={{ height: '48px', width: '100%' }} opts={{ renderer: 'canvas' }} />
      </div>

      <div className="preview-badges">
        {card.previewBadges.map((badge) => (<span className="preview-badge" key={badge}>{badge}</span>))}
      </div>
    </motion.article>
  );
}

function SortableUserTable({ users }) {
  const [sortBy, setSortBy] = useState('activity');
  const [dir, setDir] = useState('desc');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const filtered = users.filter((item) => item.user.toLowerCase().includes(query.toLowerCase()));
    return [...filtered].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      const compare = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return dir === 'asc' ? compare : -compare;
    });
  }, [users, sortBy, dir, query]);

  const toggleSort = (key) => {
    if (sortBy === key) setDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setDir('desc');
    }
  };

  return (
    <div className="glass-widget span-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="widget-title" style={{ marginBottom: 0 }}>Top Active Users Table (sort/filter)</div>
        <input
          placeholder="Filter user"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ height: 30, borderRadius: 8, border: '1px solid rgba(120,187,218,0.35)', background: 'rgba(255,255,255,0.95)', color: '#2a4d69', fontSize: 12, padding: '0 10px' }}
        />
      </div>
      <div className="table-wrap">
        <table className="mc-table">
          <thead><tr><th onClick={() => toggleSort('user')}>User</th><th onClick={() => toggleSort('storage')}>Storage (GB)</th><th onClick={() => toggleSort('activity')}>Activity Score</th><th onClick={() => toggleSort('ai')}>AI Usage</th><th onClick={() => toggleSort('plan')}>Plan</th></tr></thead>
          <tbody>{rows.map((item) => <tr key={item.user}><td>{item.user}</td><td>{item.storage}</td><td>{item.activity}</td><td>{item.ai}</td><td>{item.plan}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ActivityTimeline({ activityLog }) {
  return <div className="timeline-scroll">{activityLog.map((entry) => <div className="timeline-item" key={entry.id}><div style={{ color: '#2b4d69' }}>{entry.time}</div><div style={{ color: '#4f7f9d' }}>{entry.actor}</div><div style={{ color: '#25779f', textTransform: 'uppercase' }}>{entry.action}</div><div style={{ color: '#2b8f72' }}>{entry.type}</div></div>)}</div>;
}

function TimelineTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="mc-table">
        <thead><tr><th>Date</th><th>Active Users</th><th>New Users</th><th>Peak Time</th><th>Concurrent Peak</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.active}</td><td>{row.newUsers}</td><td>{row.peakTime}</td><td>{row.concurrentPeak}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function moduleSummary(cardKey, rows, users, activityLog) {
  const latest = rows.at(-1);
  const first = rows[0];
  const activeGrowth = (((latest.active - first.active) / first.active) * 100).toFixed(1);
  const uploadGrowth = (((latest.uploads - first.uploads) / first.uploads) * 100).toFixed(1);
  const avgTraffic = (rows.reduce((sum, r) => sum + r.trafficK, 0) / rows.length).toFixed(1);
  const avgNewUsers = Math.round(rows.reduce((sum, r) => sum + r.newUsers, 0) / rows.length);
  const topUser = [...users].sort((a, b) => b.activity - a.activity)[0];
  const suspicious = rows.reduce((sum, r) => sum + Math.max(3, Math.round(r.trafficK * 0.9)), 0);

  const byModule = {
    users: {
      heading: 'User Intelligence Snapshot',
      text: `User activity is trending upward with ${activeGrowth}% growth across the selected window. New-user inflow is averaging ${avgNewUsers}/day, while engagement remains strongest in high-activity tenant cohorts.`,
      stats: [
        { label: 'Latest Active Users', value: latest.active },
        { label: 'Avg New Users / Day', value: avgNewUsers },
        { label: 'Top User', value: topUser.user },
        { label: 'Active Growth %', value: `${activeGrowth}%` },
      ],
    },
    files: {
      heading: 'File System Snapshot',
      text: `Uploads and storage expansion continue to rise in parallel. File workload intensity indicates sustained document ingestion with stable daily volume and predictable storage growth.`,
      stats: [
        { label: 'Latest Uploads', value: latest.uploads },
        { label: 'Storage (TB)', value: latest.storageTb.toFixed(1) },
        { label: 'Upload Growth %', value: `${uploadGrowth}%` },
        { label: 'Peak Time', value: latest.peakTime },
      ],
    },
    traffic: {
      heading: 'Traffic and Performance Snapshot',
      text: `Request flow and concurrency remain healthy with balanced burst handling. Current throughput and concurrent peaks indicate stable service behavior under dynamic load.`,
      stats: [
        { label: 'Current Traffic', value: `${latest.trafficK}k/min` },
        { label: 'Avg Traffic', value: `${avgTraffic}k/min` },
        { label: 'Concurrent Peak', value: latest.concurrentPeak },
        { label: 'Traffic Window Peak', value: `${Math.max(...rows.map((r) => r.trafficK))}k/min` },
      ],
    },
    ai: {
      heading: 'AI Processing Snapshot',
      text: `AI throughput scales with upload volume and user concurrency. Processing pressure appears manageable, with consistent task completion behavior across the selected date window.`,
      stats: [
        { label: 'Estimated AI Tasks/Day', value: Math.round(latest.uploads * 0.18) },
        { label: 'Queue Pressure Index', value: Math.round((latest.concurrentPeak + latest.uploads) / 18) },
        { label: 'Avg Daily Uploads', value: Math.round(rows.reduce((s, r) => s + r.uploads, 0) / rows.length) },
        { label: 'Processing Trend', value: `${uploadGrowth}%` },
      ],
    },
    activity: {
      heading: 'Activity Stream Snapshot',
      text: `Event flow is steady with clear high-density windows around peak user concurrency. The timeline reveals sustained edit/share/upload cycles throughout the selected period.`,
      stats: [
        { label: 'Logged Events', value: activityLog.length },
        { label: 'Latest Peak Time', value: latest.peakTime },
        { label: 'Daily Action Density', value: Math.round((latest.active + latest.uploads) / 10) },
        { label: 'Avg Concurrent Users', value: Math.round(rows.reduce((s, r) => s + r.concurrentPeak, 0) / rows.length) },
      ],
    },
    leaderboard: {
      heading: 'Leaderboard Snapshot',
      text: `Top tenant activity remains concentrated among a few high-intensity workspaces. Ranking movement is primarily driven by engagement and AI workload variation.`,
      stats: [
        { label: 'Top Ranked User', value: topUser.user },
        { label: 'Top Activity Score', value: topUser.activity },
        { label: 'Users Tracked', value: users.length },
        { label: 'Avg Activity Score', value: Math.round(users.reduce((s, u) => s + u.activity, 0) / users.length) },
      ],
    },
    security: {
      heading: 'Security and Risk Snapshot',
      text: `Security telemetry indicates moderate anomaly levels, with failed access attempts correlating to traffic bursts. Monitoring focus should remain on high-frequency suspicious windows.`,
      stats: [
        { label: 'Suspicious Events (Window)', value: suspicious },
        { label: 'Latest Failed Login Est.', value: Math.round(latest.trafficK * 9) },
        { label: 'Risk Level', value: 'Moderate' },
        { label: 'Traffic Correlation', value: `${avgTraffic}k/min` },
      ],
    },
    billing: {
      heading: 'Revenue and Usage Snapshot',
      text: `Revenue momentum aligns with activation and usage growth. Conversion indicators are stable, with recurring value concentrated in active, high-throughput workspaces.`,
      stats: [
        { label: 'Estimated MRR', value: `$${Math.round(latest.newUsers * 1.8)}k` },
        { label: 'Conversion Signal', value: 'Stable' },
        { label: 'New Users (Latest)', value: latest.newUsers },
        { label: 'Growth Factor', value: `${activeGrowth}%` },
      ],
    },
  };

  return byModule[cardKey] || byModule.billing;
}

function ModuleInsightIntro({ cardKey, rows, users, activityLog }) {
  const summary = moduleSummary(cardKey, rows, users, activityLog);
  return (
    <>
      <div className="glass-widget span-8">
        <div className="widget-title">{summary.heading}</div>
        <div className="module-insight-text">{summary.text}</div>
      </div>
      <div className="glass-widget span-4">
        <div className="widget-title">Key Statistical Highlights</div>
        <div className="module-stat-grid">
          {summary.stats.map((s) => (
            <div className="module-stat-item" key={s.label}>
              <div className="module-stat-label">{s.label}</div>
              <div className="module-stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ModuleContent({ cardKey, options, onHover, users, rows, activityLog }) {
  const render = (title, option, spanClass = 'span-6', height = 230) => <ChartCard title={title} option={option} spanClass={spanClass} onHover={onHover} height={height} />;

  if (cardKey === 'users') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('User Growth + New Users by Date', options.activeVsNew, 'span-8')}{render('User Plan Distribution', options.planMix, 'span-4')}{render('Retention Flow (Sankey)', options.conversionFunnel, 'span-6')}{render('Active Users Trend', options.usersGrowth, 'span-6')}<SortableUserTable users={users} /><div className="glass-widget span-6"><div className="widget-title">Active Users Timeline Table</div><TimelineTable rows={rows} /></div></>;
  }
  if (cardKey === 'files') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('Files Uploaded by Day', options.uploadTimeline)}{render('Storage Growth (TB)', options.storageGrowth)}{render('File Type Distribution', options.fileTypeDonut, 'span-4')}{render('Upload-to-Load Correlation', options.aiCorrelation, 'span-8')}{render('Calendar Density', options.calendarHeatmap, 'span-12')}</>;
  }
  if (cardKey === 'traffic') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('User Traffic Timeline', options.trafficTimeline, 'span-8')}{render('CPU Usage Gauge', options.cpuGauge, 'span-4')}{render('Concurrent Users by Date', options.concurrentTimeline)}{render('Active vs New Pressure', options.activeVsNew)}{render('Security Correlation', options.securityTrend, 'span-12')}</>;
  }
  if (cardKey === 'ai') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('AI Processing Histogram', options.histogramProc)}{render('CPU vs AI Task Correlation', options.aiCorrelation)}{render('Task Mix', options.fileTypeDonut, 'span-4')}{render('AI Throughput Timeline', options.uploadTimeline, 'span-8')}{render('Activity Calendar', options.calendarHeatmap, 'span-12')}</>;
  }
  if (cardKey === 'activity') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('Calendar Heatmap', options.calendarHeatmap)}{render('Timeline Activity', options.uploadTimeline)}{render('Active Users Timeline', options.usersGrowth)}{render('Traffic by Date', options.trafficTimeline)}<div className="glass-widget span-12"><div className="widget-title">Activity Event Stream</div><ActivityTimeline activityLog={activityLog} /></div></>;
  }
  if (cardKey === 'leaderboard') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} /><SortableUserTable users={users} />{render('Engagement Trend', options.usersGrowth)}{render('Leaderboard Growth Pressure', options.activeVsNew)}{render('Top Usage Calendar', options.calendarHeatmap, 'span-12')}</>;
  }
  if (cardKey === 'security') {
    return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('Failed Login & Suspicious Trend', options.securityTrend, 'span-8')}{render('Risk Calendar', options.calendarHeatmap, 'span-4')}{render('Traffic vs Risk', options.aiCorrelation)}{render('Concurrent Risk Window', options.concurrentTimeline)}<div className="glass-widget span-12"><div className="widget-title">Security Event Timeline</div><ActivityTimeline activityLog={activityLog} /></div></>;
  }

  return <><ModuleInsightIntro cardKey={cardKey} rows={rows} users={users} activityLog={activityLog} />{render('Revenue Growth', options.billingGrowth, 'span-6')}{render('Plan Distribution', options.planMix, 'span-3')}{render('Conversion Funnel', options.conversionFunnel, 'span-3')}{render('Users vs Revenue', options.activeVsNew, 'span-6')}{render('Traffic Contribution to Revenue', options.trafficTimeline, 'span-6')}{render('Billing Calendar', options.calendarHeatmap, 'span-12')}</>;
}

function HoverToast({ toast }) {
  if (!toast) return null;
  return (
    <div className="chart-hover-toast" style={{ left: toast.x, top: toast.y }}>
      <div className="toast-title">{toast.title}</div>
      <div className="toast-line">Series: {toast.series}</div>
      <div className="toast-line">Point: {toast.label}</div>
      <div className="toast-line">Value: {toast.value}</div>
    </div>
  );
}

function DeepDivePanel({ card, onClose, options, users, rows, activityLog }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleHover = (title, params) => {
    if (!title || !params?.componentType || !params?.event?.event) {
      setToast(null);
      return;
    }
    const native = params.event.event;
    const x = clamp((native.clientX || 200) + 16, 20, window.innerWidth - 280);
    const y = clamp((native.clientY || 160) + 16, 20, window.innerHeight - 120);

    const value = Array.isArray(params.value) ? params.value.join(', ') : String(params.value ?? 'n/a');
    const series = params.seriesName || params.name || 'Point';
    const label = params.name || 'Data point';

    setToast({ title, series, label, value, x, y });
  };

  return (
    <motion.div className="deep-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section className="deep-panel" initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.985, y: 8 }} onClick={(event) => event.stopPropagation()}>
        <header className="deep-header">
          <div><div className="deep-title">{card.title} Deep Dive</div><div className="deep-subtitle">Dynamic analytics with hover-point detail toast</div></div>
          <div className="deep-toolbar">
            <button className="mc-btn" onClick={onClose}>Back to Home</button>
            <button className="mc-btn" onClick={() => exportAsCsv(card.title, rows)}>Export CSV</button>
            <button className="mc-btn" onClick={() => window.print()}>Export PDF</button>
            <button className="mc-btn mc-btn-danger" onClick={onClose}>Close Panel</button>
          </div>
        </header>

        <div className="deep-content">
          <ModuleContent cardKey={card.key} options={options} onHover={handleHover} users={users} rows={rows} activityLog={activityLog} />
        </div>
      </motion.section>
      <HoverToast toast={toast} />
    </motion.div>
  );
}

export default function AdminMissionControl() {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState(null);
  const [dateRange, setDateRange] = useState('last-30-days');
  const [daysBack, setDaysBack] = useState(30);
  const [segment, setSegment] = useState('all');
  const [fileType, setFileType] = useState('all');
  const [region, setRegion] = useState('global');
  const [factorQuery, setFactorQuery] = useState('');

  const effectiveDays = useMemo(() => {
    if (dateRange === 'custom') return clamp(Number(daysBack) || 30, 1, 365);
    return presetDays[dateRange] || 30;
  }, [dateRange, daysBack]);

  const timelineRows = useMemo(() => makeTimeline(effectiveDays, segment, fileType, region, factorQuery), [effectiveDays, segment, fileType, region, factorQuery]);
  const options = useMemo(() => buildOptions(timelineRows), [timelineRows]);
  const activityLog = useMemo(() => createActivityLog(timelineRows), [timelineRows]);
  const users = useMemo(() => {
    const seg = { all: 1, free: 0.8, premium: 1.04, enterprise: 1.12 }[segment] || 1;
    const reg = { global: 1, apac: 1.03, emea: 0.98, amer: 1.08 }[region] || 1;
    return baseUsers.map((u) => ({
      ...u,
      storage: Math.round(u.storage * seg * reg),
      activity: clamp(Math.round(u.activity * seg), 40, 100),
      ai: Math.round(u.ai * reg),
    }));
  }, [segment, region]);

  const handleSignOut = () => {
    try {
      clearAdminSession();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Admin logout failed:', error);
      navigate('/admin/login', { replace: true });
    }
  };

  const handleBackToUserLogin = () => {
    clearAdminSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-mc-root">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand">
            <div className="brand-pulse" />
            <div>
              <div className="admin-title">DocMatrix Mission Control</div>
              <div className="admin-subtitle">Dynamic analytics war room with real-time constraint-driven charts</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="mc-btn" onClick={() => setActiveCard(CARD_CONFIG[0])}>Open User Intelligence</button>
            <button className="mc-btn" onClick={handleBackToUserLogin}>Back to Login</button>
            <button className="mc-btn mc-btn-danger" onClick={handleSignOut}>Exit Admin</button>
          </div>
        </header>

        <SummaryBoard rows={timelineRows} options={options} onHover={() => {}} />

        <section className="filters-row filters-row-wide">
          <div className="filter-box">
            <label>Date Window</label>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
              <option value="last-24h">Last 24h</option>
              <option value="last-7-days">Last 7 days</option>
              <option value="last-30-days">Last 30 days</option>
              <option value="last-90-days">Last 90 days</option>
              <option value="custom">Custom Days</option>
            </select>
          </div>

          <div className="filter-box">
            <label>Past N Days</label>
            <input type="number" min={1} max={365} value={daysBack} onChange={(event) => { setDaysBack(event.target.value); setDateRange('custom'); }} />
          </div>

          <div className="filter-box">
            <label>User Segment</label>
            <select value={segment} onChange={(event) => setSegment(event.target.value)}>
              <option value="all">All Segments</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="filter-box">
            <label>File Type</label>
            <select value={fileType} onChange={(event) => setFileType(event.target.value)}>
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="txt">TXT</option>
              <option value="images">Images</option>
            </select>
          </div>

          <div className="filter-box">
            <label>Region</label>
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="global">Global</option>
              <option value="apac">APAC</option>
              <option value="emea">EMEA</option>
              <option value="amer">Americas</option>
            </select>
          </div>

          <div className="filter-box">
            <label>Factor Search</label>
            <input type="text" placeholder="traffic, upload, ai, security..." value={factorQuery} onChange={(event) => setFactorQuery(event.target.value)} />
          </div>
        </section>

        <main className="mission-grid">
          {CARD_CONFIG.map((card) => <SectionCard key={card.key} card={card} onOpen={setActiveCard} rows={timelineRows} />)}
        </main>

        <AnimatePresence>
          {activeCard ? <DeepDivePanel card={activeCard} onClose={() => setActiveCard(null)} options={options} users={users} rows={timelineRows} activityLog={activityLog} /> : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
