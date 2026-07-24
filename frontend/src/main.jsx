import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppWithAuth from './AppWithAuth.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

// Clear any previously saved zoom/scale that was incorrectly applied to the whole page
try {
  document.documentElement.style.zoom = '';
  document.documentElement.style.removeProperty('zoom');
  // Also clear any bad scale saved in localStorage - reset to 100
  const saved = JSON.parse(localStorage.getItem('docmatrix_ui_customization') || '{}');
  if (saved.scale && saved.scale !== 100) {
    saved.scale = 100;
    localStorage.setItem('docmatrix_ui_customization', JSON.stringify(saved));
  }
} catch (_) { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
