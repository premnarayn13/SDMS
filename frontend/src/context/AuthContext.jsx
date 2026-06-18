/**
 * Authentication Context
 * Manages auth state across the application
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApiClient, tokenUtils } from '../utils/authApi';

// Auth state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
   // { email } - for email verification flow
};

// Action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    
    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };
    
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext(null);

// Demo mode flag - set to true to bypass real API for testing
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        // In demo mode, check for demo user
        if (DEMO_MODE) {
          const demoUser = localStorage.getItem('demo_user');
          if (demoUser) {
            dispatch({ type: AUTH_ACTIONS.SET_USER, payload: JSON.parse(demoUser) });
          } else {
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
          }
          return;
        }

        const storedUser = tokenUtils.getUser();
        const isAuth = tokenUtils.isAuthenticated();

        if (isAuth && storedUser) {
          try {
            // Verify token is still valid
            const user = await authApiClient.getProfile();
            dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
          } catch (error) {
            // Token invalid, clear storage
            tokenUtils.clearAll();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
          }
        } else {
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      } catch (error) {
        // Any unexpected error during init should never block the UI.
        tokenUtils.clearAll();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    };
    
    initAuth();
  }, []);
  
  // Actions
  const actions = {
    /**
     * Register new user
     */
    register: useCallback(async (data) => {
      // Don't set global loading - the form should manage its own loading state
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      
      // Demo mode - simulate registration
      if (DEMO_MODE) {
        await new Promise(r => setTimeout(r, 1000)); // Simulate network delay
        
        return { success: true, message: 'Demo: Check console for OTP (123456)' };
      }
      
      try {
        const result = await authApiClient.register(data);
        
        return { success: true, message: result.message };
      } catch (error) {
        const message = error.response?.data?.detail || 'Registration failed';
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
        return { success: false, message };
      }
    }, []),
    
    /**
     * Verify email with OTP
     */
    
    /**
     * Login with email/password
     */
    login: useCallback(async (email, password) => {
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      
      // Demo mode - accept any credentials
      if (DEMO_MODE) {
          await new Promise(r => setTimeout(r, 1000));

           return {
               success: true,
               message: 'Registration successful'
          };
      }
      
      try {
        let result;
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            result = await authApiClient.login(email, password);
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            const statusCode = error?.response?.status;
            const isTransient = !statusCode || [502, 503, 504].includes(statusCode);
            if (!isTransient || attempt === 3) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
          }
        }

        if (!result && lastError) {
          throw lastError;
        }

        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: result.user });
        return { success: true };
      } catch (error) {
        let message = error.response?.data?.detail || 'Login failed';

        // Common local-dev failure: frontend is running but backend auth API is down.
        if (!error?.response) {
          message = 'Auth server unreachable. Start backend (python backend/run.py) and retry.';
        }

        if (error?.response?.status === 429) {
          message = 'Too many login attempts. Please wait 60 seconds and try again.';
        }

        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
        return { success: false, message };
      }
    }, []),
    
    /**
     * Login with Google
     */
    loginWithGoogle: useCallback(async () => {
      try {
        const authUrl = await authApiClient.getGoogleAuthUrl();
        window.location.href = authUrl;
      } catch (error) {
        const message = error.response?.data?.detail || 'Google login failed';
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
      }
    }, []),
    
    /**
     * Handle Google OAuth callback
     */
    handleGoogleCallback: useCallback(async (payload) => {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      try {
        const code = typeof payload === 'string' ? payload : payload?.code;
        const accessToken = typeof payload === 'object' ? payload?.accessToken : null;
        const refreshToken = typeof payload === 'object' ? payload?.refreshToken : null;

        let user = null;

        if (accessToken) {
          tokenUtils.setTokens(accessToken, refreshToken || undefined);
          user = await authApiClient.getProfile();
        } else if (code) {
          const result = await authApiClient.handleGoogleCallback(code);
          user = result.user;
        } else {
          throw new Error('No Google auth payload received');
        }

        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
        return { success: true };
      } catch (error) {
        const message = error.response?.data?.detail || 'Google login failed';
        dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: message });
        return { success: false, message };
      }
    }, []),
    
    /**
     * Logout
     */
    logout: useCallback(async () => {
      // Demo mode - clear demo user
      if (DEMO_MODE) {
        localStorage.removeItem('demo_user');
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
        return;
      }
      
      try {
        await authApiClient.logout();
      } finally {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    }, []),
    
    /**
     * Forgot password
     */
    forgotPassword: useCallback(async (email) => {
      try {
        const result = await authApiClient.forgotPassword(email);
        return { success: true, message: result.message };
      } catch (error) {
        const message = error.response?.data?.detail || 'Request failed';
        return { success: false, message };
      }
    }, []),
    
    /**
     * Verify reset OTP
     */
    verifyResetOtp: useCallback(async (email, otp) => {
      try {
        const result = await authApiClient.verifyResetOtp(email, otp);
        return { success: true, token: result.reset_token };
      } catch (error) {
        const message = error.response?.data?.detail || 'Verification failed';
        return { success: false, message };
      }
    }, []),
    
    /**
     * Reset password
     */
    resetPassword: useCallback(async (token, newPassword) => {
      try {
        const result = await authApiClient.resetPassword(token, newPassword);
        return { success: true, message: result.message };
      } catch (error) {
        const message = error.response?.data?.detail || 'Reset failed';
        return { success: false, message };
      }
    }, []),
    
    /**
     * Update user in state
     */
    updateUser: useCallback((user) => {
      tokenUtils.setUser(user);
      dispatch({ type: AUTH_ACTIONS.SET_USER, payload: user });
    }, []),
    
    /**
     * Clear error
     */
    clearError: useCallback(() => {
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
    }, []),
  };
  
  return (
    <AuthContext.Provider value={{ state, actions }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
