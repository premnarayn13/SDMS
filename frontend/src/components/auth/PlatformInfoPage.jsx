import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, Database, LayoutDashboard, BookOpen, ArrowLeft } from 'lucide-react';

const PAGE_CONTENT = {
  details: {
    title: 'Platform Details',
    subtitle: 'How DocMatrix is structured for enterprise-grade document management',
    bullets: [
      'Unified workspace for ingestion, search, AI processing, and compliance.',
      'Secure storage orchestration with cloud-drive integration and auditability.',
      'Scalable architecture for high-volume files and collaboration workflows.',
    ],
  },
  features: {
    title: 'Platform Features',
    subtitle: 'Core capabilities available across the product stack',
    bullets: [
      'AI-powered extraction, summarization, and classification workflows.',
      'Advanced analytics and mission-control dashboards for administrators.',
      'Role-based access patterns, policy control, and clean user operations.',
    ],
  },
  data: {
    title: 'Data & Security',
    subtitle: 'How platform data is handled, monitored, and protected',
    bullets: [
      'Structured telemetry for traffic, usage, processing, and storage trends.',
      'Encrypted transport and controlled data pathways across user operations.',
      'Operational visibility with event-level insights and anomaly monitoring.',
    ],
  },
  guide: {
    title: 'Platform Guide',
    subtitle: 'Quick onboarding flow for admins and teams',
    bullets: [
      'Sign in and connect storage provider to initialize workspace foundations.',
      'Set policies and user controls before onboarding teams and workloads.',
      'Track adoption and optimize with analytics, alerts, and periodic review.',
    ],
  },
};

const NAV_ITEMS = [
  { key: 'details', label: 'Details', icon: LayoutDashboard },
  { key: 'features', label: 'Features', icon: FileText },
  { key: 'data', label: 'Data', icon: Database },
  { key: 'guide', label: 'Guide', icon: BookOpen },
];

export default function PlatformInfoPage() {
  const { section = 'details' } = useParams();
  const key = PAGE_CONTENT[section] ? section : 'details';
  const content = PAGE_CONTENT[key];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-800" style={{ fontFamily: 'Manrope, Space Grotesk, Segoe UI, sans-serif' }}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <header className="rounded-2xl border border-cyan-100/25 bg-blue-900/35 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-100 font-extrabold tracking-tight">DocMatrix</span>
          </div>

          <nav className="flex items-center gap-2 text-sm">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.key === key;
              return (
                <Link
                  key={item.key}
                  to={`/platform/${item.key}`}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${active ? 'bg-cyan-200/20 text-white' : 'text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white'}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mt-8 rounded-3xl p-[1px] bg-gradient-to-br from-cyan-200/70 via-blue-200/55 to-sky-100/55 shadow-[0_24px_70px_rgba(6,62,120,0.3)]">
          <section className="bg-blue-900/35 backdrop-blur-2xl rounded-3xl p-8 lg:p-12 border border-cyan-100/30">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">{content.title}</h1>
                <p className="text-cyan-100/90 mt-2 text-lg">{content.subtitle}</p>
              </div>
              <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-200/20 text-cyan-100 hover:bg-cyan-200/30 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>

            <div className="mt-8 grid gap-4">
              {content.bullets.map((line) => (
                <article key={line} className="rounded-2xl border border-cyan-100/20 bg-blue-900/35 px-5 py-4 text-slate-100">
                  {line}
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
