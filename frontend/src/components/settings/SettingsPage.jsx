/**
 * Settings Page Component
 * User profile, preferences, and Google Drive management
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userSettingsApi, driveSettingsApi, megaSettingsApi } from '../../utils/settingsApi';
import { DRIVE_SETUP_IN_PROGRESS_KEY, markDriveSetupCompleted } from '../../utils/driveSetup';
import {
  User, Mail, Shield, HardDrive, Settings as SettingsIcon,
  ChevronRight, Save, Loader2, AlertCircle, CheckCircle,
  LogOut, Trash2, ExternalLink, RefreshCw, Unlink, Link as LinkIcon,
  Eye, EyeOff, Bell, Moon, Sun, Monitor, Clock, Activity, Upload, Download,
  SlidersHorizontal, Palette, Type
} from 'lucide-react';

// Google Drive Logo
const GoogleDriveLogo = () => (
  <svg className="w-8 h-8" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

// Check if running in legacy mode
const isLegacyMode = import.meta.env.VITE_LEGACY_MODE === 'true';
const UI_PREFS_KEY = 'docmatrix_ui_customization';
const DEFAULT_UI_CUSTOMIZATION = {
  scale: 100,
  accentColor: '#102a43',
  sidebarTextSize: 14,
  sidebarTextWeight: 600,
  cornerRadius: 12,
  compactMode: false,
  fieldWidth: 'comfortable',
  contentMode: 'full',
  reducedMotion: false,
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state: authState, actions } = useAuth();
  const { user } = authState;

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile state
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    theme: 'system',
    default_view: 'grid',
    notifications_enabled: true,
    email_on_share: true,
    email_on_login: true,
    auto_backup: false,
  });
  const [uiCustomization, setUiCustomization] = useState(DEFAULT_UI_CUSTOMIZATION);

  // Drive state - Multi-drive support
  const [driveStatus, setDriveStatus] = useState(null);
  const [driveQuota, setDriveQuota] = useState(null);
  const [allDrives, setAllDrives] = useState([]);  // All linked drives
  const [editingDrive, setEditingDrive] = useState(null);  // Drive being edited
  const [linkingStep, setLinkingStep] = useState(null); // null, 'waiting', 'otp'
  const [unlinkPassword, setUnlinkPassword] = useState('');
  const [pendingDriveId, setPendingDriveId] = useState(null);
  const [pendingDriveEmail, setPendingDriveEmail] = useState(null);
  const [newDriveName, setNewDriveName] = useState('');  // Name for new drive
  const [storageSlider, setStorageSlider] = useState(10);  // GB allocation slider

  // Storage state
  const [storage, setStorage] = useState(null);

  // MEGA state
  const [megaStatus, setMegaStatus] = useState({ connected: false });
  const [megaFiles, setMegaFiles] = useState([]);
  const [megaEmail, setMegaEmail] = useState('');
  const [megaPassword, setMegaPassword] = useState('');
  const [megaUploading, setMegaUploading] = useState(false);
  const [megaActionFileId, setMegaActionFileId] = useState(null);
  const [megaDisconnecting, setMegaDisconnecting] = useState(false);
  const [showMegaReconnect, setShowMegaReconnect] = useState(false);
  const [megaDiagnostics, setMegaDiagnostics] = useState({
    lastOperation: null,
    latencyMs: null,
    success: null,
    error: null,
    updatedAt: null,
  });

  // Sessions state
  const [sessions, setSessions] = useState([]);

  // Handle drive verify callback from URL params
  useEffect(() => {
    const explicitTab = searchParams.get('tab');
    const pathTab = location.pathname.split('/').filter(Boolean).at(-1);
    const validTabs = new Set(['profile', 'preferences', 'drive', 'storage', 'mega', 'security']);
    const requestedTab = validTabs.has(explicitTab) ? explicitTab : (validTabs.has(pathTab) ? pathTab : null);
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }

    const success = searchParams.get('success');
    const driveEmail = searchParams.get('drive_email');
    const driveLabel = searchParams.get('drive_label');
    const error = searchParams.get('error');
    const isOnboardingFlow = localStorage.getItem(DRIVE_SETUP_IN_PROGRESS_KEY) === 'true';

    if (error) {
      if (isOnboardingFlow) {
        localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
        setSearchParams({});
        navigate('/drive-setup', { replace: true });
        return;
      }
      setMessage({ type: 'error', text: `Drive linking failed: ${error}` });
      setSearchParams({});
      setActiveTab('drive');
    } else if (success === 'true' && driveEmail) {
      if (isOnboardingFlow) {
        markDriveSetupCompleted(user);
        localStorage.removeItem(DRIVE_SETUP_IN_PROGRESS_KEY);
        setSearchParams({});
        navigate('/', { replace: true });
        return;
      }
      // Drive linked successfully (no OTP required)
      setMessage({
        type: 'success',
        text: `${driveLabel || 'Drive'} (${driveEmail}) connected successfully!`
      });
      setActiveTab('drive');
      setSearchParams({});
      // Reload drives to show the new one
      loadData();
    }
  }, [searchParams, location.pathname, activeTab, navigate, setSearchParams, user]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}');
      setUiCustomization({ ...DEFAULT_UI_CUSTOMIZATION, ...saved });
    } catch {
      setUiCustomization(DEFAULT_UI_CUSTOMIZATION);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--dm-ui-scale', String((uiCustomization.scale || 100) / 100));
    root.style.setProperty('--dm-accent-color', uiCustomization.accentColor || '#102a43');
    root.style.setProperty('--dm-sidebar-font-size', `${uiCustomization.sidebarTextSize || 14}px`);
    root.style.setProperty('--dm-sidebar-font-weight', String(uiCustomization.sidebarTextWeight || 600));
    root.style.setProperty('--dm-ui-radius', `${uiCustomization.cornerRadius || 12}px`);
    root.style.setProperty('--dm-field-max-width', uiCustomization.fieldWidth === 'tight' ? '560px' : (uiCustomization.fieldWidth === 'comfortable' ? '720px' : '100%'));
    root.style.setProperty('--dm-content-max-width', uiCustomization.contentMode === 'centered' ? '1280px' : '100%');
    root.style.setProperty('--dm-motion-duration', uiCustomization.reducedMotion ? '0ms' : '200ms');
    root.dataset.dmDensity = uiCustomization.compactMode ? 'compact' : 'comfortable';
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiCustomization));
  }, [uiCustomization]);

  const loadData = async () => {
    setIsLoading(true);

    // In legacy mode, use local defaults
    if (isLegacyMode) {
      switch (activeTab) {
        case 'profile':
          setProfile({
            full_name: 'Local User',
            avatar_url: '',
          });
          break;
        case 'preferences':
          // Use defaults already in state
          break;
        case 'drive':
          setDriveStatus({ linked: false });
          break;
        case 'storage':
          setStorage({
            used: 0,
            total: 5368709120, // 5GB
            breakdown: { documents: 0, images: 0, videos: 0, other: 0 }
          });
          break;
        case 'mega':
          setMegaStatus({
            connected: false,
            warning: 'MEGA credentials are encrypted at rest. 2FA challenge flow is not handled by this app yet.'
          });
          setMegaFiles([]);
          break;
        case 'security':
          setSessions([]);
          break;
      }
      setIsLoading(false);
      return;
    }

    try {
      switch (activeTab) {
        case 'profile':
          const profileData = await userSettingsApi.getProfile();
          setProfile({
            full_name: profileData.name || profileData.full_name || '',
            avatar_url: profileData.avatar_url || '',
          });
          break;
        case 'preferences':
          const prefsData = await userSettingsApi.getPreferences();
          setPreferences(prefsData);
          break;
        case 'drive':
          // Load all linked drives
          try {
            const drivesResult = await driveSettingsApi.getAllDrives();
            setAllDrives(drivesResult.drives || []);
            // For backward compatibility, set status based on if any drives exist
            if (drivesResult.drives?.length > 0) {
              const primaryDrive = drivesResult.drives.find(d => d.is_primary) || drivesResult.drives[0];
              setDriveStatus({ linked: true, ...primaryDrive });
              try {
                const allQuota = await driveSettingsApi.getAllDrivesQuota();
                setDriveQuota(allQuota);
              } catch (e) {
                console.warn('Could not fetch drive quota', e);
              }
            } else {
              setDriveStatus({ linked: false });
            }
          } catch (e) {
            console.warn('Could not load drives, trying legacy status', e);
            const status = await driveSettingsApi.getStatus();
            setDriveStatus(status ? { linked: true, ...status } : { linked: false });
            if (status) {
              try {
                const quota = await driveSettingsApi.getQuota();
                setDriveQuota(quota);
              } catch (e) {
                console.warn('Could not fetch drive quota', e);
              }
            }
          }
          break;
        case 'storage':
          const storageData = await userSettingsApi.getStorageUsage();
          setStorage(storageData);
          break;
        case 'mega':
          try {
            const status = await megaSettingsApi.getStatus();
            setMegaStatus(status || { connected: false });
            if (status?.connected) {
              try {
                const filesResult = await megaSettingsApi.listFiles();
                setMegaFiles(filesResult?.files || []);
              } catch (fileError) {
                console.warn('MEGA connected but file listing failed', fileError);
                setMegaFiles([]);
              }
            } else {
              setMegaFiles([]);
            }
          } catch (e) {
            console.warn('Could not load MEGA storage data', e);
            setMegaStatus({ connected: false });
            setMegaFiles([]);
          }
          break;
        case 'security':
          const sessionsData = await userSettingsApi.getLoginHistory();
          setSessions(sessionsData.sessions || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setIsLoading(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    if (isLegacyMode) {
      // In legacy mode, just show success (settings are not persisted)
      setMessage({ type: 'success', text: 'Profile updated (local mode)' });
      setIsSaving(false);
      return;
    }

    try {
      // Map full_name to name for backend
      const updateData = {
        name: profile.full_name,
        avatar_url: profile.avatar_url,
      };
      const updated = await userSettingsApi.updateProfile(updateData);
      actions.updateUser(updated);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update profile' });
    }

    setIsSaving(false);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    if (isLegacyMode) {
      // In legacy mode, save to localStorage
      localStorage.setItem('docmatrix_preferences', JSON.stringify(preferences));
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiCustomization));
      setMessage({ type: 'success', text: 'Preferences and UI customization saved locally' });
      setIsSaving(false);
      return;
    }

    try {
      await userSettingsApi.updatePreferences(preferences);
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiCustomization));
      setMessage({ type: 'success', text: 'Preferences and UI customization saved' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    }

    setIsSaving(false);
  };

  const handleConnectDrive = async () => {
    // In legacy mode, simulate drive connection
    if (isLegacyMode) {
      const newDrive = {
        id: `demo-${Date.now()}`,
        linked: true,
        drive_email: 'demo@gmail.com',
        label: newDriveName || `Drive ${String.fromCharCode(65 + allDrives.length)}`,
        display_name: newDriveName || null,
        color: '#3b82f6',
        is_primary: allDrives.length === 0,
        allocated_storage_bytes: storageSlider * 1024 * 1024 * 1024,
        quota_bytes_used: 0,
      };
      setAllDrives([...allDrives, newDrive]);
      setDriveStatus({ linked: true, ...newDrive });
      setMessage({ type: 'success', text: 'Google Drive connected! (Demo Mode)' });
      setNewDriveName('');
      setStorageSlider(10);
      return;
    }

    try {
      const result = await driveSettingsApi.initiateLinking(newDriveName || null);
      // Open Google auth URL - will redirect back when done (no OTP needed)
      window.location.href = result.auth_url;
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to start linking' });
    }
  };

  const handleVerifyDriveOtp = async () => {
    // In legacy mode, just show success
    if (isLegacyMode) {
      const newDrive = {
        id: `demo-${Date.now()}`,
        drive_email: pendingDriveEmail || 'demo@gmail.com',
        label: newDriveName || `Drive ${String.fromCharCode(65 + allDrives.length)}`,
        display_name: newDriveName || null,
        color: '#3b82f6',
        is_primary: allDrives.length === 0,
        allocated_storage_bytes: storageSlider * 1024 * 1024 * 1024,
        quota_bytes_used: 0,
      };
      setAllDrives([...allDrives, newDrive]);
      setDriveStatus({ linked: true, ...newDrive });
      setLinkingStep(null);
      setOtp('');
      setNewDriveName('');
      setStorageSlider(10);
      setMessage({ type: 'success', text: 'Google Drive connected!' });
      return;
    }

    setIsSaving(true);
    try {
      const result = await driveSettingsApi.verifyAndLink(otp, pendingDriveId, newDriveName || null);
      // Reload all drives
      const drivesResult = await driveSettingsApi.getAllDrives();
      setAllDrives(drivesResult.drives || []);
      setDriveStatus({ linked: true, ...result });

      try {
        const allQuota = await driveSettingsApi.getAllDrivesQuota();
        setDriveQuota(allQuota);
      } catch (e) {
        console.warn('Could not fetch quota', e);
      }
      setLinkingStep(null);
      setOtp('');
      setPendingDriveId(null);
      setPendingDriveEmail(null);
      setNewDriveName('');
      setStorageSlider(10);
      setMessage({ type: 'success', text: 'Google Drive connected!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Verification failed' });
    }
    setIsSaving(false);
  };

  const handleUnlinkDrive = async (driveId = null) => {
    const targetDrive = driveId
      ? allDrives.find(d => d.id === driveId)
      : driveStatus;

    // In legacy mode, just unlink locally
    if (isLegacyMode) {
      if (driveId) {
        setAllDrives(allDrives.filter(d => d.id !== driveId));
        if (allDrives.length <= 1) {
          setDriveStatus({ linked: false });
        }
      } else {
        setAllDrives([]);
        setDriveStatus({ linked: false });
      }
      setDriveQuota(null);
      setMessage({ type: 'success', text: 'Google Drive disconnected' });
      return;
    }

    const driveName = targetDrive?.label || targetDrive?.drive_email || 'this drive';
    if (!window.confirm(`Are you sure you want to unlink ${driveName}? Your files will remain on Google Drive but won't be accessible through DocMatrix.`)) {
      return;
    }

    try {
      await driveSettingsApi.requestUnlink(driveId);
      setEditingDrive({ id: driveId, action: 'unlink' });
      setLinkingStep('unlink-password');
      if (user?.email) {
        setMessage({ type: 'success', text: `Verification code sent to ${user.email}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to request unlink' });
    }
  };

  const handleUpdateDriveSettings = async (driveId, updates) => {
    if (isLegacyMode) {
      setAllDrives(allDrives.map(d => d.id === driveId ? { ...d, ...updates } : d));
      setMessage({ type: 'success', text: 'Drive settings updated' });
      return;
    }

    setIsSaving(true);
    try {
      await driveSettingsApi.updateDriveSettings(driveId, updates);
      // Reload drives
      const drivesResult = await driveSettingsApi.getAllDrives();
      setAllDrives(drivesResult.drives || []);
      setMessage({ type: 'success', text: 'Drive settings updated' });
      setEditingDrive(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update drive' });
    }
    setIsSaving(false);
  };

  const handleUpdateStorageAllocation = async (driveId, gbAmount) => {
    const bytes = gbAmount * 1024 * 1024 * 1024;

    if (isLegacyMode) {
      setAllDrives(allDrives.map(d => d.id === driveId ? { ...d, allocated_storage_bytes: bytes } : d));
      setMessage({ type: 'success', text: `Storage allocation set to ${gbAmount} GB` });
      return;
    }

    setIsSaving(true);
    try {
      await driveSettingsApi.updateStorageAllocation(driveId, bytes);
      // Reload drives
      const drivesResult = await driveSettingsApi.getAllDrives();
      setAllDrives(drivesResult.drives || []);
      setMessage({ type: 'success', text: `Storage allocation set to ${gbAmount} GB` });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update storage allocation' });
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    if (isLegacyMode) {
      // In legacy mode, just go back to home
      navigate('/');
      return;
    }
    try {
      await actions.logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, navigate to login
      navigate('/login', { replace: true });
    }
  };

  const refreshMegaFiles = async () => {
    const started = Date.now();
    try {
      const filesResult = await megaSettingsApi.listFiles();
      setMegaFiles(filesResult?.files || []);
      setMegaDiagnostics({
        lastOperation: 'list-files',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setMegaDiagnostics({
        lastOperation: 'list-files',
        latencyMs: Date.now() - started,
        success: false,
        error: error.response?.data?.detail || error.message || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
  };

  const handleConnectMega = async (forceReconnect = false) => {
    if (!megaEmail.trim() || !megaPassword.trim()) {
      setMessage({ type: 'error', text: 'Please provide both MEGA email and password.' });
      return;
    }

    if (isLegacyMode) {
      setMegaStatus({
        connected: true,
        mega_email: megaEmail.trim(),
        folder_name: `DocMatrix_${user?.id || 'demo-user'}`,
        warning: 'MEGA credentials are encrypted at rest. 2FA challenge flow is not handled by this app yet.'
      });
      setMegaPassword('');
      setMessage({ type: 'success', text: 'MEGA connected (demo mode).' });
      return;
    }

    setIsSaving(true);
    try {
      const started = Date.now();
      const result = await megaSettingsApi.connectMega(megaEmail.trim(), megaPassword, forceReconnect);
      const status = await megaSettingsApi.getStatus();
      setMegaStatus(status || { connected: true });
      setMegaDiagnostics({
        lastOperation: 'connect',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
      try {
        await refreshMegaFiles();
      } catch (fileError) {
        console.warn('Connected MEGA account but failed to refresh file list', fileError);
        setMegaFiles([]);
      }
      setMegaPassword('');
      setShowMegaReconnect(false);
      setMessage({ type: 'success', text: result?.message || 'MEGA account connected successfully.' });
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Failed to connect MEGA account.';
      if (detail.toLowerCase().includes('force_reconnect')) {
        const confirmReconnect = window.confirm(
          'A different MEGA account is already linked. Click OK to replace it with the new account.'
        );
        if (confirmReconnect) {
          setIsSaving(false);
          await handleConnectMega(true);
          return;
        }
      }
      setMessage({ type: 'error', text: detail });
    }
    setIsSaving(false);
  };

  const handleDisconnectMega = async () => {
    if (!window.confirm('Disconnect MEGA from this DocMatrix account? This will not delete files in MEGA.')) return;

    if (isLegacyMode) {
      setMegaStatus({ connected: false });
      setMegaFiles([]);
      setMegaEmail('');
      setMegaPassword('');
      setShowMegaReconnect(false);
      setMessage({ type: 'success', text: 'MEGA disconnected (demo mode).' });
      return;
    }

    setMegaDisconnecting(true);
    try {
      const started = Date.now();
      await megaSettingsApi.disconnectMega();
      setMegaStatus({ connected: false });
      setMegaFiles([]);
      setMegaEmail('');
      setMegaPassword('');
      setShowMegaReconnect(false);
      setMegaDiagnostics({
        lastOperation: 'disconnect',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'success', text: 'MEGA account disconnected successfully.' });
    } catch (error) {
      setMegaDiagnostics({
        lastOperation: 'disconnect',
        latencyMs: null,
        success: false,
        error: error.response?.data?.detail || error.message || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to disconnect MEGA account.' });
    }
    setMegaDisconnecting(false);
  };

  const handleMegaUpload = async (file) => {
    if (!file) return;
    if (isLegacyMode) {
      const fakeId = `${Date.now()}`;
      setMegaFiles(prev => [...prev, { file_id: fakeId, name: file.name, size_bytes: file.size }]);
      setMessage({ type: 'success', text: 'File uploaded to MEGA (demo mode).' });
      return;
    }

    setMegaUploading(true);
    try {
      const started = Date.now();
      await megaSettingsApi.uploadFile(file);
      await refreshMegaFiles();
      setMegaDiagnostics({
        lastOperation: 'upload',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'success', text: 'File uploaded to MEGA successfully.' });
    } catch (error) {
      setMegaDiagnostics({
        lastOperation: 'upload',
        latencyMs: null,
        success: false,
        error: error.response?.data?.detail || error.message || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to upload file to MEGA.' });
    }
    setMegaUploading(false);
  };

  const handleMegaDownload = async (fileId, fileName) => {
    if (isLegacyMode) {
      setMessage({ type: 'success', text: `Download requested for ${fileName} (demo mode).` });
      return;
    }

    setMegaActionFileId(fileId);
    try {
      const started = Date.now();
      const blob = await megaSettingsApi.downloadFile(fileId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || 'download.bin';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setMegaDiagnostics({
        lastOperation: 'download',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setMegaDiagnostics({
        lastOperation: 'download',
        latencyMs: null,
        success: false,
        error: error.response?.data?.detail || error.message || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to download file.' });
    }
    setMegaActionFileId(null);
  };

  const handleMegaDelete = async (fileId) => {
    if (!window.confirm('Delete this file from your MEGA DocMatrix folder?')) return;

    if (isLegacyMode) {
      setMegaFiles(prev => prev.filter(file => file.file_id !== fileId));
      setMessage({ type: 'success', text: 'File deleted (demo mode).' });
      return;
    }

    setMegaActionFileId(fileId);
    try {
      const started = Date.now();
      await megaSettingsApi.deleteFile(fileId);
      await refreshMegaFiles();
      setMegaDiagnostics({
        lastOperation: 'delete',
        latencyMs: Date.now() - started,
        success: true,
        error: null,
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'success', text: 'File deleted from MEGA successfully.' });
    } catch (error) {
      setMegaDiagnostics({
        lastOperation: 'delete',
        latencyMs: null,
        success: false,
        error: error.response?.data?.detail || error.message || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to delete file from MEGA.' });
    }
    setMegaActionFileId(null);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User, hint: 'Identity and account details' },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon, hint: 'Theme and notification behavior' },
    { id: 'drive', label: 'Google Drive', icon: HardDrive, hint: 'Primary and multi-drive workspace' },
    { id: 'storage', label: 'Storage', icon: HardDrive, hint: 'Usage analytics and file distribution' },
    { id: 'mega', label: 'MEGA Storage', icon: HardDrive, hint: 'External storage operations' },
    { id: 'security', label: 'Security', icon: Shield, hint: 'Session history and account safety' },
  ];
  const quickActions = [
    { id: 'trash', label: 'Trash', hint: 'Open deleted items', icon: Trash2, action: () => navigate('/?open=trash') },
    { id: 'activity', label: 'Activity', hint: 'Open activity dashboard', icon: Activity, action: () => navigate('/?open=activity') },
    { id: 'backups', label: 'Backups', hint: 'Open backup manager', icon: Download, action: () => navigate('/?open=backup') },
  ];
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const megaTotalBytes = megaFiles.reduce((sum, file) => sum + (Number(file?.size_bytes) || 0), 0);
  const megaPlanTotalBytes = 20 * 1024 * 1024 * 1024;
  const megaRemainingBytes = Math.max(0, megaPlanTotalBytes - megaTotalBytes);
  const megaFileCount = megaFiles.length;
  const megaLargestBytes = megaFiles.reduce((largest, file) => {
    const size = Number(file?.size_bytes) || 0;
    return size > largest ? size : largest;
  }, 0);
  const overviewCards = [
    { label: 'Active Section', value: activeTabMeta.label, helper: activeTabMeta.hint },
    { label: 'Linked Drives', value: String(allDrives.length), helper: 'Google Drive workspaces' },
    { label: 'MEGA Files', value: String(megaFileCount), helper: `${formatBytes(megaTotalBytes)} total` },
    { label: 'Recent Sessions', value: String(sessions.length), helper: 'Security activity records' },
  ];
  const resetUiCustomization = () => {
    setUiCustomization(DEFAULT_UI_CUSTOMIZATION);
    setMessage({ type: 'success', text: 'UI customization reset to default professional style' });
  };

  return (
    <div className="settings-shell relative min-h-screen overflow-hidden bg-slate-100">
      <main className="w-full px-0 pb-0 pt-0">
        <div className="settings-connected-shell min-h-[100vh] overflow-hidden bg-white">
          <section className="border-b border-navy-700 bg-navy-800 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-navy-200">Enterprise Settings Workspace</p>
                <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Settings and Control Center</h2>
                <p className="mt-2 max-w-3xl text-sm text-navy-100">Strong, efficient and connected layout with optimized workflow density for real productivity.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/12 px-3 py-2 text-sm font-medium text-white hover:bg-white/22"
                  >
                    ← Back to Documents
                  </button>
                  <button
                    onClick={() => loadData()}
                    className="px-3 py-2 rounded-lg border border-white/35 bg-white/12 text-white text-sm font-medium hover:bg-white/22"
                  >
                    Refresh Section
                  </button>
                  <button
                    onClick={() => navigate('/storage')}
                    className="px-3 py-2 rounded-lg border border-white/35 bg-white/12 text-white text-sm font-medium hover:bg-white/22"
                  >
                    Open Storage
                  </button>
                  <button
                    onClick={() => navigate('/?open=backup')}
                    className="px-3 py-2 rounded-lg border border-white/35 bg-white/12 text-white text-sm font-medium hover:bg-white/22"
                  >
                    Open Backups
                  </button>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 xl:max-w-2xl xl:items-end">
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-medium text-navy-900 transition-all duration-200 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
                <div className="w-full rounded-xl bg-white/10 px-3 py-3 backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/20">
                    {overviewCards.map((card) => (
                      <div key={card.label} className="px-2 py-1.5 sm:px-3">
                        <p className="uppercase tracking-wide text-navy-200">{card.label}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{card.value}</p>
                        <p className="hidden text-[11px] text-navy-200 sm:block">{card.helper}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid min-h-[calc(100vh-194px)] xl:grid-cols-[320px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside className="animate-slide-up flex h-full flex-col border-r border-navy-100 bg-slate-50">
              <div className="border-b border-navy-100 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-navy-500">Settings Sections</p>
                <p className="mt-1 text-sm font-semibold text-navy-800">Navigate and Configure</p>
              </div>
              <nav className="flex-1 px-0 py-0">
                <div className="h-full divide-y divide-navy-100 border-y border-navy-100 bg-white">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMessage({ type: '', text: '' });
                      }}
                      className={`group flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-all duration-200 ${activeTab === tab.id
                          ? 'bg-navy-700 text-white shadow-inner-soft'
                          : 'text-navy-700 hover:bg-navy-50 hover:text-navy-900'
                        }`}
                    >
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-navy-100 text-navy-800 group-hover:bg-navy-200'}`}>
                        <tab.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tab.label}</span>
                        <span className={`hidden truncate text-xs lg:block ${activeTab === tab.id ? 'text-white/80' : 'text-slate-500'}`}>{tab.hint}</span>
                      </span>
                    </button>
                  ))}

                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick Access</div>
                  {quickActions.map((item) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-navy-700 transition-all duration-200 hover:bg-navy-50 hover:text-navy-900"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-100 text-navy-800 group-hover:bg-navy-200">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-slate-500">{item.hint}</span>
                      </span>
                    </button>
                  ))}
                  <div className="px-4 py-3 bg-slate-50">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Current Focus</p>
                    <p className="mt-1 text-sm font-semibold text-navy-900">{activeTabMeta.label}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{activeTabMeta.hint}</p>
                  </div>
                </div>
              </nav>
            </aside>

            {/* Content */}
            <div className="min-w-0 bg-white p-4 sm:p-6">
              {/* Message */}
              {message.text && (
                <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 animate-fade-in ${message.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                  }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  {message.text}
                </div>
              )}

              {isLoading ? (
                <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-navy-100 bg-white">
                  <Loader2 className="h-10 w-10 animate-spin text-navy-600" />
                </div>
              ) : (
                <div key={activeTab} className="settings-content-surface h-full min-h-[calc(100vh-260px)] bg-white animate-slide-up">
                  {/* Profile Tab */}
                  {activeTab === 'profile' && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <div className="flex items-end justify-between gap-4">
                        <h2 className="text-lg font-semibold text-slate-900">Profile Information</h2>
                      </div>

                      <div className="min-h-[calc(100vh-360px)]">
                        <div className="settings-field-wrap space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Full Name
                            </label>
                            <input
                              type="text"
                              value={profile.full_name}
                              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Email
                            </label>
                            <input
                              type="email"
                              value={user?.email || ''}
                              disabled
                              className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
                          </div>

                          <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                          </button>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => setActiveTab('security')}
                              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100"
                            >
                              Security
                            </button>
                            <button
                              onClick={() => setActiveTab('preferences')}
                              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100"
                            >
                              Preferences
                            </button>
                            <button
                              onClick={() => navigate('/?open=activity')}
                              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100"
                            >
                              Activity
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === 'preferences' && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <h2 className="text-lg font-semibold text-slate-900">Preferences</h2>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Theme
                          </label>
                          <div className="flex gap-3">
                            {[
                              { value: 'light', icon: Sun, label: 'Light' },
                              { value: 'dark', icon: Moon, label: 'Dark' },
                              { value: 'system', icon: Monitor, label: 'System' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => setPreferences({ ...preferences, theme: option.value })}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors duration-200 ${preferences.theme === option.value
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:border-slate-400'
                                  }`}
                              >
                                <option.icon className="w-4 h-4" />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Notifications
                          </label>

                          {[
                            { key: 'notifications_enabled', label: 'Enable notifications' },
                            { key: 'email_on_share', label: 'Email when someone shares with me' },
                            { key: 'email_on_login', label: 'Email on new device login' },
                          ].map((option) => (
                            <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={preferences[option.key]}
                                onChange={(e) => setPreferences({ ...preferences, [option.key]: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-300 bg-white text-slate-900 focus:ring-slate-500"
                              />
                              <span className="text-slate-700">{option.label}</span>
                            </label>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-navy-900 flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                UI Customization
                              </h3>
                              <p className="text-xs text-slate-600 mt-1">Adjust visual density, size, and accent for a professional personalized workspace.</p>
                            </div>
                            <button
                              onClick={resetUiCustomization}
                              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100"
                            >
                              Reset Defaults
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Type className="w-4 h-4" />
                                Interface Scale: {uiCustomization.scale}%
                              </label>
                              <input
                                type="range"
                                min="90"
                                max="115"
                                step="1"
                                value={uiCustomization.scale}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, scale: parseInt(e.target.value, 10) })}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Corner Radius: {uiCustomization.cornerRadius}px</label>
                              <input
                                type="range"
                                min="8"
                                max="18"
                                step="1"
                                value={uiCustomization.cornerRadius}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, cornerRadius: parseInt(e.target.value, 10) })}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Sidebar File Text Size: {uiCustomization.sidebarTextSize}px</label>
                              <input
                                type="range"
                                min="13"
                                max="16"
                                step="1"
                                value={uiCustomization.sidebarTextSize}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, sidebarTextSize: parseInt(e.target.value, 10) })}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Sidebar File Text Weight: {uiCustomization.sidebarTextWeight}</label>
                              <input
                                type="range"
                                min="500"
                                max="700"
                                step="100"
                                value={uiCustomization.sidebarTextWeight}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, sidebarTextWeight: parseInt(e.target.value, 10) })}
                                className="w-full"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                              <Palette className="w-4 h-4" />
                              Accent Color
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {['#102a43', '#1e3a8a', '#0f766e', '#334155', '#0f172a'].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setUiCustomization({ ...uiCustomization, accentColor: color })}
                                  className={`h-8 w-8 rounded-full border-2 ${uiCustomization.accentColor === color ? 'border-slate-900 scale-110' : 'border-white'}`}
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uiCustomization.compactMode}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, compactMode: e.target.checked })}
                                className="w-4 h-4"
                              />
                              Compact mode
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uiCustomization.reducedMotion}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, reducedMotion: e.target.checked })}
                                className="w-4 h-4"
                              />
                              Reduced motion
                            </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Form Field Width</label>
                              <select
                                value={uiCustomization.fieldWidth}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, fieldWidth: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                              >
                                <option value="tight">Tight</option>
                                <option value="comfortable">Comfortable</option>
                                <option value="full">Full Width</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">Content Mode</label>
                              <select
                                value={uiCustomization.contentMode}
                                onChange={(e) => setUiCustomization({ ...uiCustomization, contentMode: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                              >
                                <option value="full">Full Layout</option>
                                <option value="centered">Centered Layout</option>
                              </select>
                            </div>
                          </div>

                          <p className="text-xs text-slate-500">All options above are live and saved automatically for your session.</p>

                          <button
                            onClick={() => setMessage({ type: 'success', text: 'Live UI customization applied' })}
                            className="px-4 py-2 rounded-lg bg-navy-900 text-white text-sm font-medium hover:bg-navy-800"
                          >
                            Apply Live Preview
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSavePreferences}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Preferences
                      </button>
                    </div>
                  )}

                  {/* Drive Tab - Multi-Drive Support */}
                  {activeTab === 'drive' && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Google Drive Connections</h2>
                        <span className="text-sm text-slate-500">
                          {allDrives.length} drive{allDrives.length !== 1 ? 's' : ''} connected
                        </span>
                      </div>

                      {/* Connected Drives List */}
                      {allDrives.length > 0 && (
                        <div className="space-y-4">
                          {allDrives.map((drive, index) => (
                            <div
                              key={drive.id}
                              className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-4">
                                {/* Drive Icon with Color */}
                                <div
                                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: drive.color || '#3b82f6' }}
                                >
                                  <HardDrive className="w-6 h-6 text-white" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  {/* Drive Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-slate-900">
                                        {drive.label || drive.display_name || `Drive ${String.fromCharCode(65 + index)}`}
                                      </h3>
                                      {drive.is_primary && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                          Primary
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditingDrive(editingDrive?.id === drive.id ? null : { ...drive })}
                                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit drive settings"
                                      >
                                        <SettingsIcon className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleUnlinkDrive(drive.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Disconnect drive"
                                      >
                                        <Unlink className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Drive Email */}
                                  <p className="text-sm text-slate-500 mt-0.5">{drive.drive_email}</p>

                                  {/* Storage Bar */}
                                  <div className="mt-3">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                      <span>{formatBytes(drive.quota_bytes_used || 0)} used</span>
                                      <span>{formatBytes(drive.allocated_storage_bytes || 10737418240)} allocated</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                          width: `${Math.min(100, ((drive.quota_bytes_used || 0) / (drive.allocated_storage_bytes || 10737418240)) * 100)}%`,
                                          backgroundColor: drive.color || '#3b82f6'
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Edit Panel */}
                                  {editingDrive?.id === drive.id && (
                                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                                      {/* Display Name */}
                                      <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                          Display Name
                                        </label>
                                        <input
                                          type="text"
                                          value={editingDrive.display_name || ''}
                                          onChange={(e) => setEditingDrive({ ...editingDrive, display_name: e.target.value })}
                                          placeholder={`Drive ${String.fromCharCode(65 + index)}`}
                                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>

                                      {/* Color Selection */}
                                      <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                          Color
                                        </label>
                                        <div className="flex gap-2">
                                          {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'].map((color) => (
                                            <button
                                              key={color}
                                              onClick={() => setEditingDrive({ ...editingDrive, color })}
                                              className={`w-8 h-8 rounded-full transition-transform ${editingDrive.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                                              style={{ backgroundColor: color }}
                                            />
                                          ))}
                                        </div>
                                      </div>

                                      {/* Storage Allocation */}
                                      <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                          Storage Allocation: {Math.round((editingDrive.allocated_storage_bytes || 10737418240) / (1024 * 1024 * 1024))} GB
                                          <span className="text-slate-400 font-normal ml-2">
                                            (max {Math.round((drive.max_allocatable_bytes || 0) / (1024 * 1024 * 1024))} GB available)
                                          </span>
                                        </label>
                                        {drive.max_allocatable_bytes > 0 ? (
                                          <>
                                            <input
                                              type="range"
                                              min="1"
                                              max={Math.max(1, Math.round((drive.max_allocatable_bytes || 10737418240) / (1024 * 1024 * 1024)))}
                                              value={Math.min(
                                                Math.round((editingDrive.allocated_storage_bytes || 10737418240) / (1024 * 1024 * 1024)),
                                                Math.round((drive.max_allocatable_bytes || 10737418240) / (1024 * 1024 * 1024))
                                              )}
                                              onChange={(e) => setEditingDrive({
                                                ...editingDrive,
                                                allocated_storage_bytes: parseInt(e.target.value) * 1024 * 1024 * 1024
                                              })}
                                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                              <span>1 GB</span>
                                              <span>{Math.round((drive.max_allocatable_bytes || 0) / (1024 * 1024 * 1024))} GB</span>
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                                            Not enough space in Google Drive. Need at least 3GB available (1GB allocation + 2GB reserve for personal use).
                                          </p>
                                        )}
                                      </div>

                                      {/* Primary Toggle */}
                                      {!drive.is_primary && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={editingDrive.is_primary || false}
                                            onChange={(e) => setEditingDrive({ ...editingDrive, is_primary: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-slate-700">Set as primary drive</span>
                                        </label>
                                      )}

                                      {/* Save/Cancel Buttons */}
                                      <div className="flex gap-2 pt-2">
                                        <button
                                          onClick={() => handleUpdateDriveSettings(drive.id, {
                                            display_name: editingDrive.display_name,
                                            color: editingDrive.color,
                                            allocated_storage_bytes: editingDrive.allocated_storage_bytes,
                                            is_primary: editingDrive.is_primary,
                                          })}
                                          disabled={isSaving}
                                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
                                        >
                                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                          Save Changes
                                        </button>
                                        <button
                                          onClick={() => setEditingDrive(null)}
                                          className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add New Drive Section */}
                      {linkingStep ? (
                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                          {linkingStep === 'unlink-password' && (
                            <div className="space-y-4">
                              <p className="text-slate-700">
                                Enter your account password to confirm unlinking:
                              </p>

                              <input
                                type="password"
                                value={unlinkPassword}
                                onChange={(e) => setUnlinkPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="Enter your password"
                              />
                              <div className="flex gap-3">
                                <button
                                  onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                      await driveSettingsApi.unlinkDrive(editingDrive?.id, unlinkPassword);
                                      const drivesResult = await driveSettingsApi.getAllDrives();
                                      setAllDrives(drivesResult.drives || []);
                                      setDriveStatus(drivesResult.drives?.length > 0 ? { linked: true } : { linked: false });
                                      setMessage({ type: 'success', text: 'Drive disconnected successfully' });
                                    } catch (error) {
                                      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to unlink' });
                                    }
                                    setIsSaving(false);
                                    setLinkingStep(null);
                                    setOtp('');
                                    setEditingDrive(null);
                                  }}
                                  disabled={isSaving || !unlinkPassword}
                                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Unlink'}
                                </button>
                                <button
                                  onClick={() => {
                                    setLinkingStep(null);
                                    setUnlinkPassword('');
                                    setEditingDrive(null);
                                  }}
                                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-start gap-4">
                            <GoogleDriveLogo />
                            <div className="flex-1">
                              <h3 className="text-lg font-medium text-slate-900">
                                {allDrives.length > 0 ? 'Add Another Drive' : 'Connect Google Drive'}
                              </h3>
                              <p className="text-slate-600 mt-1">
                                {allDrives.length > 0
                                  ? 'Connect additional Google Drive accounts to expand your storage.'
                                  : 'Store your documents securely in your own Google Drive. Your data stays private and under your control.'}
                              </p>

                              {/* New Drive Name Input */}
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Drive Name (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={newDriveName}
                                    onChange={(e) => setNewDriveName(e.target.value)}
                                    placeholder={`Drive ${String.fromCharCode(65 + allDrives.length)}`}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>

                                {/* Storage Allocation Slider */}
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Initial Storage Allocation: {storageSlider} GB
                                    <span className="text-slate-400 font-normal ml-2">
                                      (max 13GB, adjusted based on available space)
                                    </span>
                                  </label>
                                  <p className="text-xs text-slate-500 mb-2">
                                    2GB will be reserved for your personal Google Drive use. Max allocation is 13GB (15GB total - 2GB reserve).
                                  </p>
                                  <input
                                    type="range"
                                    min="1"
                                    max="13"
                                    value={Math.min(storageSlider, 13)}
                                    onChange={(e) => setStorageSlider(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                  />
                                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>1 GB</span>
                                    <span>13 GB (max)</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={handleConnectDrive}
                                className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors duration-200"
                              >
                                <LinkIcon className="w-4 h-4" />
                                Connect Google Drive
                              </button>
                            </div>
                          </div>

                          {allDrives.length === 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3 text-sm text-slate-600">
                              <p className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                                Files are stored in a dedicated DocMatrix folder
                              </p>
                              <p className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                                We only access files within that folder
                              </p>
                              <p className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                                Connect multiple drives with adjustable storage
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Combined Storage Overview */}
                      {allDrives.length > 0 && driveQuota && (
                        <div className="p-4 bg-slate-100 rounded-xl">
                          <h3 className="text-sm font-medium text-slate-700 mb-3">Combined Storage Overview</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Total Used</span>
                              <span className="text-slate-900 font-medium">
                                {formatBytes(driveQuota.combined_used_bytes || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Total Allocated</span>
                              <span className="text-slate-900 font-medium">
                                {formatBytes(driveQuota.combined_allocated_bytes || 0)}
                              </span>
                            </div>
                            <div className="h-3 bg-slate-200 rounded-full overflow-hidden flex mt-2">
                              {allDrives.map((drive, index) => {
                                const used = drive.quota_bytes_used || 0;
                                const totalAllocated = driveQuota.combined_allocated_bytes || 1;
                                return (
                                  <div
                                    key={drive.id}
                                    className="h-full transition-all duration-300"
                                    style={{
                                      width: `${(used / totalAllocated) * 100}%`,
                                      backgroundColor: drive.color || '#3b82f6'
                                    }}
                                    title={`${drive.label || `Drive ${String.fromCharCode(65 + index)}`}: ${formatBytes(used)}`}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex gap-3 mt-2">
                              {allDrives.map((drive, index) => (
                                <div key={drive.id} className="flex items-center gap-1 text-xs text-slate-600">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: drive.color || '#3b82f6' }}
                                  />
                                  {drive.label || `Drive ${String.fromCharCode(65 + index)}`}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Storage Tab */}
                  {activeTab === 'storage' && storage && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <h2 className="text-lg font-semibold text-slate-900">Storage Overview</h2>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-100 rounded-lg">
                          <p className="text-slate-600 text-sm">Total Files</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">{storage.total_files}</p>
                        </div>
                        <div className="p-4 bg-slate-100 rounded-lg">
                          <p className="text-slate-600 text-sm">Total Folders</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">{storage.total_folders}</p>
                        </div>
                        <div className="p-4 bg-slate-100 rounded-lg">
                          <p className="text-slate-600 text-sm">Used Storage</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1">{formatBytes(storage.used_bytes)}</p>
                        </div>
                      </div>

                      {storage.by_type && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-slate-700">By File Type</h3>
                          {Object.entries(storage.by_type).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between py-2 border-b border-slate-200">
                              <span className="text-slate-700">{type}</span>
                              <span className="text-slate-600">{count} files</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MEGA Storage Tab */}
                  {activeTab === 'mega' && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <section className="relative overflow-hidden rounded-2xl border border-navy-200 bg-navy-800 p-6 text-white">
                        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">DocMatrix Storage</p>
                            <h2 className="text-2xl md:text-3xl font-semibold">MEGA Workspace</h2>
                            <p className="max-w-2xl text-sm md:text-base text-slate-200">
                              Connect your MEGA account and manage files from a dedicated DocMatrix folder with upload, download, and cleanup controls.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={`px-2.5 py-1 rounded-full ${megaStatus?.connected ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/20' : 'bg-slate-300/15 text-slate-200 border border-slate-200/15'}`}>
                                {megaStatus?.connected ? 'Connected' : 'Not connected'}
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-slate-300/15 text-slate-200 border border-slate-200/15">
                                Free tier up to 20GB
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => window.open('https://mega.nz/register', '_blank', 'noopener,noreferrer')}
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors duration-200"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Create MEGA Account
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  if (!isLegacyMode) {
                                    const status = await megaSettingsApi.getStatus();
                                    const nextStatus = status || megaStatus;
                                    setMegaStatus(nextStatus);
                                    if (nextStatus?.connected) {
                                      await refreshMegaFiles();
                                    } else {
                                      setMegaFiles([]);
                                    }
                                  } else {
                                    await refreshMegaFiles();
                                  }
                                } catch (error) {
                                  setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to refresh MEGA files.' });
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors duration-200"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Sync
                            </button>
                          </div>
                        </div>
                      </section>

                      {megaStatus?.warning && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                          {megaStatus.warning}
                        </div>
                      )}

                      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Files</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{megaFileCount}</p>
                          <p className="mt-1 text-xs text-slate-500">Items in your DocMatrix folder</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Used Storage</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(megaTotalBytes)}</p>
                          <p className="mt-1 text-xs text-slate-500">Current visible file size total</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Largest File</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(megaLargestBytes)}</p>
                          <p className="mt-1 text-xs text-slate-500">Quick capacity insight</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Remaining Space</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatBytes(megaRemainingBytes)}</p>
                          <p className="mt-1 text-xs text-slate-500">Estimated from 20GB MEGA plan</p>
                        </div>
                      </section>

                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-slate-900">MEGA Pipeline Diagnostics</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${megaDiagnostics.success === false ? 'bg-red-100 text-red-700' : megaDiagnostics.success === true ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                            {megaDiagnostics.success === false ? 'Degraded' : megaDiagnostics.success === true ? 'Healthy' : 'No sample'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-slate-500">Last Operation</p>
                            <p className="font-medium text-slate-900 mt-1">{megaDiagnostics.lastOperation || '-'}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-slate-500">Latency</p>
                            <p className="font-medium text-slate-900 mt-1">{megaDiagnostics.latencyMs != null ? `${megaDiagnostics.latencyMs} ms` : '-'}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-slate-500">Updated</p>
                            <p className="font-medium text-slate-900 mt-1">{megaDiagnostics.updatedAt ? new Date(megaDiagnostics.updatedAt).toLocaleTimeString() : '-'}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <p className="text-slate-500">Last Error</p>
                            <p className="font-medium text-slate-900 mt-1 truncate" title={megaDiagnostics.error || ''}>{megaDiagnostics.error || '-'}</p>
                          </div>
                        </div>
                      </section>

                      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Connection</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${megaStatus?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                              {megaStatus?.connected ? 'Active' : 'Pending'}
                            </span>
                          </div>

                          {megaStatus?.connected ? (
                            <div className="space-y-3 text-sm text-slate-700">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-xs text-slate-500">MEGA Email</p>
                                <p className="font-medium text-slate-900 break-all">{megaStatus.mega_email || '-'}</p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-xs text-slate-500">DocMatrix Folder</p>
                                <p className="font-medium text-slate-900 break-all">{megaStatus.folder_name || '-'}</p>
                              </div>
                              <p className="text-xs text-slate-500">Connection is verified and ready for file operations.</p>
                              <p className="text-xs text-amber-700">If your MEGA account prompts 2FA on web login, this page may require you to complete that challenge directly on MEGA first.</p>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  onClick={() => setShowMegaReconnect((prev) => !prev)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  {showMegaReconnect ? 'Cancel Reconnect' : 'Reconnect / Switch Account'}
                                </button>
                                <button
                                  onClick={handleDisconnectMega}
                                  disabled={megaDisconnecting}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                                >
                                  {megaDisconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                                  Disconnect
                                </button>
                              </div>

                              {showMegaReconnect && (
                                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-xs text-slate-600">Provide credentials for the account you want to use. If different from current one, DocMatrix will ask for confirmation before replacing the link.</p>
                                  <input
                                    type="email"
                                    value={megaEmail}
                                    onChange={(e) => setMegaEmail(e.target.value)}
                                    placeholder="MEGA email"
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                  />
                                  <input
                                    type="password"
                                    value={megaPassword}
                                    onChange={(e) => setMegaPassword(e.target.value)}
                                    placeholder="MEGA password"
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                  />
                                  <button
                                    onClick={() => handleConnectMega(false)}
                                    disabled={isSaving}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-60"
                                  >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                                    Verify & Reconnect
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <input
                                type="email"
                                value={megaEmail}
                                onChange={(e) => setMegaEmail(e.target.value)}
                                placeholder="MEGA email"
                                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                              />
                              <input
                                type="password"
                                value={megaPassword}
                                onChange={(e) => setMegaPassword(e.target.value)}
                                placeholder="MEGA password"
                                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                              />
                              <button
                                onClick={() => handleConnectMega(false)}
                                disabled={isSaving}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors duration-200 disabled:opacity-60"
                              >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                                Connect & Verify
                              </button>
                            </div>
                          )}

                          {megaStatus?.connected && (
                            <label className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors duration-200">
                              {megaUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              Upload File
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => handleMegaUpload(e.target.files?.[0])}
                                disabled={megaUploading}
                              />
                            </label>
                          )}
                        </div>

                        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">MEGA File Manager</h3>
                            <p className="text-xs text-slate-500">{megaFileCount} file{megaFileCount !== 1 ? 's' : ''}</p>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="text-left px-4 py-3 font-medium">File Name</th>
                                  <th className="text-left px-4 py-3 font-medium">Size</th>
                                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {megaFiles.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                                      {megaStatus?.connected
                                        ? 'No files found in your MEGA DocMatrix folder.'
                                        : 'Connect your account to view and manage files.'}
                                    </td>
                                  </tr>
                                ) : megaFiles.map((file) => (
                                  <tr key={file.file_id} className="border-t border-slate-200">
                                    <td className="px-4 py-3 text-slate-900 max-w-[22rem] truncate" title={file.name}>{file.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{formatBytes(file.size_bytes || 0)}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => handleMegaDownload(file.file_id, file.name)}
                                          disabled={megaActionFileId === file.file_id}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                                        >
                                          <Download className="w-4 h-4" />
                                          Download
                                        </button>
                                        <button
                                          onClick={() => handleMegaDelete(file.file_id)}
                                          disabled={megaActionFileId === file.file_id}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                                        >
                                          {megaActionFileId === file.file_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}

                  {/* Security Tab */}
                  {activeTab === 'security' && (
                    <div className="settings-panel p-6 sm:p-8 space-y-6">
                      <h2 className="text-lg font-semibold text-slate-900">Security Settings</h2>

                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-700">Recent Login History</h3>
                        {sessions.length > 0 ? (
                          <div className="space-y-2">
                            {sessions.map((session, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-slate-600" />
                                  <div>
                                    <p className="text-sm text-slate-900">{session.device || 'Unknown device'}</p>
                                    <p className="text-xs text-slate-600">{session.location || session.ip_address}</p>
                                  </div>
                                </div>
                                <span className="text-xs text-slate-600">{new Date(session.created_at).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-600 text-sm">No recent login history</p>
                        )}
                      </div>

                      <div className="pt-6 border-t border-slate-200">
                        <h3 className="text-sm font-medium text-red-400 mb-4">Danger Zone</h3>
                        <button
                          className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </button>
                        <p className="mt-2 text-xs text-slate-500">
                          This action is irreversible. All your data will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
