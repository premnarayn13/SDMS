/**
 * Google OAuth Callback Handler
 * Processes Google OAuth redirect
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertCircle, FileText } from 'lucide-react';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { actions } = useAuth();
  
  const [error, setError] = useState('');
  
  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const errorParam = searchParams.get('error');
      
      if (errorParam) {
        setError('Google login was cancelled or failed');
        return;
      }
      
      if (!code && !accessToken) {
        setError('No Google authorization payload received');
        return;
      }

      const result = await actions.handleGoogleCallback(
        accessToken
          ? { accessToken, refreshToken }
          : { code }
      );
      
      if (result.success) {
        navigate('/drive-setup');
      } else {
        setError(result.message);
      }
    };
    
    handleCallback();
  }, [searchParams, actions, navigate]);
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl border border-slate-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Login Failed</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">DocMatrix</span>
        </div>
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}
