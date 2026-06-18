/**
 * Reset Password Page
 * Complete password reset with OTP and new password
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle, FileText, Check, X
} from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { actions } = useAuth();
  
  const email = location.state?.email;
  
  const [step, setStep] = useState(1); // 1: OTP, 2: New Password
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const inputRefs = useRef([]);
  
  // Password checks
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
  
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const passwordMatch = password === confirmPassword && confirmPassword.length > 0;
  
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);
  
  useEffect(() => {
    if (step === 1) {
      inputRefs.current[0]?.focus();
    }
  }, [step]);
  
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete code');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    const result = await actions.verifyResetOtp(email, otpCode);
    
    setIsSubmitting(false);
    
    if (result.success) {
      setResetToken(result.token);
      setStep(2);
    } else {
      setError(result.message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };
  
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!passwordMatch || passwordStrength < 3) {
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    const result = await actions.resetPassword(resetToken, password);
    
    setIsSubmitting(false);
    
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successfully! Please sign in.' }
        });
      }, 2000);
    } else {
      setError(result.message);
    }
  };
  
  if (!email) return null;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">DocMatrix</span>
          </Link>
        </div>
        
        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Reset!</h2>
              <p className="text-slate-600">Redirecting to login...</p>
            </div>
          ) : step === 1 ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Enter reset code</h2>
                <p className="text-slate-600 mt-2">
                  Enter the 6-digit code sent to<br />
                  <span className="text-slate-900 font-medium">{email}</span>
                </p>
              </div>
              
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    disabled={isSubmitting}
                    className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                  />
                ))}
              </div>
              
              <button
                onClick={handleVerifyOtp}
                disabled={isSubmitting || otp.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Verify Code'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Set new password</h2>
                <p className="text-slate-600 mt-2">
                  Create a strong password for your account
                </p>
              </div>
              
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                  
                  {password && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <PasswordCheck check={passwordChecks.length} label="8+ characters" />
                      <PasswordCheck check={passwordChecks.uppercase} label="Uppercase" />
                      <PasswordCheck check={passwordChecks.lowercase} label="Lowercase" />
                      <PasswordCheck check={passwordChecks.number} label="Number" />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-lg text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                        confirmPassword && !passwordMatch ? 'border-red-500' : 'border-slate-300'
                      }`}
                      placeholder="••••••••"
                    />
                  </div>
                  {confirmPassword && !passwordMatch && (
                    <p className="mt-1 text-xs text-red-400">Passwords don't match</p>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordMatch || passwordStrength < 3}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}
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
