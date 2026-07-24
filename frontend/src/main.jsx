import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppWithAuth from './AppWithAuth.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

// Apply saved UI scale on boot so the layout is correct from the first render
try {
  const saved = JSON.parse(localStorage.getItem('docmatrix_ui_customization') || '{}');
  const scale = (saved.scale || 100) / 100;
  if (scale !== 1) {
    document.documentElement.style.zoom = String(scale);
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
