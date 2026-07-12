import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Server, Network, Terminal, Compass, Layers, 
  HelpCircle, ChevronRight, CheckCircle, Code, Cpu, 
  Settings, ArrowRight, Zap, Sparkles 
} from 'lucide-react';
import PublicLayout from './PublicLayout';

export default function AboutPage() {
  const [selectedArchStage, setSelectedArchStage] = useState('ingest');
  const [selectedTech, setSelectedTech] = useState(null);

  // Core pillars
  const pillars = [
    { 
      title: 'Zero Cache Storage', 
      desc: 'We never cache your documents. Files exist solely in ephemeral memory during processing, ensuring absolute confidentiality.',
      icon: Shield,
      color: 'text-cyan-400 bg-cyan-950/30'
    },
    { 
      title: 'Unified Orchestration', 
      desc: 'Rather than syncing files to DocMatrix, we mount them virtually via secure APIs, avoiding document duplication.',
      icon: Layers,
      color: 'text-blue-400 bg-blue-950/30'
    },
    { 
      title: 'AI Copilot Integration', 
      desc: 'AI is natively integrated into your document flow, letting you ask questions and extract metadata instantly.',
      icon: Sparkles,
      color: 'text-indigo-400 bg-indigo-950/30'
    }
  ];

  // Architecture flow explanation map
  const architectureStages = {
    ingest: {
      title: '1. Ingestion Layer',
      subtitle: 'Virtual Cloud Drive Mounting',
      desc: 'Users connect storage hubs via secure OAuth. DocMatrix accesses filenames and metadata using zero-cookie, sandboxed token handshakes. No raw contents are downloaded until requested by a user view action.',
      details: ['OAuth 2.0 Auth Flow', 'Encrypted Token Storage', 'Metadata Synchronizer']
    },
    fs: {
      title: '2. Virtual Filesystem',
      subtitle: 'In-Memory Indexing & Directories',
      desc: 'DocMatrix compiles folder hierarchies in a reactive in-memory virtual filesystem. File rows, file sizes, and creation dates are mapped instantly to React state, creating a seamless directory browsing experience.',
      details: ['Dynamic Tree-view Mapper', 'Instant State Management', 'Lazy-load directories']
    },
    engine: {
      title: '3. Processing Engine',
      subtitle: 'Format Adapters & Webbenches',
      desc: 'When a document is opened, DocMatrix runs format-specific parsers. PDFs run PDF.js, Word docs run Mammoth.js/docx-preview, Excel spreadsheets run xlsx libraries, and images run Tesseract OCR directly inside workers.',
      details: ['Ephemeral Client-side Parsers', 'Excel/CSV Workbenches', 'Tesseract OCR Indexer']
    },
    ai: {
      title: '4. AI Agent (Docky)',
      subtitle: 'Vector Semantic Search Engine',
      desc: 'Selected files can be sent to Docky Chat. Docky splits text into semantic chunks, creates vector embeddings via lightweight worker processes, and responds to queries with source citation references.',
      details: ['Semantic Text Chunker', 'Supabase Vector Database', 'Stream response pipelines']
    }
  };

  // Stack matrix data
  const techStack = [
    { key: 'react', name: 'React 18', type: 'Frontend Core', desc: 'Reactive state management, virtual DOM rendering, and reusable component ecosystem.', icon: Code },
    { key: 'vite', name: 'Vite 5', type: 'Build Engine', desc: 'Lightning-fast hot module replacement (HMR) and optimized rollup production bundles.', icon: Settings },
    { key: 'tailwind', name: 'Tailwind CSS', type: 'Design System', desc: 'Utility-first styling ensuring highly optimized, consistent, responsive layout styles.', icon: Compass },
    { key: 'fastapi', name: 'FastAPI', type: 'Backend Service', desc: 'Python async framework for robust, type-checked file parsing and pipeline routing APIs.', icon: Server },
    { key: 'supabase', name: 'Supabase', type: 'Database & Auth', desc: 'PostgreSQL database hosting user configurations, session data, and vector indexing.', icon: Network },
    { key: 'framer', name: 'Framer Motion', type: 'Motion Engine', desc: 'GPU-accelerated vector and transition animations for premium UX scroll triggers.', icon: Zap }
  ];

  return (
    <PublicLayout>
      {/* 1. Creative Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 left-[10%] w-[35%] h-[35%] rounded-full bg-blue-900/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-10 right-[15%] w-[45%] h-[45%] rounded-full bg-cyan-900/10 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-cyan-950/40 border border-cyan-400/30 text-cyan-400">
            About the Project
          </span>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none max-w-4xl mx-auto">
            Redefining <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent">Document Orchestration</span>
          </h1>

          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            DocMatrix was conceived to solve document fragmentation. By building a client-side layout engine that mounts directly to cloud APIs, we deliver a zero-retention workflow workspace.
          </p>
        </div>
      </section>

      {/* 2. Platform Philosophy & Pillars */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">System Core Pillars</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
              Our software architectural choices are governed by three simple principles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <div key={index} className="p-8 rounded-3xl border border-slate-900 bg-slate-900/20 hover:border-cyan-500/20 transition-all duration-300 space-y-4 group">
                  <div className={`p-4 rounded-2xl w-14 h-14 flex items-center justify-center ${pillar.color} border border-cyan-500/10 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">{pillar.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{pillar.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Interactive Architecture SVG Flowchart */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Technical Architecture
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Platform Ingestion Pipeline</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
              Click the pipeline blocks in the diagram below to review details on DocMatrix's data flows and system layers.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* SVG Architecture map */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-900 rounded-3xl p-6 md:p-8 flex flex-col justify-center min-h-[400px]">
              
              <div className="relative flex flex-col items-center gap-10">
                
                {/* 4 Interactive SVG Blocks */}
                {[
                  { id: 'ingest', label: '1. Storage Ingest (Google Drive / MEGA)', icon: Compass },
                  { id: 'fs', label: '2. Virtual Directory filesystem', icon: Layers },
                  { id: 'engine', label: '3. In-Browser Adaptor Engine', icon: Cpu },
                  { id: 'ai', label: '4. Supabase AI Embeddings & Vector Store', icon: Sparkles }
                ].map(stage => {
                  const Icon = stage.icon;
                  const selected = selectedArchStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedArchStage(stage.id)}
                      className={`w-full max-w-md p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between text-left relative ${
                        selected 
                          ? 'bg-slate-900 border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)] scale-[1.03]' 
                          : 'bg-slate-900/30 border-slate-900 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-lg ${selected ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-950 text-slate-500'}`}>
                          <Icon className="w-5 h-5 animate-pulse" />
                        </div>
                        <span className="text-xs md:text-sm font-bold">{stage.label}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${selected ? 'rotate-90 text-cyan-400' : 'text-slate-600'}`} />
                      
                      {/* Flow Connector Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 h-10 w-[2px] bg-gradient-to-b from-cyan-500/20 to-transparent pointer-events-none last:hidden" />
                    </button>
                  );
                })}

              </div>

            </div>

            {/* Architecture Details Sidebar Panel */}
            <div className="lg:col-span-5 bg-slate-900/30 border border-cyan-500/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" />
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedArchStage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">Pipeline Diagnostics</span>
                    <h3 className="text-2xl font-extrabold text-slate-100">{architectureStages[selectedArchStage].title}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{architectureStages[selectedArchStage].subtitle}</p>
                  </div>

                  <p className="text-slate-400 text-sm leading-relaxed">
                    {architectureStages[selectedArchStage].desc}
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Technical Components:</h4>
                    <div className="flex flex-wrap gap-2">
                      {architectureStages[selectedArchStage].details.map((detail, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-slate-950 border border-slate-900 text-slate-400">
                          {detail}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="pt-8 border-t border-slate-900 mt-6 flex items-center justify-between text-xs text-slate-500">
                <span>Diag Code: 0x9043{selectedArchStage.toUpperCase()}</span>
                <span className="text-cyan-400 font-bold flex items-center gap-1 font-mono">
                  <CheckCircle className="w-3.5 h-3.5" /> Pipeline Verified
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Interactive Document Lifecycle Flow */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/30">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">The Document Lifecycle</h2>
            <p className="text-slate-400 text-sm md:text-base">
              Follow how files traverse DocMatrix securely.
            </p>
          </div>

          <div className="space-y-8 relative before:absolute before:left-8 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-900">
            {[
              { step: '01', title: 'Mount Storage Hub', desc: 'Secure connection is established. File directories mapped without reading raw binary contents.' },
              { step: '02', title: 'Parse Layout Layouts', desc: 'Upon request, file buffers are downloaded directly to memory. Adapters parse layout layers, spreadsheets, tables, and images.' },
              { step: '03', title: 'Index Metadata Vectors', desc: 'Extract key compliance fields and create vector text embeddings to feed AI memory pipelines.' },
              { step: '04', title: 'Interactive AI Querying', desc: 'Chat with your document, split contents, and run conversion processors.' },
              { step: '05', title: 'Memory Flush & Session Revocation', desc: 'When the browser session is closed, in-memory buffers are flushed, and cloud tokens are disconnected safely.' }
            ].map((step, idx) => (
              <div key={idx} className="flex gap-6 items-start relative group">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold text-lg relative z-10 shrink-0 group-hover:border-cyan-500/30 transition-all font-mono shadow-md">
                  {step.step}
                </div>
                <div className="space-y-1 pt-1.5">
                  <h4 className="text-base font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">{step.title}</h4>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-2xl">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Interactive Technology Stack Matrix */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/50 border border-blue-500/25 text-blue-400">
              Technology Stack
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Our Core Ecosystem</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
              Hover over stack modules to explore DocMatrix's codebase components and build configurations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {techStack.map(tech => {
              const Icon = tech.icon;
              const selected = selectedTech === tech.key;
              return (
                <div
                  key={tech.key}
                  onMouseEnter={() => setSelectedTech(tech.key)}
                  onMouseLeave={() => setSelectedTech(null)}
                  className={`p-6 rounded-3xl border transition-all duration-300 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[180px] ${
                    selected 
                      ? 'bg-slate-900 border-cyan-500/30 shadow-[0_15px_30px_rgba(6,182,212,0.1)]' 
                      : 'bg-slate-900/10 border-slate-900 hover:border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl border ${selected ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-slate-950 border-slate-900 text-slate-500'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">{tech.type}</span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-200">{tech.name}</h3>
                  </div>

                  <AnimatePresence>
                    {selected ? (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-900/80 leading-relaxed"
                      >
                        {tech.desc}
                      </motion.p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-transparent leading-relaxed italic">
                        Hover to inspect stack component.
                      </p>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Creative CTA */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="rounded-3xl border border-cyan-500/20 bg-slate-900/30 p-8 md:p-12 text-center relative overflow-hidden space-y-6 max-w-4xl mx-auto shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight relative z-10">
              Ready to Explore the Platform?
            </h2>
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto relative z-10 leading-relaxed">
              Find technical implementation guidelines, setup guides, and virtual viewer capabilities in our Documentation database.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-10">
              <a
                href="/docs"
                className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold transition-all shadow-md shadow-cyan-900/20 flex items-center gap-2 group"
              >
                Launch Developer Docs <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="/features"
                className="px-6 py-3 rounded-full border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 transition-all font-semibold"
              >
                Features Showcase
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
