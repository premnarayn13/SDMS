import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Search, BookOpen, Compass, Terminal, Shield, 
  HelpCircle, ChevronDown, Check, Play, Edit, Trash, Plus, 
  Sparkles, Settings, UserCheck, HardDrive 
} from 'lucide-react';
import PublicLayout from './PublicLayout';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('start');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Accordion FAQ states
  const [openFaq, setOpenFaq] = useState(null);

  // Interactive toolbar demo state
  const [activeTool, setActiveTool] = useState('view');

  const docSections = {
    start: {
      title: 'Getting Started',
      description: 'Quickly set up your DocMatrix workspace, authorize storage credentials, and mount directory paths.',
      steps: [
        { title: 'Create an Account', desc: 'Register with your enterprise email. Your workspace will initialize automatically.' },
        { title: 'Authorize Storage Hubs', desc: 'Navigate to Drive Setup. Click Mount Drive to trigger the Google OAuth login prompt securely.' },
        { title: 'Configure Mount Folder', desc: 'Select specific folder sub-trees from your drive to sync metadata indices. Keep other files isolated.' }
      ]
    },
    workbenches: {
      title: 'File Workbenches & Tools',
      description: 'Configure and operate in-browser adapters to manipulate formats.',
      steps: [
        { title: 'PDF Power Tools', desc: 'Split bundles into pages, merge distinct files, append signature fields, and compress headers.' },
        { title: 'Word Variables Composer', desc: 'Inject custom variables like customer name or contract date into draft templates.' },
        { title: 'Spreadsheet Editor', desc: 'Inspect formulas, run calculations, and export sheets as CSV datasets.' }
      ]
    },
    ai: {
      title: 'AI Assistant (Docky)',
      description: 'Leverage semantic search indexes to query document repositories.',
      steps: [
        { title: 'Vector Embedding Indexing', desc: 'Click Send to Docky. Ephemeral workers parse the text layout and index semantic vectors.' },
        { title: 'Formulating Custom Prompts', desc: 'Prompt Docky for summaries, contract compliance risks, or telemetry analytics.' },
        { title: 'Review Source References', desc: 'Each response links back to specific file names and page indices for compliance validation.' }
      ]
    },
    admin: {
      title: 'System Administration',
      description: 'Manage user access permissions, track system logs, and optimize database telemetry.',
      steps: [
        { title: 'Admin Special Login', desc: 'Access admin credentials to open System Mission Control.' },
        { title: 'Audit Activities Logs', desc: 'Review event-level diagnostic records of logins, file actions, and API telemetry.' },
        { title: 'Database Optimization', desc: 'Manage Supabase table indices, storage quotas, and clean stale caches.' }
      ]
    }
  };

  const faqItems = [
    { q: 'Is my document content stored on DocMatrix servers?', a: 'No. DocMatrix uses a zero-retention architecture. Document buffers exist strictly in ephemeral worker memory during parsing and are completely flushed upon tab termination or session logout.' },
    { q: 'How does Google Drive authentication work?', a: 'We utilize standard Google OAuth 2.0 authorization codes. Tokens are securely encrypted using AES-256 and only accessed during active folder sync tasks.' },
    { q: 'What is the file size limit for workbenches?', a: 'Default file sizes are capped at 50MB for PDFs, 30MB for Word drafts, 25MB for Excel spreadsheets, and 15MB for raster image uploads.' },
    { q: 'How can I trigger administrative controls?', a: 'Navigate to /admin/login to access the administrative dashboard (Mission Control), where you can verify telemetry dashboards and manage global storage policies.' }
  ];

  const toolbarGuides = {
    view: { title: 'File Viewer Module', desc: 'Renders formats in-browser without conversion. Zoom, rotate pages, and scroll text layers.' },
    edit: { title: 'Variables Editor', desc: 'Toggle metadata composition overlays, insert formula tags, or fill out contract variables.' },
    pdf: { title: 'PDF Splits / Merges', desc: 'Launch PDF power tools. Exclude specific page segments or join multiple PDF documents.' },
    ai: { title: 'Send to Docky Chat', desc: 'Parse document layout layers into vector indices and initiate structured chatbot conversations.' }
  };

  return (
    <PublicLayout>
      {/* 1. Documentation Hero */}
      <section className="relative min-h-[50vh] flex items-center justify-center pt-16 pb-12 overflow-hidden border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center space-y-6 relative z-10">
          <span className="inline-flex items-center gap-1 bg-cyan-950/50 border border-cyan-500/35 px-3.5 py-1.5 rounded-full text-xs font-semibold text-cyan-400">
            <BookOpen className="w-4 h-4" /> Platform Documentation
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none">
            Developer & User Guidelines
          </h1>
          <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto">
            Find onboarding setups, file workbench manuals, vector query syntax, and administrative controls guides.
          </p>
        </div>
      </section>

      {/* 2. Sticky Left Navigation Layout */}
      <section className="py-16 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Sticky Left Sidebar navigation */}
          <div className="lg:col-span-3 lg:sticky lg:top-28 h-fit space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-3">Doc Categories</h3>
            <nav className="flex flex-col gap-1 bg-slate-900/20 p-2 border border-slate-900 rounded-3xl">
              {[
                { id: 'start', label: '1. Getting Started' },
                { id: 'workbenches', label: '2. File Workbenches' },
                { id: 'ai', label: '3. AI Assistant' },
                { id: 'admin', label: '4. System Admin' }
              ].map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`px-4 py-2.5 rounded-2xl text-left text-xs font-bold transition-all ${
                    activeSection === sec.id 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Docs Core Content */}
          <div className="lg:col-span-9 space-y-12">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-100">{docSections[activeSection].title}</h2>
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">{docSections[activeSection].description}</p>
                </div>

                {/* Steps Cards */}
                <div className="space-y-4">
                  {docSections[activeSection].steps.map((step, index) => (
                    <div key={index} className="p-6 rounded-3xl border border-slate-900 bg-slate-900/10 flex items-start gap-4 hover:border-slate-800 transition-all">
                      <span className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-xs text-cyan-400 font-mono shrink-0">
                        0{index + 1}
                      </span>
                      <div className="space-y-1 pt-0.5">
                        <h4 className="text-sm font-bold text-slate-200">{step.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </section>

      {/* 3. Interactive Toolbar Playground */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Feature Interactive Demo
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Virtual Viewer Toolbar Playground</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              Simulate clicking buttons in the document viewer toolbar below to review how each tool operates.
            </p>
          </div>

          {/* Interactive Viewer Toolbar */}
          <div className="max-w-4xl mx-auto rounded-3xl border border-cyan-500/15 bg-slate-950 p-4 shadow-2xl space-y-6">
            
            {/* Toolbar Buttons row */}
            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-slate-900 justify-center">
              {[
                { key: 'view', label: 'Launch Viewer', icon: BookOpen },
                { key: 'edit', label: 'Composer Edit', icon: Edit },
                { key: 'pdf', label: 'PDF Power Tools', icon: Trash },
                { key: 'ai', label: 'Ask Docky AI', icon: Sparkles }
              ].map(tool => {
                const Icon = tool.icon;
                const active = activeTool === tool.key;
                return (
                  <button
                    key={tool.key}
                    onClick={() => setActiveTool(tool.key)}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                      active 
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-400 shadow-sm' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tool.label}
                  </button>
                );
              })}
            </div>

            {/* Simulated Workspace Screen */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 min-h-[160px] flex items-center justify-between gap-6">
              
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">Tool Diagnostics</span>
                <h4 className="text-lg font-extrabold text-slate-100">{toolbarGuides[activeTool].title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                  {toolbarGuides[activeTool].desc}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl hidden md:flex flex-col items-center justify-center shrink-0 w-28 h-28">
                <Compass className="w-8 h-8 text-cyan-400 animate-spin" style={{ animationDuration: '20s' }} />
                <span className="text-[9px] font-mono text-slate-500 mt-2">SYS ACTIVE</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 4. Comprehensive Accordion FAQs */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
            <p className="text-slate-400 text-sm md:text-base">
              Got questions about security, cloud mounts, or AI vector structures? Find answers below.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index}
                  className="rounded-2xl border border-slate-900 bg-slate-900/10 overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-5 flex items-center justify-between text-left font-bold text-slate-200 hover:text-white transition-colors"
                  >
                    <span className="text-sm md:text-base flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-185 text-cyan-400' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-slate-900 bg-slate-950/40"
                      >
                        <p className="p-5 text-xs md:text-sm text-slate-400 leading-relaxed">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>
    </PublicLayout>
  );
}
