/**
 * Login Page Component
 * Clean, professional login interface
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/Docmatrix_logo.png';
import { createAdminSession, validateAdminLogin, isAdminAuthenticated } from '../admin/adminAuth';
import { 
  Mail, Lock, Eye, EyeOff, AlertCircle, Loader2,FileText,
  Cloud, Search, ChevronRight
} from 'lucide-react';

// Google logo SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

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
  
  const handleGoogleLogin = () => {
    actions.loginWithGoogle();
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
            className="w-48 h-auto object-contain"
          />
        </div>

          <div className="flex-1 flex items-center gap-2">
            <nav className="flex-1 flex items-center justify-center gap-1 text-[19px] font-semibold">
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/login">Home</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/platform/features">Features</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/platform/details">About</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/platform/data">Data</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/platform/guide">Docs</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/platform/guide">Support</Link>
              <button
                type="button"
                onClick={goToAdminLogin}
                className="min-w-[102px] text-center px-5 py-2.5 rounded-lg bg-cyan-400/20 text-cyan-100 hover:bg-cyan-300/25 hover:text-white transition-colors"
              >
                Admin
              </button>
            </nav>

            <div className="hidden xl:flex items-center relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/75" />
              <input
                type="text"
                placeholder="Search files"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-blue-900/45 border border-cyan-100/25 text-cyan-50 placeholder-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              />
            </div>

            <Link
              to="/register"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-base font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/35"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between gap-8 pt-32 lg:pt-36 px-12 pb-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>
        
        {/* Features */}
        <div className="relative w-full max-w-lg mx-auto space-y-5 mt-4">
          <h1 className="text-5xl font-extrabold leading-tight pl-2 tracking-tight text-cyan-100">
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
      <div className="flex-1 flex items-start justify-center p-6 lg:p-8 pt-32 lg:pt-36">
        <div className="w-full max-w-lg relative mt-3 lg:mt-4">
          {/* Card */}
          <div className="relative bg-blue-900/86 backdrop-blur-2xl rounded-3xl p-10 border border-cyan-200/30 shadow-[0_26px_76px_rgba(4,18,50,0.58)]">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight text-cyan-50">Welcome</h2>
                <p className="text-cyan-100/85 mt-2 text-base">Sign in to your account</p>
              </div>
            
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white/95 text-slate-700 font-semibold rounded-xl hover:bg-white transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            
            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-slate-600" />
              <span className="text-slate-400 text-sm">or</span>
              <div className="flex-1 h-px bg-slate-600" />
            </div>
            
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-cyan-100/95 mb-2">
                  Email or Admin ID
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600/90" />
                  <input
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3.5 bg-blue-900/55 border border-cyan-200/30 rounded-xl text-cyan-50 placeholder-cyan-100/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-base"
                    placeholder="you@example.com or DOCMATRIX-OMEGA"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-cyan-100/95 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600/90" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-12 py-3.5 bg-blue-900/55 border border-cyan-200/30 rounded-xl text-cyan-50 placeholder-cyan-100/45 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-base"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-base font-semibold rounded-xl hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 shadow-lg shadow-cyan-900/40"
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
