import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cloud, HardDrive, FileText, Search, Database, ShieldAlert, 
  Terminal, Sparkles, Play, Plus, Trash2, Cpu, CheckCircle2, 
  ArrowRight, Activity, BarChart2, Lock, Shuffle, Compass
} from 'lucide-react';
import PublicLayout from './PublicLayout';

export default function FeaturesPage() {
  // States for interactive sections
  const [activeTab, setActiveTab] = useState('pdf');
  const [cloudStatus, setCloudStatus] = useState({ drive: true, local: true, mega: false });
  const [chatPrompts, setChatPrompts] = useState([
    { id: 1, label: 'Summarize NDA Agreement', text: 'Analyze the loaded Non-Disclosure Agreement and highlight standard exclusions and liabilities.' },
    { id: 2, label: 'Identify Compliance Risks', text: 'Scan the terms of service document for auto-renewal clauses, cancellation penalties, and governing law.' },
    { id: 3, label: 'List Storage Distribution', text: 'Calculate the total file counts and disk space usage across my Google Drive and MEGA mounts.' }
  ]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'assistant', text: 'Hello! I am Docky, your DocMatrix AI Agent. Pick one of the actions above or query me about your virtual storage documents.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Statistics counters (scroll-triggered mocks)
  const [counters, setCounters] = useState({ files: 0, speed: 0, uptime: 0 });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 1500) {
        setCounters({ files: 1420950, speed: 99.4, uptime: 99.99 });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Trigger Mock AI Chat stream
  const triggerChat = (prompt) => {
    if (isTyping) return;
    setSelectedPrompt(prompt.id);
    
    // Add user message
    const newMessages = [...chatMessages, { sender: 'user', text: prompt.text }];
    setChatMessages(newMessages);
    setIsTyping(true);

    // AI Response text map
    const responseMap = {
      1: "### NDA Agreement Analysis Summary\n\n- **Exclusions**: standard trade secrets, public information, and independent discovery are excluded from confidentiality obligations.\n- **Governing Law**: State of New York.\n- **Indemnity**: Section 12 outlines liabilities capped at **$50,000**.\n- **Recommendation**: Ensure the term of confidentiality is reduced from 5 years to 3 years to align with company guidelines.",
      2: "### Compliance Warning & Risks Detected\n\n1. **Auto-Renewal Clause**: Found in Section 4.2. Agreement auto-renews unless written notice is given **60 days prior** to termination.\n2. **Arbitration Rules**: Section 9.1 mandates binding arbitration in Delaware. Wave of class-action rights detected.\n3. **Cancellation Penalty**: Early exit fee equals 3 months of recurring platform costs.",
      3: "### Storage & File Space Analytics\n\n| Mount Location | Total Files | Disk Size | Status | Connected Account |\n| :--- | :--- | :--- | :--- | :--- |\n| **Google Drive** | 1,248 | 14.8 GB | Active | dev@docmatrix.io |\n| **Local Ingest** | 412 | 8.2 GB | Active | System (Root) |\n| **MEGA Cloud** | 0 | 0.0 GB | Mounted (Empty) | cloud@docmatrix.io |\n\n*System Recommendation: Connect MEGA cloud token to initiate folder sync.*"
    };

    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'assistant', text: responseMap[prompt.id] }]);
      setIsTyping(false);
    }, 2000);
  };

  // PDF splits simulator state
  const [pdfPages, setPdfPages] = useState([
    { id: 1, label: 'Page 1 - Cover Sheet' },
    { id: 2, label: 'Page 2 - Terms & Conditions' },
    { id: 3, label: 'Page 3 - Signatures' },
    { id: 4, label: 'Page 4 - Annex A' }
  ]);
  const [pdfActionMsg, setPdfActionMsg] = useState('');

  const deletePdfPage = (id) => {
    setPdfPages(prev => prev.filter(p => p.id !== id));
    setPdfActionMsg('Page successfully excluded from export bundle.');
    setTimeout(() => setPdfActionMsg(''), 3000);
  };

  return (
    <PublicLayout>
      {/* 1. Cinematic Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-12 pb-20 overflow-hidden">
        {/* Glow rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full border border-cyan-500/10 blur-xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full border border-blue-500/10 blur-2xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-5 md:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Tag Badge */}
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-cyan-950/40 border border-cyan-400/30 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" /> Feature Architecture Release
            </span>

            {/* Main Premium Typography */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mx-auto">
              The Unified <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent">Document Workspace</span> for Modern Teams
            </h1>

            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
              Consolidate your distributed cloud drives into a single virtual filesystem. View, audit, and analyze files with intelligent AI power tools without syncing duplicate copies.
            </p>

            {/* Interaction CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <a
                href="#interactive-demo"
                className="px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold transition-all shadow-lg shadow-cyan-950/40 flex items-center gap-2"
              >
                Launch Sandbox Playground <Play className="w-4 h-4 fill-white" />
              </a>
              <a
                href="#features-matrix"
                className="px-8 py-3.5 rounded-full border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 transition-all font-semibold"
              >
                Explore Modules
              </a>
            </div>
          </motion.div>

          {/* Floating Product Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 50 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="mt-16 relative mx-auto max-w-5xl rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-3 shadow-[0_30px_100px_rgba(6,182,212,0.15)]"
          >
            {/* Top Toolbar panel */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 rounded-2xl border border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="text-slate-500 text-xs font-semibold font-mono ml-3">docmatrix.cloud/workspace</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">Storage Mounted</span>
              </div>
            </div>

            {/* Virtual Explorer mockup layout */}
            <div className="grid grid-cols-12 gap-4 h-[350px] md:h-[450px]">
              {/* Fake Sidebar */}
              <div className="col-span-3 bg-slate-900/40 border border-slate-900 rounded-2xl p-4 hidden md:flex flex-col gap-4">
                <div className="h-6 w-24 bg-slate-800 rounded-lg" />
                <div className="space-y-2 mt-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-7 w-full bg-slate-800/50 rounded-lg flex items-center px-3 gap-2">
                      <span className="w-2.5 h-2.5 rounded bg-cyan-400/40" />
                      <span className="h-2 w-16 bg-slate-700 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Fake Grid */}
              <div className="col-span-12 md:col-span-9 bg-slate-900/20 border border-slate-900 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                  <div className="h-4 w-36 bg-slate-800 rounded" />
                  <div className="h-4 w-12 bg-slate-800 rounded" />
                </div>
                
                {/* Mock File Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-grow pt-6 content-start">
                  {[
                    { name: 'Legal_NDA_2026.pdf', size: '1.2 MB', icon: 'file' },
                    { name: 'Financial_Q3.xlsx', size: '4.8 MB', icon: 'sheet' },
                    { name: 'Architecture_Plan.png', size: '12.4 MB', icon: 'image' },
                    { name: 'Deployment_Spec.docx', size: '840 KB', icon: 'file' },
                    { name: 'Compliance_Review.pdf', size: '3.1 MB', icon: 'file' },
                    { name: 'User_Telemetry.csv', size: '2.5 MB', icon: 'sheet' }
                  ].map((file, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex items-start gap-3 hover:border-cyan-500/30 hover:bg-slate-900/40 transition-all cursor-pointer group">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg group-hover:border-cyan-500/20">
                        <FileText className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        <p className="text-xs font-semibold text-slate-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{file.size}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-8 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center px-4 justify-between mt-4">
                  <span className="text-[10px] text-slate-500 font-mono">6 files mounted from Google Drive</span>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Interactive Storage Connector Sandbox */}
      <section id="interactive-demo" className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Interactive sandbox
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Ingestion & Cloud Storage Mount Center
            </h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              Simulate mounting external storage providers. Toggle connections to watch DocMatrix integrate them securely into the virtual filesystem.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Connectors Config */}
            <div className="lg:col-span-5 space-y-5">
              {[
                { key: 'drive', name: 'Google Drive Account', desc: 'Secure OAuth-verified file read API client.', icon: Cloud, color: 'text-yellow-400 bg-yellow-500/5 border-yellow-500/20' },
                { key: 'local', name: 'Local File Directory', desc: 'Ingest direct uploads into browser session sandbox.', icon: HardDrive, color: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/20' },
                { key: 'mega', name: 'MEGA Account Mount', desc: 'Advanced zero-knowledge encrypted cloud storage API.', icon: Database, color: 'text-red-400 bg-red-500/5 border-red-500/20' }
              ].map(mount => {
                const Icon = mount.icon;
                const active = cloudStatus[mount.key];
                return (
                  <div 
                    key={mount.key}
                    className={`p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                      active ? 'bg-slate-900 border-cyan-500/25 shadow-lg' : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl border ${mount.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-200">{mount.name}</h4>
                        <p className="text-[11px] text-slate-500 leading-tight max-w-[200px]">{mount.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setCloudStatus(prev => ({ ...prev, [mount.key]: !prev[mount.key] }))}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        active 
                          ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30' 
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {active ? 'Connected' : 'Mount Cloud'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right Connection Flow Tunnel */}
            <div className="lg:col-span-7 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 md:p-8 relative min-h-[380px] flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Mount Pipeline Diagnostics</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>

              {/* Ingestion Visual Tunnel Flow */}
              <div className="relative flex items-center justify-between py-12 px-6">
                
                {/* Providers Column */}
                <div className="flex flex-col gap-6 relative z-10">
                  {['drive', 'local', 'mega'].map((prov, i) => {
                    const active = cloudStatus[prov];
                    return (
                      <motion.div 
                        key={prov}
                        animate={{ 
                          scale: active ? 1.05 : 0.95,
                          opacity: active ? 1 : 0.4
                        }}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border relative ${
                          active ? 'bg-slate-900 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-slate-950 border-slate-900 text-slate-600'
                        }`}
                      >
                        {prov === 'drive' ? <Cloud className="w-5 h-5" /> : prov === 'local' ? <HardDrive className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                        
                        {/* Animated signal dots heading to DocMatrix */}
                        {active && (
                          <motion.div 
                            initial={{ x: 0, opacity: 0.8 }}
                            animate={{ x: 200, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear', delay: i * 0.4 }}
                            className="absolute left-full w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] top-1/2 -translate-y-1/2"
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Processing Core node */}
                <div className="w-[1px] h-32 bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent absolute left-20 top-1/2 -translate-y-1/2 hidden md:block" />

                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-full border border-cyan-500/20 bg-slate-950 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.1)] relative">
                    <div className="absolute inset-2 rounded-full border border-dashed border-cyan-400/30 animate-spin" style={{ animationDuration: '10s' }} />
                    <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-400">DOCMATRIX SYSTEM</span>
                </div>
              </div>

              {/* Status Message logger */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-900/60 font-mono text-[11px] space-y-1 text-slate-400">
                <div className="text-cyan-400 font-bold">&gt; pipeline initialized.</div>
                <div>Connected mounts: {Object.keys(cloudStatus).filter(k => cloudStatus[k]).map(k => k.toUpperCase()).join(', ') || 'NONE'}</div>
                <div className="text-slate-500">Virtual disk mounted: {Object.keys(cloudStatus).filter(k => cloudStatus[k]).length * 10}GB total storage synchronized.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Document Power Tools Showcase (Interactive Tab System) */}
      <section className="py-24 relative bg-slate-950/50 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Content info */}
            <div className="lg:col-span-5 space-y-6">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/50 border border-blue-500/25 text-blue-400">
                Built-in Workbenches
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                No External Downloads. <br />
                All Power Tools Included.
              </h2>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                DocMatrix mounts file workbenches inside the browser. Split PDFs, compile Word document variables, format Excel rows, and edit images without leaving your workspace.
              </p>

              {/* Tab options selector */}
              <div className="flex flex-col gap-2 pt-4">
                {[
                  { key: 'pdf', title: 'PDF Power Tools', desc: 'Split, extract, merge pages instantly.' },
                  { key: 'word', title: 'Word Variables Composer', desc: 'Auto-compile templates dynamically.' },
                  { key: 'excel', title: 'Excel Sheets Workbench', desc: 'Formula editor & CSV data conversions.' },
                  { key: 'image', title: 'Image Workbench & OCR', desc: 'Crop, filter, and extract OCR metadata.' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                      activeTab === tab.key 
                        ? 'bg-slate-900 border-cyan-500/30 text-white shadow-md' 
                        : 'bg-slate-950/20 border-slate-900/60 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div>
                      <h4 className={`text-sm font-bold transition-colors ${activeTab === tab.key ? 'text-cyan-400' : 'text-slate-300 group-hover:text-white'}`}>{tab.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{tab.desc}</p>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-all ${activeTab === tab.key ? 'text-cyan-400 translate-x-1' : 'text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Sandbox Container */}
            <div className="lg:col-span-7 bg-slate-900/30 border border-cyan-500/10 rounded-3xl p-6 relative shadow-2xl min-h-[460px]">
              <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
              
              <AnimatePresence mode="wait">
                {/* PDF Power tools simulator */}
                {activeTab === 'pdf' && (
                  <motion.div
                    key="pdf"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                      <span className="text-xs font-bold text-slate-300">PDF Workbench: Split Spec.pdf</span>
                      <span className="text-[10px] text-slate-500">4 total pages loaded</span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Click the trash icon to exclude pages from the compilation output bundle.
                    </p>

                    <div className="grid grid-cols-2 gap-4 py-2">
                      {pdfPages.map(page => (
                        <div key={page.id} className="p-4 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-cyan-400" />
                            <span className="text-xs font-bold text-slate-300">{page.label}</span>
                          </div>
                          <button 
                            onClick={() => deletePdfPage(page.id)}
                            className="p-1.5 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {pdfActionMsg && (
                      <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-xs text-cyan-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {pdfActionMsg}
                      </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-900">
                      <button 
                        onClick={() => {
                          setPdfPages([
                            { id: 1, label: 'Page 1 - Cover Sheet' },
                            { id: 2, label: 'Page 2 - Terms & Conditions' },
                            { id: 3, label: 'Page 3 - Signatures' },
                            { id: 4, label: 'Page 4 - Annex A' }
                          ]);
                          setPdfActionMsg('Bundle reset back to standard 4 pages.');
                          setTimeout(() => setPdfActionMsg(''), 3000);
                        }}
                        className="px-4 py-2 text-xs text-slate-400 hover:text-white mr-4"
                      >
                        Reset Bundle
                      </button>
                      <button 
                        onClick={() => {
                          setPdfActionMsg(`Export started! Compiling ${pdfPages.length} pages into DocMatrix_Export.pdf.`);
                          setTimeout(() => setPdfActionMsg(''), 4000);
                        }}
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold font-semibold transition-all shadow-md shadow-cyan-900/30"
                      >
                        Compile & Export
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Word variables composer simulator */}
                {activeTab === 'word' && (
                  <motion.div
                    key="word"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                      <span className="text-xs font-bold text-slate-300">Word Composer: Proposal_Draft.docx</span>
                      <span className="text-[10px] text-yellow-500">2 Variables Found</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Client Name Variable</label>
                        <input
                          type="text"
                          defaultValue="Acme Corporation"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Effective Date</label>
                        <input
                          type="text"
                          defaultValue="July 12, 2026"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-900 text-xs text-slate-400 space-y-2">
                      <div className="font-bold text-slate-300">Compiled Output Preview:</div>
                      <p className="italic font-serif text-slate-400">
                        "This agreement is made effective as of <span className="text-cyan-400 font-sans font-bold">July 12, 2026</span> by and between DocMatrix Inc. and <span className="text-cyan-400 font-sans font-bold">Acme Corporation</span>..."
                      </p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-900">
                      <button 
                        onClick={() => alert('Variable values compiled into DOCX metadata.')}
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
                      >
                        Compile Proposal
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Excel sheets workbench simulator */}
                {activeTab === 'excel' && (
                  <motion.div
                    key="excel"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                      <span className="text-xs font-bold text-slate-300">Sheets Workbench: Financials.xlsx</span>
                      <span className="text-[10px] text-green-500">Auto Formula Active</span>
                    </div>

                    {/* Simple spreadsheet table mockup */}
                    <div className="border border-slate-900 rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-4 bg-slate-950 text-slate-400 font-bold border-b border-slate-900 p-2">
                        <div>Month</div>
                        <div>Revenue</div>
                        <div>Expenses</div>
                        <div>Profit</div>
                      </div>
                      {[
                        { month: 'January', rev: '$12,000', exp: '$8,400', prof: '$3,600' },
                        { month: 'February', rev: '$15,500', exp: '$9,200', prof: '$6,300' },
                        { month: 'March', rev: '$18,100', exp: '$10,100', prof: '$8,000' }
                      ].map((row, i) => (
                        <div key={i} className="grid grid-cols-4 border-b border-slate-900/50 p-2 text-slate-300 hover:bg-slate-900/20">
                          <div>{row.month}</div>
                          <div>{row.rev}</div>
                          <div>{row.exp}</div>
                          <div className="text-cyan-400 font-semibold">{row.prof}</div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-500">Formula cell D5:</span>
                      <code className="text-cyan-400 font-bold">=SUM(D2:D4)</code>
                      <span className="text-slate-200 font-bold">$17,900 Profit Total</span>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-900">
                      <button 
                        onClick={() => alert('Data compiled and CSV version cached.')}
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
                      >
                        Convert CSV
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Image tools and OCR simulation */}
                {activeTab === 'image' && (
                  <motion.div
                    key="image"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                      <span className="text-xs font-bold text-slate-300">Image OCR Workbench: Invoice_04.jpg</span>
                      <span className="text-[10px] text-cyan-400">Tesseract engine mounted</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="relative rounded-xl border border-slate-800 overflow-hidden bg-slate-950 aspect-video flex items-center justify-center p-2">
                        <img 
                          src="https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=400&q=80" 
                          alt="Invoice mockup" 
                          className="w-full h-full object-cover opacity-60 rounded-lg"
                        />
                        {/* Overlaying green bounding box to mock OCR parsing */}
                        <div className="absolute top-[30%] left-[20%] w-[60%] h-8 border-2 border-dashed border-cyan-400 bg-cyan-400/10 rounded flex items-center justify-center">
                          <span className="text-[9px] font-mono text-cyan-200 font-bold uppercase tracking-widest animate-pulse">Extracting metadata</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-2 h-full flex flex-col justify-center">
                        <div className="text-[10px] font-bold text-cyan-400/80 uppercase">Extracted Values</div>
                        <div className="space-y-1 text-xs">
                          <div><span className="text-slate-500">Invoice No:</span> <span className="text-slate-300 font-mono">INV-84095</span></div>
                          <div><span className="text-slate-500">Issue Date:</span> <span className="text-slate-300 font-mono">06/25/2026</span></div>
                          <div><span className="text-slate-500">Grand Total:</span> <span className="text-cyan-400 font-bold font-mono">$1,450.00</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-900">
                      <button 
                        onClick={() => alert('Extracted metadata mapped to database records.')}
                        className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all"
                      >
                        Map Metadata Fields
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive "Docky AI" Chat Mockup */}
      <section className="py-24 relative border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Meet Docky Assistant
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              AI-Powered File Querying
            </h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              Docky indices all mounted files. Click one of the standard prompts below to query Docky and review its structural responses.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Prompts Side Column */}
            <div className="lg:col-span-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Suggested Inquiries</h4>
              <div className="flex flex-col gap-2">
                {chatPrompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => triggerChat(prompt)}
                    disabled={isTyping}
                    className={`p-4 rounded-2xl border text-left text-xs font-semibold transition-all duration-300 flex items-center justify-between ${
                      selectedPrompt === prompt.id 
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 ring-1 ring-cyan-500/20' 
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{prompt.label}</span>
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Box panel */}
            <div className="lg:col-span-8 bg-slate-900/30 border border-slate-900 rounded-3xl p-5 md:p-6 relative flex flex-col justify-between min-h-[420px] shadow-2xl">
              
              {/* Box header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-900 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white">
                  D
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Docky Agent Workspace</h4>
                  <span className="text-[9px] text-cyan-400 font-mono tracking-wider font-semibold">ONLINE • READY</span>
                </div>
              </div>

              {/* Chat bubbles list */}
              <div className="flex-grow space-y-4 overflow-y-auto max-h-[300px] mb-4 pr-2">
                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`p-4 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-cyan-500 text-slate-950 font-bold rounded-tr-none' 
                        : 'bg-slate-950 border border-slate-900 text-slate-300 rounded-tl-none font-medium'
                    }`}>
                      {msg.sender === 'assistant' ? (
                        <div className="markdown-body space-y-2 whitespace-pre-line">
                          {msg.text}
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900 text-slate-500 text-xs rounded-tl-none flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '400ms' }} />
                      </div>
                      <span>Docky is checking your mounted files...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-slate-900 my-2" />
              <div className="text-[10px] text-slate-500 font-mono text-center">
                Query actions are executed in zero-data retention workers in real-time.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Statistics & Counters (incrementing on scroll) */}
      <section className="py-20 relative bg-slate-950 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            
            <div className="space-y-2 p-6 rounded-2xl bg-slate-900/30 border border-slate-900">
              <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-cyan-400 mb-2">
                <HardDrive className="w-6 h-6" />
              </div>
              <h3 className="text-4xl md:text-5xl font-extrabold font-mono text-cyan-400">
                {counters.files > 0 ? '1,420,950+' : '0'}
              </h3>
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Files Synchronized Safely</p>
              <p className="text-[10px] text-slate-500">Across Google Drive and MEGA cloud mounts.</p>
            </div>

            <div className="space-y-2 p-6 rounded-2xl bg-slate-900/30 border border-slate-900">
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-blue-400 mb-2">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-4xl md:text-5xl font-extrabold font-mono text-slate-100">
                {counters.speed > 0 ? '99.4%' : '0%'}
              </h3>
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">AI Classification Accuracy</p>
              <p className="text-[10px] text-slate-500">Based on OCR layout mapping specifications.</p>
            </div>

            <div className="space-y-2 p-6 rounded-2xl bg-slate-900/30 border border-slate-900">
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-indigo-400 mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-4xl md:text-5xl font-extrabold font-mono text-cyan-400">
                {counters.uptime > 0 ? '99.99%' : '0%'}
              </h3>
              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">System Telemetry Uptime</p>
              <p className="text-[10px] text-slate-500">Consistently monitored by status checkpoints.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. System Activity Feed */}
      <section className="py-24 relative">
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
              Audit trails
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Activity Tracking Feed
            </h2>
            <p className="text-slate-400 text-sm md:text-base">
              Explore a visual audit log tracing file actions, security policies, and system updates.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-900">
            
            {[
              { time: '14:20 PM', event: 'Google Drive Mount Initiated', desc: 'Secure OAuth handshake validated. Synchronized 1,248 file nodes.', actor: 'dev@docmatrix.io', icon: Cloud },
              { time: '12:05 PM', event: 'PDF Split Task Completed', desc: 'Pages 1-3 compiled into DocMatrix_NDA.pdf.', actor: 'System Worker #04', icon: FileText },
              { time: '10:42 AM', event: 'New Folder Mount Requested', desc: 'Folder "/MEGA/Billing" mounted successfully.', actor: 'finance@docmatrix.io', icon: HardDrive },
              { time: '09:15 AM', event: 'AI Prompts Index Updated', desc: 'Docky assistant indexes synchronized with Supabase vector store.', actor: 'System Admin', icon: Sparkles }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex gap-6 relative group">
                  
                  {/* Timeline icon */}
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 relative z-10 shrink-0 group-hover:border-cyan-500/30 transition-all">
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Log description */}
                  <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-950/80 hover:border-slate-800 transition-all space-y-2 flex-grow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-sm font-bold text-slate-200">{item.event}</h4>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">{item.time}</span>
                    </div>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-900/50 text-[10px] text-slate-500">
                      <span>Operator: <span className="text-slate-400 font-semibold">{item.actor}</span></span>
                      <span>Verified: SSL SHA-256</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Enterprise Security Callout */}
      <section className="py-24 relative bg-slate-950/40 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="rounded-3xl border border-cyan-500/20 bg-slate-900/30 p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 pointer-events-none" />
            <div className="space-y-4 max-w-xl relative z-10">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Lock className="w-4 h-4" /> Zero-Retention Policy
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Enterprise Privacy Core
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                DocMatrix never caches your files, agreements, spreadsheets, or images. Document parsing and AI querying occur inside memory-only ephemeral worker pods, keeping your data strictly your own.
              </p>
            </div>
            
            <a
              href="/register"
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold transition-all relative z-10 flex items-center gap-2 group whitespace-nowrap shrink-0 shadow-lg shadow-cyan-900/20"
            >
              Get Started Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
