import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { 
  Search, Menu, X, ArrowUpRight, Github, Twitter, Linkedin, 
  Check, Send, Shield, Zap, Sparkles, FileText, ArrowRight 
} from 'lucide-react';
import logo from '../../assets/Logo_DocMatrix.png';

export default function PublicLayout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('idle'); // 'idle' | 'submitting' | 'success'

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Track scroll position for header glassmorphism intensity
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset scroll on navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMobileMenuOpen(false);
    setSearchQuery('');
    setSearchFocused(false);
  }, [pathname]);

  const navLinks = [
    { name: 'Features', path: '/features' },
    { name: 'About', path: '/about' },
    { name: 'Data', path: '/data' },
    { name: 'Docs', path: '/docs' },
    { name: 'Support', path: '/support' }
  ];

  const searchSuggestions = [
    { title: 'Connecting Google Drive', category: 'Guides', path: '/support' },
    { title: 'AI Assistant (Docky) Custom Prompts', category: 'Docs', path: '/docs' },
    { title: 'Supported File Types & Workbenches', category: 'Data', path: '/data' },
    { title: 'PDF Power Tools: Merge & Extract', category: 'Features', path: '/features' },
    { title: 'Workspace Architecture Overview', category: 'About', path: '/about' }
  ];

  const filteredSuggestions = searchQuery 
    ? searchSuggestions.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchSuggestions;

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus('submitting');
    setTimeout(() => {
      setNewsletterStatus('success');
      setNewsletterEmail('');
    }, 1500);
  };

  return (
    <div 
      className="min-h-screen text-slate-100 flex flex-col relative overflow-hidden bg-slate-950 selection:bg-cyan-500/30 selection:text-cyan-200"
      style={{ fontFamily: 'Space Grotesk, Manrope, Segoe UI, sans-serif' }}
    >
      {/* Cinematic Grid and Mesh Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Animated ambient mesh gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] mix-blend-screen animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-950/15 blur-[150px] mix-blend-screen animate-pulse duration-[12000ms]" />
        <div className="absolute top-[30%] left-[25%] w-[40%] h-[40%] rounded-full bg-indigo-950/10 blur-[100px] mix-blend-screen" />
        
        {/* Fine background grid */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(to right, #0891b2 1px, transparent 1px), linear-gradient(to bottom, #0891b2 1px, transparent 1px)`,
            backgroundSize: '128px 128px'
          }}
        />
      </div>

      {/* Floating scroll progress indicator */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Glassmorphic Navbar */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled 
          ? 'bg-slate-950/75 border-b border-cyan-500/10 backdrop-blur-xl py-3 shadow-[0_10px_30px_-10px_rgba(2,12,27,0.7)]' 
          : 'bg-transparent border-b border-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/login" className="flex items-center gap-3 relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-300" />
            <img 
              src={logo} 
              alt="DocMatrix Logo" 
              className="h-10 md:h-12 w-auto relative object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm">
            {navLinks.map((link) => {
              const active = pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative px-4 py-2 rounded-full text-[15px] font-medium tracking-wide transition-all duration-300 ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {active && (
                    <motion.span 
                      layoutId="navBubble" 
                      className="absolute inset-0 bg-cyan-400/10 border border-cyan-400/20 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="hidden lg:flex items-center gap-4">
            
            {/* Search Input Box */}
            <div className="relative">
              <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border bg-slate-900/60 transition-all duration-300 ${
                searchFocused 
                  ? 'border-cyan-400/50 w-72 shadow-[0_0_15px_rgba(34,211,238,0.1)] ring-1 ring-cyan-400/25' 
                  : 'border-slate-800 w-52 hover:border-slate-700'
              }`}>
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Quick search docs/features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="bg-transparent text-sm w-full text-slate-200 placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Autocomplete Search suggestions */}
              <AnimatePresence>
                {searchFocused && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-3 w-80 bg-slate-950/95 border border-cyan-500/20 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500" />
                    <div className="text-[11px] font-bold text-cyan-400/80 uppercase tracking-wider mb-2">Suggested Results</div>
                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => navigate(item.path)}
                            className="flex flex-col p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors group"
                          >
                            <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex items-center justify-between">
                              {item.title}
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-cyan-400" />
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{item.category}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-500">No suggestions found</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Admin Bypass Link */}
            <Link
              to="/admin/login"
              className="text-sm font-medium px-4 py-2 rounded-full border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900 hover:border-slate-700 transition-all"
            >
              Admin
            </Link>

            {/* Sign Up CTA */}
            <Link
              to="/register"
              className="relative group overflow-hidden px-5 py-2 rounded-full font-semibold text-sm transition-all"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 rounded-full" />
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative text-white flex items-center gap-1">
                Sign Up <Sparkles className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-900 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-slate-400" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden absolute top-full left-0 right-0 bg-slate-950 border-b border-cyan-500/10 backdrop-blur-2xl shadow-xl z-30 animate-none"
            >
              <div className="px-5 py-6 space-y-4 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    className="text-lg font-medium text-slate-300 hover:text-cyan-400 py-1 transition-colors border-b border-slate-900/50"
                  >
                    {link.name}
                  </Link>
                ))}
                
                {/* Search suggestion mockup in mobile */}
                <div className="pt-2 relative">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search features..."
                      className="bg-transparent text-sm w-full text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Link
                    to="/admin/login"
                    className="flex-1 text-center py-2.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 transition-all font-semibold"
                  >
                    Admin
                  </Link>
                  <Link
                    to="/register"
                    className="flex-1 text-center py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-900/30"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow z-10 pt-20 md:pt-24">
        {children}
      </main>

      {/* Reusable Premium Footer */}
      <footer className="relative bg-slate-950/80 border-t border-cyan-500/10 z-10 pt-20 pb-10 overflow-hidden">
        {/* Glow behind footer */}
        <div className="absolute bottom-0 left-[20%] right-[20%] h-32 bg-cyan-500/5 rounded-full blur-[80px]" />
        
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 pb-16">
            
            {/* Logo and Brand Column */}
            <div className="lg:col-span-2 space-y-6">
              <Link to="/login" className="flex items-center gap-3">
                <img src={logo} alt="DocMatrix Logo" className="h-10 w-auto object-contain" />
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                Next-generation secure enterprise document orchestration platform. Manage, process, view, and query your files directly from your personal storage hubs with AI-guided assistance.
              </p>
              
              {/* Dynamic Badges */}
              <div className="flex items-center gap-3 pt-2">
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-950/50 border border-cyan-500/25 text-cyan-400">
                  <Shield className="w-3.5 h-3.5" /> Google OAuth Verified
                </span>
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-950/50 border border-blue-500/25 text-blue-400">
                  <Zap className="w-3.5 h-3.5" /> High Performance
                </span>
              </div>
            </div>

            {/* Site Directory Links */}
            <div>
              <h4 className="text-slate-200 font-bold uppercase tracking-wider text-xs mb-5">Product</h4>
              <ul className="space-y-3 text-sm">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link to={link.path} className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 group">
                      {link.name}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 transition-all" />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/login" className="text-slate-400 hover:text-cyan-400 transition-colors">Sign In</Link>
                </li>
              </ul>
            </div>

            {/* Help & Support Directory */}
            <div>
              <h4 className="text-slate-200 font-bold uppercase tracking-wider text-xs mb-5">Resources</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li>
                  <Link to="/docs" className="hover:text-cyan-400 transition-colors">Virtual Mounting Guide</Link>
                </li>
                <li>
                  <Link to="/docs" className="hover:text-cyan-400 transition-colors">AI Prompts Framework</Link>
                </li>
                <li>
                  <Link to="/support" className="hover:text-cyan-400 transition-colors">Platform Status</Link>
                </li>
                <li>
                  <Link to="/admin/login" className="hover:text-cyan-400 transition-colors">Developer Portal</Link>
                </li>
              </ul>
            </div>

            {/* Newsletter Subscription column with status updates */}
            <div className="space-y-5">
              <h4 className="text-slate-200 font-bold uppercase tracking-wider text-xs mb-2">Subscribe to Updates</h4>
              <p className="text-slate-400 text-xs leading-normal">
                Receive the latest engineering highlights, release logs, and security advisories.
              </p>
              
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 focus-within:border-cyan-400/50 transition-all duration-300">
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    disabled={newsletterStatus === 'submitting' || newsletterStatus === 'success'}
                    className="bg-transparent pl-2.5 py-1 text-xs w-full text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'submitting' || newsletterStatus === 'success'}
                    className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {newsletterStatus === 'submitting' ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : newsletterStatus === 'success' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                
                {/* Visual success alert */}
                <AnimatePresence>
                  {newsletterStatus === 'success' && (
                    <motion.p 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[11px] text-cyan-400 flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" /> Successfully subscribed!
                    </motion.p>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </div>

          {/* Social Links & Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-slate-900 text-slate-500 text-xs">
            <div>
              © 2026 DocMatrix Inc. Platform engineered with zero-data retention pipelines.
            </div>
            
            {/* Hover Magnetic icons */}
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 rounded-full border border-slate-900 hover:border-slate-700 hover:text-white transition-all hover:scale-110">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-full border border-slate-900 hover:border-slate-700 hover:text-white transition-all hover:scale-110">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="p-2 rounded-full border border-slate-900 hover:border-slate-700 hover:text-white transition-all hover:scale-110">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
