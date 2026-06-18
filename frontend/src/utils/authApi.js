/**
 * Authentication API Client
 * Handles all auth-related API calls
 */
import axios from 'axios';

const resolveAuthApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_URL || '').trim();
  const normalizedConfigured = configured.replace(/\/+$/, '');

  // In development prefer an explicit backend origin to avoid intermittent proxy
  // failures that surface as "Auth server unreachable" on login.
  if (import.meta.env.DEV) {
    return normalizedConfigured || 'http://localhost:8000';
  }

  if (normalizedConfigured) {
    return normalizedConfigured;
  }

  if (typeof window !== 'undefined') {
    const appHost = window.location.hostname;
    if (appHost === 'localhost' || appHost === '127.0.0.1') {
      return import.meta.env.DEV ? '' : 'http://localhost:8000';
    }
  }

  return '';
};

const API_BASE_URL = resolveAuthApiBaseUrl();
const API_V1 = `${API_BASE_URL}/api/v1`;

// Create axios instance for auth
const authApi = axios.create({
  baseURL: `${API_V1}/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30 second timeout to tolerate transient auth backend latency
});

const getAuthFallbackBases = () => {
  const bases = [];
  if (API_BASE_URL) bases.push(API_BASE_URL);
  bases.push('http://localhost:8000');
  bases.push('http://127.0.0.1:8000');
  // Proxy path fallback when Vite dev proxy is active.
  bases.push('');

  return Array.from(new Set(bases));
};

const postAuthWithFallback = async (path, data) => {
  const fallbackBases = getAuthFallbackBases();
  let lastError;

  for (const base of fallbackBases) {
    try {
      const url = `${base}/api/v1/auth${path}`;
      return await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        timeout: 30000,
      });
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      // If backend responded, stop fallback and return semantic error.
      if (status) {
        throw error;
      }
    }
  }

  throw lastError;
};

// Token storage keys
const ACCESS_TOKEN_KEY = 'docmatrix_access_token';
const REFRESH_TOKEN_KEY = 'docmatrix_refresh_token';
const USER_KEY = 'docmatrix_user';
let refreshInFlight = null;

/**
 * Token management utilities
 */
export const tokenUtils = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: () => {
    const user = localStorage.getItem(USER_KEY);
    if (!user) return null;
    try {
      return JSON.parse(user);
    } catch (_) {
      // Corrupt storage can break auth init and leave the app stuck loading.
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  
  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  
  clearAll: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  isAuthenticated: () => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  }
};

const isTerminalAuthFailure = (error) => {
  const status = error?.response?.status;
  return status === 400 || status === 401 || status === 403;
};

const refreshAccessTokenSingleFlight = async () => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = tokenUtils.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  refreshInFlight = axios.post(`${API_V1}/auth/refresh`, {
    refresh_token: refreshToken
  }, {
    withCredentials: true,
    timeout: 15000,
  }).then((response) => {
    const { access_token, refresh_token } = response.data || {};
    if (!access_token) {
      throw new Error('Refresh response did not include an access token');
    }
    tokenUtils.setTokens(access_token, refresh_token);
    return access_token;
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

export const authSessionUtils = {
  refreshAccessToken: refreshAccessTokenSingleFlight,
};

/**
 * Add auth header to requests
 */
authApi.interceptors.request.use((config) => {
  const token = tokenUtils.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Handle token refresh on 401
 */
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const accessToken = await refreshAccessTokenSingleFlight();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return authApi(originalRequest);
      } catch (refreshError) {
        if (isTerminalAuthFailure(refreshError)) {
          tokenUtils.clearAll();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Auth API functions
 */
export const authApiClient = {
  getAuthBasePath: () => `${API_V1}/auth`,
  /**
   * Register new user
   */
  register: async (data) => {
    const response = await authApi.post('/register', data);
    return response.data;
  },
  
  /**
   * Verify email with OTP
   */
 
  
  /**
   * Resend verification OTP
   */
 
  
  /**
   * Login with email/password
   */
  login: async (email, password) => {
    const response = await postAuthWithFallback('/login', { email, password });
    const { tokens, user } = response.data;
    
    tokenUtils.setTokens(tokens.access_token, tokens.refresh_token);
    tokenUtils.setUser(user);
    
    return response.data;
  },
  
  /**
   * Get Google OAuth URL
   */
  getGoogleAuthUrl: async () => {
    // Backend /google endpoint responds with redirects, not JSON.
    // Return a direct URL the browser can navigate to.
    return `${API_V1}/auth/google`;
  },
  
  /**
   * Handle Google OAuth callback
   */
  handleGoogleCallback: async (code) => {
    const response = await authApi.post('/google/token', { code });
    
    const { tokens, user } = response.data;
    tokenUtils.setTokens(tokens.access_token, tokens.refresh_token);
    tokenUtils.setUser(user);
    
    return response.data;
  },
  
  /**
   * Refresh access token
   */
  refreshToken: async () => {
    const refreshToken = tokenUtils.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    
    const response = await authApi.post('/refresh', {
      refresh_token: refreshToken
    });
    
    const { access_token, refresh_token } = response.data;
    tokenUtils.setTokens(access_token, refresh_token);
    
    return response.data;
  },
  
  /**
   * Logout
   */
  logout: async () => {
    try {
      await authApi.post('/logout');
    } finally {
      tokenUtils.clearAll();
    }
  },
  
  /**
   * Forgot password - request reset
   */
  forgotPassword: async (email) => {
    const response = await authApi.post('/forgot-password', { email });
    return response.data;
  },
  
  /**
   * Verify reset OTP
   */
  verifyResetOtp: async (email, otp) => {
    const response = await authApi.post('/verify-reset-otp', { email, otp });
    return response.data;
  },
  
  /**
   * Reset password with token
   */
  resetPassword: async (token, newPassword) => {
    const response = await authApi.post('/reset-password', {
      token,
      new_password: newPassword
    });
    return response.data;
  },
  
  /**
   * Get current user profile
   */
  getProfile: async () => {
    const response = await authApi.get('/me');
    tokenUtils.setUser(response.data);
    return response.data;
  },
  
  /**
   * Get active sessions
   */
  getSessions: async () => {
    const response = await authApi.get('/sessions');
    return response.data;
  },
  
  /**
   * Revoke a session
   */
  revokeSession: async (sessionId) => {
    const response = await authApi.delete(`/sessions/${sessionId}`);
    return response.data;
  }
};

export default authApiClient;
