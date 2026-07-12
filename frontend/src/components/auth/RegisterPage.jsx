/**
 * Register Page Component
 * Clean, professional registration interface
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, User,
  FileText, Check, X, ChevronRight, Search
} from 'lucide-react';

// Google logo SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const { state, actions } = useAuth();
  const { isAuthenticated, isLoading, error } = state;
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Password strength
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };
  
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const passwordMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) actions.clearError();
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!acceptTerms) {
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    
    if (passwordStrength < 3) {
      return;
    }
    
    setIsSubmitting(true);
    
    const result = await actions.register({
      full_name: formData.full_name,
      email: formData.email,
      password: formData.password,
    });
    
    setIsSubmitting(false);
    
    if (result.success) {
        navigate('/login');
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
    <div className="min-h-screen flex bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700">
      <header className="absolute top-0 left-0 right-0 z-20 border-b border-cyan-100/20 bg-blue-950/55 backdrop-blur-xl">
        <div className="w-full px-5 lg:px-9 py-5 flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-100 text-2xl lg:text-3xl font-extrabold tracking-tight">DocMatrix</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <nav className="flex-1 flex items-center justify-center gap-1 text-[19px] font-semibold">
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/login">Home</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/features">Features</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/about">About</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/data">Data</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/docs">Docs</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/support">Support</Link>
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
              to="/login"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-base font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/35"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 pt-28 lg:px-8 lg:pt-32">
        <div className="w-full max-w-[33rem]">
          
          {/* Card */}
          <div className="bg-blue-900/86 backdrop-blur-2xl rounded-2xl p-6 lg:p-7 border border-cyan-200/30 shadow-[0_26px_76px_rgba(4,18,50,0.58)]">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white">Create account</h2>
              <p className="text-slate-300/85 mt-1.5 text-sm">Start managing your documents securely</p>
            </div>
            
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            
            {/* Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gray-600" />
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-600" />
            </div>
            
            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-900/35 border border-sky-300/35 rounded-lg text-white placeholder-slate-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:border-cyan-200 transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-900/35 border border-sky-300/35 rounded-lg text-white placeholder-slate-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:border-cyan-200 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-12 py-2.5 bg-blue-900/35 border border-sky-300/35 rounded-lg text-white placeholder-slate-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:border-cyan-200 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength
                              ? passwordStrength <= 2
                                ? 'bg-red-500'
                                : passwordStrength <= 3
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <PasswordCheck check={passwordChecks.length} label="8+ characters" />
                      <PasswordCheck check={passwordChecks.uppercase} label="Uppercase" />
                      <PasswordCheck check={passwordChecks.lowercase} label="Lowercase" />
                      <PasswordCheck check={passwordChecks.number} label="Number" />
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className={`w-full pl-10 pr-12 py-2.5 bg-blue-900/35 border rounded-lg text-white placeholder-slate-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 transition-all ${
                      formData.confirmPassword && !passwordMatch ? 'border-red-500 focus:border-red-400' : 'border-sky-300/35 focus:border-cyan-200'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.confirmPassword && !passwordMatch && (
                  <p className="mt-1 text-xs text-red-400">Passwords don't match</p>
                )}
              </div>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-sky-300/45 bg-white/10 text-cyan-400 focus:ring-cyan-300 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400">
                  I agree to the{' '}
                  <a href="#" className="text-blue-400 hover:text-blue-300">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
                </span>
              </label>
              
              <button
                type="submit"
                disabled={isSubmitting || !acceptTerms || !passwordMatch || passwordStrength < 3}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Create account
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            
            {/* Login Link */}
            <p className="mt-4 text-center text-gray-400 text-sm">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center px-12 py-10 pt-28 lg:pt-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>
        
        <div className="relative w-full max-w-[560px] text-center lg:-translate-x-5">
          <div className="mx-auto mb-7 flex items-center justify-center">
            <img
              src="/docky-avatar.png"
              alt="DocMatrix Docky"
              className="w-full max-w-[410px] h-auto object-contain"
            />
          </div>
          <h2 className="text-[2.05rem] font-bold text-white mb-4">
            Secure Document Management
          </h2>
          <p className="text-slate-300/85 text-[1.02rem] max-w-lg mx-auto leading-relaxed">
            Join thousands of users who trust DocMatrix for their document management needs. 
            Your data, your storage, your control.
          </p>
        </div>
      </div>
    </div>
  );
}

function PasswordCheck({ check, label }) {
  return (
    <div className={`flex items-center gap-1 ${check ? 'text-green-400' : 'text-gray-500'}`}>
      {check ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  );
}
