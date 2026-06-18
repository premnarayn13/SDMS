import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { driveSettingsApi } from '../../utils/settingsApi';
import {
  DRIVE_SETUP_IN_PROGRESS_KEY,
  isDriveSetupCompleted,
  markDriveSetupCompleted,
} from '../../utils/driveSetup';
import { HardDrive, Loader2, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';

const isLegacyMode = import.meta.env.VITE_LEGACY_MODE === 'true';

export default function DriveSetupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useAuth();
  const { user } = state;

  const [isChecking, setIsChecking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const success = searchParams.get('success');
  const driveEmail = searchParams.get('drive_email');
  const driveLabel = searchParams.get('drive_label');
  const callbackError = searchParams.get('error');

  const connectedMessage = useMemo(() => {
    if (!driveEmail) return 'Drive connected successfully.';
    return `${driveLabel || 'Drive'} (${driveEmail}) connected successfully.`;
  }, [driveEmail, driveLabel]);

  useEffect(() => {
    const checkSetupState = async () => {
      if (!user) {
        setIsChecking(false);
        return;
      }

      if (callbackError) {
        setError(`Drive linking failed: ${callbackError}`);
        localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
        setSearchParams({});
        setIsChecking(false);
        return;
      }

      if (success === 'true') {
        markDriveSetupCompleted(user);
        localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
        setMessage(connectedMessage);
        setSearchParams({});
        setTimeout(() => navigate('/', { replace: true }), 700);
        return;
      }

      if (isDriveSetupCompleted(user)) {
        navigate('/', { replace: true });
        return;
      }

      if (isLegacyMode) {
        setIsChecking(false);
        return;
      }

      try {
        const drivesResult = await driveSettingsApi.getAllDrives();
        const drives = drivesResult?.drives || [];
        if (drives.length > 0) {
          markDriveSetupCompleted(user);
          navigate('/', { replace: true });
          return;
        }
      } catch (e) {
        try {
          const status = await driveSettingsApi.getStatus();
          if (status) {
            markDriveSetupCompleted(user);
            navigate('/', { replace: true });
            return;
          }
        } catch (_) {
          // keep onboarding page open if status check fails
        }
      }

      setIsChecking(false);
    };

    checkSetupState();
  }, [user, callbackError, success, connectedMessage, navigate, setSearchParams]);

  const handleConnectPrimaryDrive = async () => {
    setError('');
    setMessage('');
    setIsConnecting(true);

    if (isLegacyMode) {
      markDriveSetupCompleted(user);
      localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
      navigate('/', { replace: true });
      return;
    }

    try {
      localStorage.setItem(DRIVE_SETUP_IN_PROGRESS_KEY, 'true');
      const result = await driveSettingsApi.initiateLinking('Primary Drive');
      window.location.href = result.auth_url;
    } catch (e) {
      localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
      setError(e?.response?.data?.detail || 'Failed to start Google Drive linking.');
      setIsConnecting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
        <div className="w-14 h-14 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-5">
          <HardDrive className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect your primary Google Drive</h1>
        <p className="text-slate-600 mb-6">
          Complete this one-time setup to use your primary registered email Drive before entering Home.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}

        <button
          onClick={handleConnectPrimaryDrive}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 font-medium transition-colors"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
          <span>{isConnecting ? 'Connecting...' : 'Connect Primary Drive'}</span>
        </button>
      </div>
    </div>
  );
}