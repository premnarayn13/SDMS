/**
 * Forgot Password Page
 * Password reset request flow
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, AlertCircle, Loader2, ArrowLeft, FileText, CheckCircle
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { actions } = useAuth();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    const result = await actions.forgotPassword(email);
    
    setIsSubmitting(false);
    
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.message);
    }
  };
  
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
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-slate-600 mb-6">
                We sent a password reset link to<br />
                <span className="text-slate-900 font-medium">{email}</span>
              </p>
              <button
                onClick={() => navigate('/reset-password', { state: { email } })}
                className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all"
              >
                Enter Reset Code
              </button>
              <p className="mt-4 text-sm text-slate-600">
                Didn't receive the email?{' '}
                <button
                  onClick={() => setSuccess(false)}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Forgot password?</h2>
                <p className="text-slate-600 mt-2">
                  No worries, we'll send you reset instructions
                </p>
              </div>
              
              {/* Error Alert */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset password'
                  )}
                </button>
              </form>
              
              {/* Back to Login */}
              <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
