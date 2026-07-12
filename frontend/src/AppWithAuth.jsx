/**
 * Main Application Entry Point
 * Combines legacy app with new auth routing
 */
import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Auth Pages
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ProtectedRoute,
  GoogleCallback,
  DriveSetupPage,
  PlatformInfoPage,
} from './components/auth';
import { isDriveSetupCompleted } from './utils/driveSetup';
import { AdminSpecialLogin, AdminMissionControl, isAdminAuthenticated } from './components/admin';

// Settings
import { SettingsPage, StorageManagerPage } from './components/settings';

// Public Presentation Pages
import FeaturesPage from './components/presentation/FeaturesPage';
import AboutPage from './components/presentation/AboutPage';
import DataPage from './components/presentation/DataPage';
import DocsPage from './components/presentation/DocsPage';
import SupportPage from './components/presentation/SupportPage';

// Legacy App Content (the main document management interface)
// Note: App component already includes AppProvider wrapper
import App from './App';

// Check if running in legacy mode (no auth required)
const isLegacyMode = import.meta.env.VITE_LEGACY_MODE === 'true';

function AdminRoute({ children }) {
  return isAdminAuthenticated() ? children : <Navigate to="/admin/login" replace />;
}

/**
 * Legacy mode app wrapper - provides navigation without auth
 */
function LegacyApp() {
  const navigate = useNavigate();
  
  const handleSettingsClick = () => {
    navigate('/settings');
  };
  
  const handleLogout = () => {
    // In legacy mode, just refresh the app
    window.location.reload();
  };
  
  // Demo user for legacy mode
  const demoUser = {
    name: 'Local User',
    email: 'user@local.docmatrix'
  };
  
  return (
    <App 
      user={demoUser}
      onSettingsClick={handleSettingsClick}
      onLogout={handleLogout}
    />
  );
}

/**
 * Wrapper to inject auth props into App
 */
function AuthenticatedApp() {
  const { state, actions } = useAuth();
  const navigate = useNavigate();
  
  const handleSettingsClick = () => {
    navigate('/settings');
  };
  
  const handleLogout = async () => {
    await actions.logout();
    navigate('/login');
  };
  
  return (
    <App 
      user={state.user}
      onSettingsClick={handleSettingsClick}
      onLogout={handleLogout}
    />
  );
}

/**
 * Root App Component with Routes
 * Handles authentication and main app routing
 */
export default function AppWithAuth() {
  const { state } = useAuth();
  const { isAuthenticated, user } = state;
  const requiresDriveSetup = isAuthenticated && user && !isDriveSetupCompleted(user);
  
  // In legacy mode, use routing but without auth requirements
  if (isLegacyMode) {
    return (
      <Routes>
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/special-login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/special-login" element={<Navigate to="/admin/login" replace />} />
        <Route
          path="/admin/login"
          element={isAdminAuthenticated() ? <Navigate to="/admin/mission-control" replace /> : <AdminSpecialLogin />}
        />
        <Route
          path="/admin/mission-control"
          element={
            <AdminRoute>
              <AdminMissionControl />
            </AdminRoute>
          }
        />

        {/* Settings Route */}
        <Route path="/settings/*" element={<SettingsPage />} />
        
        {/* Storage Manager Route */}
        <Route path="/storage" element={<StorageManagerPage />} />

        <Route path="/platform/:section" element={<PlatformInfoPage />} />

        {/* Public Presentation Routes */}
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/support" element={<SupportPage />} />
        
        {/* Main App */}
        <Route path="/*" element={<LegacyApp />} />
      </Routes>
    );
  }
  
  return (
    <Routes>
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/special-login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/special-login" element={<Navigate to="/admin/login" replace />} />
      <Route
        path="/admin/login"
        element={isAdminAuthenticated() ? <Navigate to="/admin/mission-control" replace /> : <AdminSpecialLogin />}
      />
      <Route
        path="/admin/mission-control"
        element={
          <AdminRoute>
            <AdminMissionControl />
          </AdminRoute>
        }
      />

      {/* Public Auth Routes */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route path="/register" element={
        isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />
      } />
  
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<GoogleCallback />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/platform/:section" element={<PlatformInfoPage />} />

      {/* Public Presentation Routes */}
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/data" element={<DataPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/support" element={<SupportPage />} />

      <Route path="/drive-setup" element={
        <ProtectedRoute>
          <DriveSetupPage />
        </ProtectedRoute>
      } />
      
      {/* Protected Routes */}
      <Route path="/settings/*" element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      } />
      
      {/* Storage Manager - Protected */}
      <Route path="/storage" element={
        <ProtectedRoute>
          <StorageManagerPage />
        </ProtectedRoute>
      } />
      
      {/* Main App - Protected */}
      <Route path="/*" element={
        <ProtectedRoute>
          {requiresDriveSetup ? <Navigate to="/drive-setup" replace /> : <AuthenticatedApp />}
        </ProtectedRoute>
      } />
    </Routes>
  );
}
