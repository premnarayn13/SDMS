import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Database, HardDrive, BarChart2, ShieldAlert, 
  Settings, Check, Server, Eye, FileSpreadsheet, Image, 
  ArrowRight, ShieldCheck, Cpu, Terminal 
} from 'lucide-react';
import PublicLayout from './PublicLayout';

export default function DataPage() {
  const [metricScale, setMetricScale] = useState('100'); // '100' | '1000' | '5000'
  const [activeFormat, setActiveFormat] = useState('pdf');

  // Supported format details
  const formats = {
    pdf: {
      name: 'Portable Document Format (.pdf)',
      sizeLimit: '50 MB',
      operations: ['Page Split & Merge', 'Metadata Compression', 'Electronic Signatures', 'In-Browser Render'],
      latency: '240 ms / page',
      color: 'border-red-500/20 text-red-400 bg-red-950/20'
    },
    word: {
      name: 'Microsoft Word Document (.docx)',
      sizeLimit: '30 MB',
      operations: ['Variables Ingestion', 'Draft Formatting Preview', 'Structured JSON Export', 'Metadata Stripping'],
      latency: '150 ms / file',
      color: 'border-blue-500/20 text-blue-400 bg-blue-950/20'
    },
    excel: {
      name: 'Microsoft Excel Spreadsheet (.xlsx, .csv)',
      sizeLimit: '25 MB',
      operations: ['Formula Ingestion & Compute', 'Row/Column Filter', 'Data Plotting Charts', 'CSV Conversions'],
      latency: '90 ms / 10k rows',
      color: 'border-green-500/20 text-green-400 bg-green-950/20'
    },
    image: {
      name: 'Raster Images (.png, .jpg, .webp)',
      sizeLimit: '15 MB',
      operations: ['Tesseract OCR Ingestion', 'EXIF Metadata Viewer', 'Dynamic Filters & Crop', 'Format Compression'],
      latency: '850 ms / image OCR',
      color: 'border-cyan-500/20 text-cyan-400 bg-cyan-950/20'
    }
  };

  // Metric charts calculation mocks based on selected scale
  const getGraphValues = () => {
    const scale = parseInt(metricScale);
    return {
      ingest: [45 * (scale / 100), 55 * (scale / 100), 38 * (scale / 100), 72 * (scale / 100)],
      db: [30 * (scale / 100), 62 * (scale / 100), 40 * (scale / 100), 80 * (scale / 100)],
      labels: ['PDFs', 'Word', 'Excel', 'Images']
    };
  };

  const currentMetrics = getGraphValues();

  return (
    <PublicLayout>
      {/* 1. Cinematic Hero Section */}
      <section className="relative min-h-[75vh] flex items-center justify-center pt-16 pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-cyan-950/40 border border-cyan-400/30 text-cyan-400">
            Platform Specifications
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none max-w-4xl mx-auto">
            Secure <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent">Data Pipelines</span> & Specs
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Review supported document types, pipeline processing latency, browser sandbox operations, and zero-retention metadata schemas.
          </p>
        </div>
      </section>

      {/* 2. Format Support Matrix */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Supported Document Matrix</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              DocMatrix supports standard enterprise files. Click each type below to see its browser sandbox limits and actions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Tabs List */}
            <div className="lg:col-span-4 flex flex-col gap-2">
              {[
                { id: 'pdf', label: 'PDF Documents', icon: FileText },
                { id: 'word', label: 'Word Documents', icon: FileText },
                { id: 'excel', label: 'Spreadsheets', icon: FileSpreadsheet },
                { id: 'image', label: 'Raster Images', icon: Image }
              ].map(item => {
                const Icon = item.icon;
                const active = activeFormat === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveFormat(item.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${
                      active 
                        ? 'bg-slate-900 border-cyan-500/30 text-white shadow-md' 
                        : 'bg-slate-900/10 border-slate-900/60 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${active ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      <span className="text-xs md:text-sm font-bold">{item.label}</span>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-transform ${active ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>

            {/* Spec Details Card */}
            <div className="lg:col-span-8 bg-slate-900/30 border border-cyan-500/10 rounded-3xl p-6 md:p-8 shadow-2xl relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFormat}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className={`p-4 rounded-2xl border inline-block ${formats[activeFormat].color}`}>
                    <h3 className="text-base font-bold">{formats[activeFormat].name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Max Upload Size</span>
                      <p className="text-lg font-extrabold text-slate-200 mt-1">{formats[activeFormat].sizeLimit}</p>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Average Processing Latency</span>
                      <p className="text-lg font-extrabold text-cyan-400 mt-1 font-mono">{formats[activeFormat].latency}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supported Workbench Operations:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {formats[activeFormat].operations.map((op, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-900/60 rounded-xl text-xs text-slate-300">
                          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{op}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

          </div>

        </div>
      </section>

      {/* 3. Interactive Performance SVG Charts */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Platform Performance
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Pipeline Load Diagnostics</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              Simulate workload volumes in the diagnostic controls below to watch how memory usage and query latencies scale.
            </p>
          </div>

          {/* Interactive Scale Controls */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[
              { id: '100', label: '100 concurrent files' },
              { id: '1000', label: '1,000 concurrent files' },
              { id: '5000', label: '5,000 concurrent files' }
            ].map(scale => (
              <button
                key={scale.id}
                onClick={() => setMetricScale(scale.id)}
                className={`px-5 py-2 rounded-full text-xs font-semibold border transition-all ${
                  metricScale === scale.id 
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {scale.label}
              </button>
            ))}
          </div>

          {/* Custom SVG Charts Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Memory Usage Graphic */}
            <div className="p-6 md:p-8 rounded-3xl border border-slate-900 bg-slate-900/10 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Worker Node RAM Ingestion (MB)</h4>
                <span className="text-[10px] text-cyan-400 font-mono">ephemeral caches</span>
              </div>

              {/* Custom SVG Bar Chart */}
              <div className="relative h-48 flex items-end justify-between px-6 pt-4 border-l border-b border-slate-900">
                {currentMetrics.ingest.map((val, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 w-16">
                    {/* Animated bar height */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(val / 5000) * 120}px` }}
                      transition={{ type: 'spring', stiffness: 60 }}
                      className="w-8 rounded-t bg-gradient-to-t from-blue-600 via-sky-500 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">{Math.round(val)}MB</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase px-8">
                {currentMetrics.labels.map((l, idx) => <span key={idx}>{l}</span>)}
              </div>
            </div>

            {/* AI Latency Ingestion Chart */}
            <div className="p-6 md:p-8 rounded-3xl border border-slate-900 bg-slate-900/10 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Embedding Computation Latency (ms)</h4>
                <span className="text-[10px] text-blue-400 font-mono">vector stores</span>
              </div>

              {/* Custom SVG Bar Chart */}
              <div className="relative h-48 flex items-end justify-between px-6 pt-4 border-l border-b border-slate-900">
                {currentMetrics.db.map((val, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 w-16">
                    {/* Animated bar height */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(val / 5000) * 120}px` }}
                      transition={{ type: 'spring', stiffness: 60 }}
                      className="w-8 rounded-t bg-gradient-to-t from-cyan-600 via-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">{Math.round(val)}ms</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase px-8">
                {currentMetrics.labels.map((l, idx) => <span key={idx}>{l}</span>)}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Virtual Storage mounting flow */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/30">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">OAuth Mounting Handshake</h2>
            <p className="text-slate-400 text-sm md:text-base">
              How DocMatrix handles storage tokens.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative before:absolute before:left-0 before:right-0 before:top-12 before:h-[1px] before:bg-slate-900 before:hidden md:before:block">
            
            <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-900 relative z-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto font-mono text-sm font-bold">1</div>
              <h4 className="text-sm font-bold text-slate-200">OAuth Handshake</h4>
              <p className="text-xs text-slate-400">User prompts access requests. Google auth logs in token validation.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-900 relative z-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto font-mono text-sm font-bold">2</div>
              <h4 className="text-sm font-bold text-slate-200">In-Browser Mounting</h4>
              <p className="text-xs text-slate-400">Auth credentials cached in session. Directory tree maps metadata.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-900 relative z-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 mx-auto font-mono text-sm font-bold">3</div>
              <h4 className="text-sm font-bold text-slate-200">Ephemeral Sync</h4>
              <p className="text-xs text-slate-400">Buffers fetched directly to memory. Closed tabs release credentials.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Security compliance panel */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="p-8 md:p-12 rounded-3xl border border-cyan-500/20 bg-slate-900/30 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider font-mono">
                <ShieldCheck className="w-4 h-4 animate-pulse" /> compliance certificate
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">ISO-Ready Security Standards</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tokens are encrypted using TLS 1.3 in transit and AES-256 at rest inside isolated databases. Telemetry audits log administrative logins and metadata modifications automatically.
              </p>
            </div>
            
            <a
              href="/register"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shrink-0 whitespace-nowrap transition-all shadow-md shadow-cyan-900/25 flex items-center gap-1.5"
            >
              Mount Storage <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
