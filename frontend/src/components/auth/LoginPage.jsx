/**
 * Login Page Component
 * Clean, professional login interface
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/Logo_DocMatrix.png';
import { validateAdminLogin, isAdminAuthenticated } from '../admin/adminAuth';
import { 
  Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, FileText,
  Cloud, Search, ChevronRight, User
} from 'lucide-react';


export default function LoginPage() {
  const navigate = useNavigate();
  const { state, actions } = useAuth();
  const { isAuthenticated, isLoading, error } = state;
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate('/admin/mission-control', { replace: true });
      return;
    }

    if (isAuthenticated) {
      navigate('/drive-setup', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) actions.clearError();
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (validateAdminLogin(formData.email, formData.password)) {
      setIsSubmitting(false);
      navigate('/admin/mission-control', { replace: true });
      return;
    }
    
    const result = await actions.login(formData.email, formData.password);
    
    setIsSubmitting(false);
    
    if (result.success) {
      navigate('/drive-setup');
    }
  };

  const goToAdminLogin = (event) => {
    if (event?.preventDefault) event.preventDefault();
    navigate('/admin/login');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-900">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700 font-sans"
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-cyan-100/20 bg-blue-950/75 backdrop-blur-xl h-16 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center flex-shrink-0">
            <img
              src={logo}
              alt="DocMatrix"
              className="w-28 sm:w-32 h-auto object-contain"
            />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
              <Link className="px-3 py-1.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/login">Home</Link>
              <Link className="px-3 py-1.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/features">Features</Link>
              <Link className="px-3 py-1.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/about">About</Link>
              <Link className="px-3 py-1.5 hidden lg:block rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/data">Data</Link>
              <Link className="px-3 py-1.5 hidden lg:block rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/docs">Docs</Link>
              <Link className="px-3 py-1.5 hidden lg:block rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/support">Support</Link>
              <button
                type="button"
                onClick={goToAdminLogin}
                className="px-3 py-1.5 rounded-lg bg-cyan-400/20 text-cyan-100 hover:bg-cyan-300/25 hover:text-white transition-colors ml-1"
              >
                Admin
              </button>
            </nav>

            <div className="hidden xl:flex items-center relative w-48 ml-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/75" />
              <input
                type="text"
                placeholder="Search files"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-blue-900/45 border border-cyan-100/25 text-cyan-50 placeholder-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 text-xs"
              />
            </div>

            <Link
              to="/register"
              className="flex-shrink-0 ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-xs font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-900/35"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Panel - Branding */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 px-4">
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-cyan-100">
              Enterprise Document
              <br />
              Management System
            </h1>

            <div className="flex justify-start">
              <img
                src="/docky-avatar.png"
                alt="Docky Agent"
                className="w-48 xl:w-56 h-auto object-contain drop-shadow-xl"
              />
            </div>

            <div className="space-y-3">
              <FeatureItem 
                icon={<Cloud className="w-4 h-4" />}
                title="Bring Your Own Storage"
                description="Connect your Google Drive for secure, private storage"
              />
              <FeatureItem 
                icon={<FileText className="w-4 h-4" />}
                title="AI-Powered Tools"
                description="Smart document processing and organization"
              />
            </div>
            
            <div className="text-slate-400/80 text-xs pt-2">
              © 2024 DocMatrix. All rights reserved.
            </div>
          </div>
          
          {/* Right Panel - Login Form */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="w-full max-w-[280px] sm:max-w-sm relative">
              {/* Card */}
              <div className="bg-blue-900/85 backdrop-blur-2xl rounded-2xl p-5 sm:p-8 border border-cyan-200/30 shadow-[0_20px_50px_rgba(4,18,50,0.5)]">
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-cyan-50">Welcome</h2>
                  <p className="text-cyan-100/80 mt-1.5 text-xs sm:text-sm">Sign in to your account</p>
                  <div className="flex justify-center mt-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-200/90 rounded-full flex items-center justify-center overflow-hidden shadow-sm">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Error Alert */}
                {error && (
                  <div className="max-w-[280px] mx-auto mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{error}</span>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4 max-w-[280px] mx-auto">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-100/95 mb-1">
                      Email or Admin ID
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type="text"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-blue-950/60 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-xs sm:text-sm"
                        placeholder="you@example.com or DOCMATRIX-OMEGA"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-cyan-100/95 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full pl-9 pr-9 py-2 bg-blue-950/60 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-xs sm:text-sm"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-200/70 hover:text-cyan-100"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-cyan-100/50 bg-blue-950/45 text-cyan-400 focus:ring-cyan-400 focus:ring-offset-0"
                      />
                      <span className="text-xs text-cyan-100/80">Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-900/35"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Sign in
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                
                {/* Register Link */}
                <p className="mt-5 text-center text-slate-300 text-xs sm:text-sm">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-cyan-300 hover:text-cyan-200 font-semibold"
                  >
                    Create account
                  </Link>
                </p>

                <p className="mt-1.5 text-center text-slate-300 text-xs">
                  Need admin mission control?{' '}
                  <Link
                    to="/admin/login"
                    onClick={goToAdminLogin}
                    className="text-blue-300 hover:text-blue-200 font-semibold"
                  >
                    Use special admin login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-9 h-9 bg-sky-200/10 border border-cyan-200/20 rounded-lg flex items-center justify-center text-cyan-200 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="text-slate-100 text-sm font-bold tracking-tight">{title}</h3>
        <p className="text-slate-300 text-xs font-normal leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
