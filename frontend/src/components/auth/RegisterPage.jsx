/**
 * Register Page Component
 * Clean, professional registration interface matching LoginPage proportions
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  User, Lock, Eye, EyeOff, AlertCircle, Loader2, FileText, Check, X,
  Search, ChevronRight
} from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { state, actions } = useAuth();
  const { isLoading, error } = state;
  
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
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) actions.clearError();
  };
  
  // Password strength calculation
  const getPasswordStrength = (password) => {
    let score = 0;
    if (!password) return score;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
  };
  
  const passwordMatch = formData.password === formData.confirmPassword;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptTerms || !passwordMatch) return;
    
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700 font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-cyan-100/20 bg-blue-950/75 backdrop-blur-xl h-16 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-100 text-xl font-extrabold tracking-tight">DocMatrix</span>
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
              to="/login"
              className="flex-shrink-0 ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-xs font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-900/35"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Panel - Form */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="w-full max-w-sm sm:max-w-md relative">
              {/* Card */}
              <div className="bg-blue-900/85 backdrop-blur-2xl rounded-2xl p-6 sm:p-7 border border-cyan-200/30 shadow-[0_20px_50px_rgba(4,18,50,0.5)]">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-white">Create account</h2>
                  <p className="text-slate-300/85 mt-1 text-xs sm:text-sm">Start managing your documents securely</p>
                </div>
                
                {/* Error Alert */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">{error}</span>
                  </div>
                )}
                
                {/* Register Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-100/95 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        required
                        className="w-full pl-9 pr-3 py-1.5 bg-blue-950/60 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-xs sm:text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-cyan-100/95 mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full pl-9 pr-3 py-1.5 bg-blue-950/60 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-xs sm:text-sm"
                        placeholder="you@example.com"
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
                        className="w-full pl-9 pr-9 py-1.5 bg-blue-950/60 border border-cyan-200/30 rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 focus:border-cyan-200 transition-all text-xs sm:text-sm"
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
                    
                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-1.5">
                        <div className="flex gap-1 mb-1">
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
                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                          <PasswordCheck check={passwordChecks.length} label="8+ characters" />
                          <PasswordCheck check={passwordChecks.uppercase} label="Uppercase" />
                          <PasswordCheck check={passwordChecks.lowercase} label="Lowercase" />
                          <PasswordCheck check={passwordChecks.number} label="Number" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-cyan-100/95 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        className={`w-full pl-9 pr-9 py-1.5 bg-blue-950/60 border rounded-lg text-cyan-50 placeholder-cyan-100/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/80 transition-all text-xs sm:text-sm ${
                          formData.confirmPassword && !passwordMatch ? 'border-red-500 focus:border-red-400' : 'border-cyan-200/30 focus:border-cyan-200'
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-200/70 hover:text-cyan-100"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formData.confirmPassword && !passwordMatch && (
                      <p className="mt-0.5 text-[11px] text-red-400">Passwords don't match</p>
                    )}
                  </div>
                  
                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-cyan-100/50 bg-blue-950/45 text-cyan-400 focus:ring-cyan-400 focus:ring-offset-0"
                    />
                    <span className="text-xs text-cyan-100/80">
                      I agree to the{' '}
                      <a href="#" className="text-cyan-300 hover:text-cyan-200">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-cyan-300 hover:text-cyan-200">Privacy Policy</a>
                    </span>
                  </label>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !acceptTerms || !passwordMatch || passwordStrength < 3}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-900/35"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Create account
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                
                {/* Login Link */}
                <p className="mt-4 text-center text-slate-300 text-xs sm:text-sm">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-cyan-300 hover:text-cyan-200 font-semibold"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Visual Side-by-Side */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center items-center text-center px-4">
            <div className="w-full max-w-md mx-auto space-y-4">
              <div className="flex justify-center">
                <img
                  src="/docky-avatar.png"
                  alt="DocMatrix Docky"
                  className="w-48 xl:w-56 h-auto object-contain drop-shadow-xl"
                />
              </div>
              <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">
                Secure Document Management
              </h2>
              <p className="text-cyan-100/85 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                Join thousands of users who trust DocMatrix for their document management needs. 
                Your data, your storage, your control.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function PasswordCheck({ check, label }) {
  return (
    <div className={`flex items-center gap-1 ${check ? 'text-green-400' : 'text-gray-400'}`}>
      {check ? <Check className="w-3 h-3 text-green-400" /> : <X className="w-3 h-3 text-gray-500" />}
      <span>{label}</span>
    </div>
  );
}
