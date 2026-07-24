/**
 * Login Page Component
 * Clean, professional login interface
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/Logo_DocMatrix.png';
import { createAdminSession, validateAdminLogin, isAdminAuthenticated } from '../admin/adminAuth';
import { 
  Mail, Lock, Eye, EyeOff, AlertCircle, Loader2,FileText,
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

    // Allow fixed admin credentials from the standard login form as a shortcut
    // so users are not blocked by email input constraints.
    if (validateAdminLogin(formData.email, formData.password)) {
      createAdminSession();
      setIsSubmitting(false);
      navigate('/admin/mission-control', { replace: true });
      return;
    }
    
    try {
      const result = await actions.login(formData.email, formData.password);
      if (result?.success) {
        navigate('/drive-setup');
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const goToAdminLogin = (event) => {
    if (event?.preventDefault) event.preventDefault();
    navigate('/admin/login');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }
  
  return (
      <div
      className="h-screen overflow-hidden flex bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700"
      style={{ fontFamily: 'Manrope, Space Grotesk, Segoe UI, sans-serif' }}
    >
      <header className="absolute top-0 left-0 right-0 z-20 border-b border-cyan-100/20 bg-blue-950/55 backdrop-blur-xl">
        <div className="w-full h-20 px-5 lg:px-9 flex items-center gap-5">
          <div className="flex items-center">
          <img
            src={logo}
            alt="DocMatrix"
            className="w-32 h-auto object-contain"
          />
        </div>

          <div className="flex-1 flex items-center gap-2">
            <nav className="flex-1 flex items-center justify-center gap-1 text-[15px] font-semibold">
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/login">Home</Link>
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/features">Features</Link>
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/about">About</Link>
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/data">Data</Link>
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/docs">Docs</Link>
              <Link className="min-w-[102px] text-center px-4 py-2 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/support">Support</Link>
              <button
                type="button"
                onClick={goToAdminLogin}
                className="min-w-[102px] text-center px-4 py-2 rounded-lg bg-cyan-400/20 text-cyan-100 hover:bg-cyan-300/25 hover:text-white transition-colors"
              >
                Admin
              </button>
            </nav>

            <div className="hidden xl:flex items-center relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/75" />
              <input
                type="text"
                placeholder="Search files"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-blue-900/45 border border-cyan-100/25 text-cyan-50 placeholder-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 text-sm"
              />
            </div>

            <Link
              to="/register"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-sm font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/35"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <div className="flex w-full max-w-7xl mx-auto h-full pt-16">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between gap-8 pt-10 px-8 pb-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>
        
        {/* Features */}
        <div className="relative w-full max-w-lg mx-auto space-y-5 mt-4">
          <h1 className="text-4xl font-extrabold leading-tight pl-2 tracking-tight text-cyan-100">
            Enterprise Document
            <br />
            Management System
          </h1>

          <div className="flex justify-start -mt-1 -ml-3">
            <img
              src="/docky-avatar.png"
              alt="Docky Agent"
              className="w-full max-w-sm h-auto object-contain"
            />
          </div>

          <div className="space-y-4 pl-2">
            <FeatureItem 
              icon={<Cloud className="w-5 h-5" />}
              title="Bring Your Own Storage"
              description="Connect your Google Drive for secure, private storage"
            />
            <FeatureItem 
              icon={<FileText className="w-5 h-5" />}
              title="AI-Powered Tools"
              description="Smart document processing and organization"
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="relative text-slate-400 text-sm">
          © 2024 DocMatrix. All rights reserved.
        </div>
      </div>
      
        {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-[26rem] relative">
          {/* Card */}
          <div className="relative bg-blue-900/86 backdrop-blur-2xl rounded-2xl p-8 border border-cyan-200/30 shadow-[0_26px_76px_rgba(4,18,50,0.58)]">
              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold tracking-tight text-cyan-50">Welcome</h2>
                <p className="text-cyan-100/85 mt-1.5 text-sm">Sign in to your account</p>
                <div className="flex justify-center mt-6 mb-2">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 transform rotate-3 transition-transform duration-300 hover:rotate-0">
                      <Lock className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                  </div>
                </div>
              </div>
            
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-cyan-100/95 mb-1.5">
                  Email or Admin ID
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600/90" />
                  <input
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-blue-900/55 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-sm"
                    placeholder="you@example.com or DOCMATRIX-OMEGA"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-cyan-100/95 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600/90" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-blue-900/55 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600/90 hover:text-blue-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-cyan-100/50 bg-blue-950/45 text-cyan-300 focus:ring-cyan-300 focus:ring-offset-0"
                  />
                  <span className="text-sm text-cyan-100/88">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-cyan-300 hover:text-cyan-200"
                >
                  Forgot password?
                </Link>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/35"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign in
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            
            {/* Register Link */}
            <p className="mt-6 text-center text-slate-300">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-cyan-300 hover:text-cyan-200 font-semibold"
              >
                Create account
              </Link>
            </p>

            <p className="mt-2 text-center text-slate-300 text-sm">
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
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="w-11 h-11 bg-sky-200/10 border border-cyan-200/20 rounded-lg flex items-center justify-center text-cyan-200 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-slate-100 text-lg font-bold tracking-tight">{title}</h3>
        <p className="text-slate-300 text-base font-semibold leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
