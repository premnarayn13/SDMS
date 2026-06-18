/**
 * Settings API Client
 * API calls for user settings, profile, and multi-drive operations
 */
import axios from 'axios';
import { tokenUtils } from './authApi';

const resolveSettingsApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL || '').trim();
  const normalizedConfigured = configured.replace(/\/+$/, '');

  if (normalizedConfigured) {
    return normalizedConfigured;
  }

  // Use same-origin by default so hosted deployments work without hardcoded hosts.
  if (!import.meta.env.DEV) {
    return '';
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  if (typeof window !== 'undefined') {
    const appHost = window.location.hostname;
    if (appHost === 'localhost' || appHost === '127.0.0.1') {
      return '';
    }
  }

  return '';
};

const API_BASE_URL = resolveSettingsApiBaseUrl();
const API_V1 = `${API_BASE_URL}/api/v1`;

const parseIntEnv = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const RETRY_COUNT = parseIntEnv(import.meta.env.VITE_MEGA_RETRY_COUNT, import.meta.env.DEV ? 2 : 1);
const RETRY_BASE_MS = parseIntEnv(import.meta.env.VITE_MEGA_RETRY_BASE_MS, import.meta.env.DEV ? 300 : 250);

const MEGA_TIMEOUTS = {
  status: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_STATUS_MS, 15000),
  list: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_LIST_MS, 25000),
  connect: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_CONNECT_MS, 60000),
  upload: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_UPLOAD_MS, 120000),
  download: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_DOWNLOAD_MS, 120000),
  disconnect: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_DISCONNECT_MS, 20000),
  delete: parseIntEnv(import.meta.env.VITE_MEGA_TIMEOUT_DELETE_MS, 20000),
};

// Create axios instance with auth
const createAuthApi = (baseUrl) => {
  const instance = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 20000,
  });
  
  instance.interceptors.request.use((config) => {
    const token = tokenUtils.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle token refresh on 401
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config;
      if (!originalRequest) {
        return Promise.reject(error);
      }
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = tokenUtils.getRefreshToken();
          if (refreshToken) {
            const response = await axios.post(`${API_V1}/auth/refresh`, {
              refresh_token: refreshToken
            }, {
              withCredentials: true,
              timeout: 15000,
            });
            const { access_token, refresh_token } = response.data;
            tokenUtils.setTokens(access_token, refresh_token);
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return instance(originalRequest);
          }
        } catch (refreshError) {
          tokenUtils.clearAll();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

const usersApi = createAuthApi(`${API_V1}/users`);
const driveApi = createAuthApi(`${API_V1}/drive`);
const megaApi = createAuthApi(`${API_V1}/mega`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetriableError = (error) => {
  const status = error?.response?.status;
  if (!status) return true; // Network, timeout, CORS, gateway path issues
  return status === 408 || status === 429 || status >= 500;
};

const withRetry = async (requestFn, options = {}) => {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetriableError(error)) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 120);
      await sleep(baseDelayMs * (2 ** attempt) + jitter);
    }
  }

  throw lastError;
};

/**
 * User Settings API
 */
export const userSettingsApi = {
  // Get current user profile
  getProfile: async () => {
    const response = await usersApi.get('/me');
    return response.data;
  },
  
  // Update profile
  updateProfile: async (data) => {
    const response = await usersApi.put('/me', data);
    return response.data;
  },
  
  // Get preferences
  getPreferences: async () => {
    const response = await usersApi.get('/me/preferences');
    return response.data;
  },
  
  // Update preferences
  updatePreferences: async (data) => {
    const response = await usersApi.put('/me/preferences', data);
    return response.data;
  },
  
  // Get storage usage
  getStorageUsage: async () => {
    const response = await usersApi.get('/me/storage');
    return response.data;
  },
  
  // Get activity log
  getActivityLog: async (params) => {
    const response = await usersApi.get('/me/activity', { params });
    return response.data;
  },
  
  // Get login history
  getLoginHistory: async () => {
    const response = await usersApi.get('/me/login-history');
    return response.data;
  },
  
  // Request account deletion
  requestDeleteAccount: async () => {
    const response = await usersApi.post('/me/request-delete');
    return response.data;
  },
  
  // Confirm account deletion with OTP
  deleteAccount: async (otp, password) => {
    const response = await usersApi.delete('/me', {
      data: { otp, password }
    });
    return response.data;
  },
};

/**
 * Multi-Drive Google Drive API
 */
export const driveSettingsApi = {
  // Get primary drive status (backward compatible)
  getStatus: async () => {
    const response = await driveApi.get('/status');
    return response.data;
  },
  
  // Get all linked drives
  getAllDrives: async () => {
    const response = await driveApi.get('/list');
    return response.data;
  },
  
  // Get a specific drive by ID
  getDriveById: async (driveId) => {
    const response = await driveApi.get(`/by-id/${driveId}`);
    return response.data;
  },
  
  // Initiate drive linking (can specify display name)
  initiateLinking: async (displayName = null) => {
    const response = await driveApi.post('/link/initiate', { display_name: displayName });
    return response.data;
  },
  
  // Verify OTP and complete linking
  verifyAndLink: async (otp, pending_drive_id, displayName = null) => {
    const response = await driveApi.post('/link/verify', { 
      otp, 
      pending_drive_id,
      display_name: displayName 
    });
    return response.data;
  },
  
  // Get quota info for a specific drive or primary drive
  getQuota: async (driveId = null) => {
    const params = driveId ? { drive_id: driveId } : {};
    const response = await driveApi.get('/quota', { params });
    return response.data;
  },
  
  // Get combined quota for all drives
  getAllDrivesQuota: async () => {
    const response = await driveApi.get('/quota/all');
    return response.data;
  },
  
  // Update drive settings (name, color, primary status)
  updateDriveSettings: async (driveId, settings) => {
    const response = await driveApi.patch(`/by-id/${driveId}`, settings);
    return response.data;
  },
  
  // Update storage allocation for a drive (1GB to 100GB)
  updateStorageAllocation: async (driveId, allocatedBytes) => {
    const response = await driveApi.patch(`/by-id/${driveId}/storage`, {
      allocated_bytes: allocatedBytes
    });
    return response.data;
  },
  
  // Request unlink OTP for a specific drive
  requestUnlink: async (driveId = null) => {
    const params = driveId ? { drive_id: driveId } : {};
    const response = await driveApi.post('/unlink/request', null, { params });
    return response.data;
  },
  
  // Unlink drive with OTP
  unlinkDrive: async (driveId, password) => {
  const response = await driveApi.post('/unlink', {
    drive_id: driveId,
    password: password
  });
  return response.data;
},
  
  // Reauthorize a specific drive
  reauthorizeDrive: async (driveId) => {
    const response = await driveApi.get(`/by-id/${driveId}/reauthorize`);
    return response.data;
  },
  
  // Refresh connection (legacy)
  refreshConnection: async () => {
    const response = await driveApi.post('/refresh');
    return response.data;
  },
};

/**
 * MEGA Storage API
 */
export const megaSettingsApi = {
  getStatus: async () => {
    const response = await withRetry(
      () => megaApi.get('/status', { timeout: MEGA_TIMEOUTS.status }),
      { retries: RETRY_COUNT, baseDelayMs: RETRY_BASE_MS }
    );
    return response.data;
  },

  connectMega: async (mega_email, mega_password, force_reconnect = false) => {
    const response = await withRetry(
      () => megaApi.post('/connect-mega', { mega_email, mega_password, force_reconnect }, { timeout: MEGA_TIMEOUTS.connect }),
      { retries: Math.max(1, RETRY_COUNT - 1), baseDelayMs: RETRY_BASE_MS + 200 }
    );
    return response.data;
  },

  disconnectMega: async () => {
    const response = await withRetry(
      () => megaApi.delete('/disconnect', { timeout: MEGA_TIMEOUTS.disconnect }),
      { retries: Math.max(1, RETRY_COUNT - 1), baseDelayMs: RETRY_BASE_MS }
    );
    return response.data;
  },

  listFiles: async () => {
    const response = await withRetry(
      () => megaApi.get('/files', { timeout: MEGA_TIMEOUTS.list }),
      { retries: RETRY_COUNT, baseDelayMs: RETRY_BASE_MS }
    );
    return response.data;
  },

  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await withRetry(
      () => megaApi.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: MEGA_TIMEOUTS.upload,
      }),
      { retries: Math.max(1, RETRY_COUNT - 1), baseDelayMs: RETRY_BASE_MS + 400 }
    );
    return response.data;
  },

  downloadFile: async (fileId) => {
    const response = await withRetry(
      () => megaApi.get(`/download/${fileId}`, {
        responseType: 'blob',
        timeout: MEGA_TIMEOUTS.download,
      }),
      { retries: Math.max(1, RETRY_COUNT - 1), baseDelayMs: RETRY_BASE_MS + 400 }
    );
    return response.data;
  },

  deleteFile: async (fileId) => {
    const response = await withRetry(
      () => megaApi.delete(`/file/${fileId}`, { timeout: MEGA_TIMEOUTS.delete }),
      { retries: Math.max(1, RETRY_COUNT - 1), baseDelayMs: RETRY_BASE_MS }
    );
    return response.data;
  },
};

/**
 * Helper functions for storage calculations
 */
export const storageUtils = {
  // Reserve 2GB for user's personal Drive usage
  DRIVE_RESERVE_BYTES: 2 * 1024 * 1024 * 1024,
  MIN_ALLOCATION_BYTES: 1 * 1024 * 1024 * 1024,
  MAX_DRIVE_STORAGE_BYTES: 15 * 1024 * 1024 * 1024,  // 15GB max (free Google Drive)
  MAX_ALLOCATABLE_BYTES: 13 * 1024 * 1024 * 1024,    // 13GB max allocation (15GB - 2GB reserve)
  
  // Format bytes to human readable
  formatBytes: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  // Convert GB to bytes
  gbToBytes: (gb) => gb * 1024 * 1024 * 1024,
  
  // Convert bytes to GB
  bytesToGb: (bytes) => bytes / (1024 * 1024 * 1024),
  
  // Calculate max allocatable bytes (total - used - 2GB reserve, max 13GB)
  calculateMaxAllocatable: (totalBytes, usedBytes) => {
    if (!totalBytes || totalBytes <= 0) return 0;
    const available = totalBytes - (usedBytes || 0);
    let maxAllocatable = available - storageUtils.DRIVE_RESERVE_BYTES;
    maxAllocatable = Math.max(0, Math.floor(maxAllocatable / (1024 * 1024 * 1024)) * (1024 * 1024 * 1024));
    // Cap at 13GB maximum
    return Math.min(maxAllocatable, storageUtils.MAX_ALLOCATABLE_BYTES);
  },
  
  // Calculate percentage
  calculatePercent: (used, total) => {
    if (!total || total === 0) return 0;
    return Math.min(100, (used / total) * 100);
  },
  
  // Get color based on usage percentage
  getUsageColor: (percent) => {
    if (percent > 90) return '#ef4444'; // Red
    if (percent > 70) return '#f59e0b'; // Amber
    return '#22c55e'; // Green
  },
};

export default { userSettingsApi, driveSettingsApi, megaSettingsApi };
