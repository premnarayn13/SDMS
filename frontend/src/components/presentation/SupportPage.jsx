import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, HelpCircle, HardDrive, Cpu, Sparkles, Send, 
  CheckCircle2, AlertCircle, RefreshCw, Star, Info, MessageSquare, 
  Clock, ArrowRight, X 
} from 'lucide-react';
import PublicLayout from './PublicLayout';

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Troubleshooter state
  const [troubleStage, setTroubleStage] = useState('start'); // 'start' | 'storage' | 'viewer' | 'ai'
  const [troubleSolution, setTroubleSolution] = useState(null);

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({ name: '', email: '', category: 'general', msg: '' });
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // 'idle' | 'submitting' | 'success'

  const supportTopics = [
    { title: 'Google Drive authorization fails', category: 'storage', tags: ['oauth', 'drive', 'token'], solution: 'Ensure you clear third-party cookies in your browser or whitelist docmatrix.cloud in your privacy settings. Re-run OAuth setup.' },
    { title: 'Document preview stays blank', category: 'viewer', tags: ['pdf', 'preview', 'blank'], solution: 'Check if the file is encrypted with an owner password. DocMatrix in-browser readers cannot parse password-locked PDFs.' },
    { title: 'Docky assistant gives network error', category: 'ai', tags: ['docky', 'ai', 'network'], solution: 'Verify that your Supabase vector keys are active in System Settings. Large document parsing might time out if network traffic is high.' },
    { title: 'Variable values do not compile in Word', category: 'viewer', tags: ['word', 'template', 'variable'], solution: 'Verify that variable brackets match the notation: {client_name} or {date}. Space characters inside braces are not parsed.' }
  ];

  const filteredTopics = searchQuery
    ? supportTopics.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.solution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.includes(searchQuery.toLowerCase()))
      )
    : supportTopics;

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackForm.name || !feedbackForm.email || !feedbackForm.msg) return;
    setFeedbackStatus('submitting');
    setTimeout(() => {
      setFeedbackStatus('success');
    }, 1500);
  };

  const resetFeedbackForm = () => {
    setFeedbackForm({ name: '', email: '', category: 'general', msg: '' });
    setFeedbackStatus('idle');
  };

  return (
    <PublicLayout>
      {/* 1. Support Hero with Interactive Search */}
      <section className="relative min-h-[55vh] flex flex-col items-center justify-center pt-16 pb-12 overflow-hidden bg-slate-950/40 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center space-y-6 relative z-10 w-full flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-cyan-950/40 border border-cyan-400/30 text-cyan-400">
            Intelligence Center
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none max-w-3xl">
            DocMatrix Help Desk & Support
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Search our real-time troubleshooter index or interact with our diagnostic routing tool below.
          </p>

          {/* Search Input bar */}
          <div className="relative w-full max-w-lg mt-4">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-slate-800 bg-slate-900 focus-within:border-cyan-400/50 transition-all duration-300">
              <Search className="w-5 h-5 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search troubleshooting keywords (oauth, preview, blank...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm w-full text-slate-200 placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 rounded-full text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Search Results Cards */}
      <section className="py-16 relative">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredTopics.map((topic, index) => (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-6 rounded-3xl border border-slate-900 bg-slate-900/10 hover:border-slate-800 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded font-bold uppercase">
                        {topic.category}
                      </span>
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200">{topic.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{topic.solution}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {topic.tags.map((tag, idx) => (
                      <span key={idx} className="text-[9px] font-mono text-slate-500">#{tag}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTopics.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-500 text-xs font-medium">
                No solutions found matching "{searchQuery}". Try searching general topics or use the Troubleshooter below.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Interactive Troubleshooter Flow */}
      <section className="py-24 relative border-t border-slate-900 bg-slate-950/30">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/50 border border-blue-500/25 text-blue-400">
              Diagnostic tool
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Interactive Troubleshooter</h2>
            <p className="text-slate-400 text-sm md:text-base">
              Click the categories below to diagnose and isolate specific DocMatrix issues instantly.
            </p>
          </div>

          {/* Troubleshooter Chassis */}
          <div className="p-6 md:p-8 rounded-3xl border border-cyan-500/15 bg-slate-950 shadow-2xl min-h-[300px] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl" />
            
            <AnimatePresence mode="wait">
              {/* Start stage */}
              {troubleStage === 'start' && (
                <motion.div
                  key="start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <h4 className="text-sm font-bold text-slate-200">What capability are you having trouble with?</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { key: 'storage', label: 'Cloud Storage Mounts', desc: 'Google Drive, token authentication' },
                      { key: 'viewer', label: 'File Viewer & Composer', desc: 'PDF, Word preview issues' },
                      { key: 'ai', label: 'Docky AI Assistant', desc: 'Vector search errors' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setTroubleStage(opt.key);
                          setTroubleSolution(null);
                        }}
                        className="p-5 rounded-2xl border border-slate-900 bg-slate-900/10 text-center hover:border-cyan-500/20 hover:bg-slate-900/30 transition-all space-y-2 group"
                      >
                        <h5 className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">{opt.label}</h5>
                        <p className="text-[10px] text-slate-500 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Storage stage */}
              {troubleStage === 'storage' && (
                <motion.div
                  key="storage"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h4 className="text-sm font-bold text-slate-200">Select the specific storage warning:</h4>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Token Expired Warning', sol: 'Re-authenticate. DocMatrix utilizes Google OAuth tokens that automatically expire after 14 days of inactivity for security.' },
                      { label: 'Folder mounting doesn\'t sync sub-directories', sol: 'Whitelist directory hierarchies. Ensure sub-folders do not exceed 3 levels deep from the mounted root directory.' }
                    ].map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTroubleSolution(opt.sol)}
                        className="p-4 rounded-xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 text-left text-xs text-slate-300"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Viewer stage */}
              {troubleStage === 'viewer' && (
                <motion.div
                  key="viewer"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h4 className="text-sm font-bold text-slate-200">Select the document preview warning:</h4>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Excel sheet formulas don\'t compute', sol: 'Check spreadsheet libraries compatibility. Ensure Excel files are saved in standard XLSX format instead of legacy XLS.' },
                      { label: 'Image OCR text is scrambled', sol: 'Image resolution must be at least 150 DPI for the Tesseract OCR engine to parse characters correctly. Crop out dark borders.' }
                    ].map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTroubleSolution(opt.sol)}
                        className="p-4 rounded-xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 text-left text-xs text-slate-300"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* AI stage */}
              {troubleStage === 'ai' && (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h4 className="text-sm font-bold text-slate-200">Select the AI query warning:</h4>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Docky assistant gives empty summaries', sol: 'Verify document text length. Docky semantic chunkers require files to contain indexable text layers. Scanned PDFs must run OCR first.' },
                      { label: 'Prompt queries fail to connect', sol: 'Ensure your Supabase PostgreSQL cluster is online. Check database quotas in System Admin Settings.' }
                    ].map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setTroubleSolution(opt.sol)}
                        className="p-4 rounded-xl border border-slate-900 bg-slate-900/20 hover:border-slate-800 text-left text-xs text-slate-300"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Display solution if selected */}
            <AnimatePresence>
              {troubleSolution && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-400 space-y-2 flex items-start gap-3"
                >
                  <Info className="w-5 h-5 shrink-0 text-cyan-400" />
                  <div className="space-y-1">
                    <div className="font-bold text-cyan-200">Recommended Resolution:</div>
                    <p className="leading-relaxed">{troubleSolution}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reset controls */}
            {troubleStage !== 'start' && (
              <div className="pt-6 border-t border-slate-900 mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setTroubleStage('start');
                    setTroubleSolution(null);
                  }}
                  className="px-4 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Back to Start
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Release Highlights Board (Software Versions log) */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Software Release Log</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
              Track recent updates, version logs, and framework deployments for DocMatrix.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { version: 'v1.1.0-prod', date: 'July 10, 2026', title: 'Tesseract Image OCR Workbench', highlights: ['In-browser OCR engine integrations', 'EXIF data metadata viewers', 'Filters & cropped images modules'] },
              { version: 'v1.0.2-prod', date: 'June 18, 2026', title: 'Docky AI Prompts Embedding', highlights: ['Text parser token split chunkers', 'Supabase Vector Database indexes', 'Citations reference cards'] },
              { version: 'v1.0.0-prod', date: 'May 20, 2026', title: 'DocMatrix Platform Launch', highlights: ['Google Drive OAuth mounts', 'PDF Splits & Merges adapters', 'Excel spreadsheet workbenches'] }
            ].map((rel, idx) => (
              <div key={idx} className="p-6 rounded-3xl border border-slate-900 bg-slate-900/10 hover:border-slate-800 transition-all flex flex-col justify-between min-h-[220px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase bg-cyan-950/40 border border-cyan-500/25 px-2 py-0.5 rounded">{rel.version}</span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold"><Clock className="w-3 h-3" /> {rel.date}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">{rel.title}</h4>
                  <ul className="space-y-1.5 text-xs text-slate-400">
                    {rel.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. Live status uptime indicator panel */}
      <section className="py-12 relative border-t border-slate-900 bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-900 flex items-center justify-between flex-wrap gap-4 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>DocMatrix Global Operations Status:</span>
              <span className="text-cyan-400 uppercase tracking-widest font-mono">ALL SYSTEMS OPERATIONAL</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span>FastAPI API Gateway: <span className="text-slate-200">12ms</span></span>
              <span>PostgreSQL Cluster: <span className="text-slate-200">99.98%</span></span>
              <span>OAuth Token Service: <span className="text-slate-200">ONLINE</span></span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Interactive Contact/Feedback Form */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-2xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Get in touch
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Open Support Request</h2>
            <p className="text-slate-400 text-sm md:text-base">
              Submit feedback or report platform warning logs directly to our diagnostics team.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleFeedbackSubmit} className="space-y-5 bg-slate-900/10 border border-slate-900 p-6 md:p-8 rounded-3xl relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={feedbackForm.name}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/25"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={feedbackForm.email}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/25"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Inquiry Category</label>
              <select
                value={feedbackForm.category}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-400/50"
              >
                <option value="general">General Support</option>
                <option value="storage">Storage Mounting Issues</option>
                <option value="viewer">Viewer / Workbench Errors</option>
                <option value="ai">Docky AI Prompts Queries</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detailed Message / Log Warning</label>
              <textarea
                rows={4}
                required
                placeholder="Include error codes or outline the issue..."
                value={feedbackForm.msg}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, msg: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/25"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={feedbackStatus === 'submitting'}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-900/20 disabled:opacity-50"
              >
                {feedbackStatus === 'submitting' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Submit Ticket Request <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Simulated success popup overlay */}
            <AnimatePresence>
              {feedbackStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center space-y-4 border border-cyan-500/20 z-20"
                >
                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-100">Ticket Submitted Successfully</h4>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    Our diagnostics team has initialized inquiry <span className="text-cyan-400 font-bold font-mono">#DM-8409</span>. A diagnostic notification has been queued to your corporate email.
                  </p>
                  <button
                    onClick={resetFeedbackForm}
                    className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all"
                  >
                    Close Form
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

        </div>
      </section>
    </PublicLayout>
  );
}
