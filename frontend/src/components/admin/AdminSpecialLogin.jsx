import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import './AdminMissionControl.css';
import { ADMIN_CREDENTIALS, createAdminSession, isAdminAuthenticated, validateAdminLogin } from './adminAuth';

export default function AdminSpecialLogin() {
  const navigate = useNavigate();
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const goToAdminLogin = (event) => {
    if (event?.preventDefault) event.preventDefault();
    navigate('/admin/login');
  };

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate('/admin/mission-control', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateAdminLogin(adminId, password)) {
      setError('Unauthorized credentials. Access denied by DocMatrix Prime Gate.');
      return;
    }

    createAdminSession();
    navigate('/admin/mission-control', { replace: true });
  };

  return (
    <div className="special-login-root">
      <header className="absolute top-0 left-0 right-0 z-20 border-b border-cyan-100/20 bg-blue-950/55 backdrop-blur-xl">
        <div className="w-full px-5 lg:px-9 py-5 flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/40">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-100 text-2xl lg:text-3xl font-extrabold tracking-tight">DocMatrix</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <nav className="flex-1 flex items-center justify-center gap-1 text-[19px] font-semibold">
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/login">Home</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/features">Features</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/about">About</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/data">Data</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/docs">Docs</Link>
              <Link className="min-w-[102px] text-center px-5 py-2.5 rounded-lg text-cyan-100/90 hover:bg-cyan-100/10 hover:text-white transition-colors" to="/support">Support</Link>
              <button
                type="button"
                onClick={goToAdminLogin}
                className="min-w-[102px] text-center px-5 py-2.5 rounded-lg bg-cyan-400/20 text-cyan-100 hover:bg-cyan-300/25 hover:text-white transition-colors"
              >
                Admin
              </button>
            </nav>

            <div className="hidden xl:flex items-center relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/75" />
              <input
                type="text"
                placeholder="Search files"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-blue-900/45 border border-cyan-100/25 text-cyan-50 placeholder-cyan-100/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              />
            </div>

            <Link
              to="/register"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white text-base font-semibold hover:from-cyan-400 hover:via-sky-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-900/35"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <motion.div
        className="special-login-card mt-24"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="special-left">
          <div className="special-brand">DocMatrix Prime Ops</div>
          <h1 className="special-login-title">Mission Control Admin Access</h1>
          <p style={{ color: '#9ec4db', fontSize: 13, lineHeight: 1.6 }}>
            Enter the elite control console for ultra-dense telemetry, AI workload intelligence,
            system diagnostics, and strategic billing and retention forecasting.
          </p>

          <div className="credential-box">
            <div style={{ color: '#71d7ff', fontWeight: 700, marginBottom: 6 }}>Special Fixed Login</div>
            <div className="credential-line">Admin ID: {ADMIN_CREDENTIALS.adminId}</div>
            <div className="credential-line">Password: {ADMIN_CREDENTIALS.password}</div>
            <div style={{ marginTop: 8, color: '#89b9d2', fontSize: 12 }}>
              Credential is intentionally fixed for this dedicated admin mission-control route.
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            {[
              'Zero-scroll command center grid',
              'Full-screen expandable analytics deep dives',
              'Advanced charts: Sankey, treemap, box plot, heatmaps, histograms',
              'AI insight panel with anomaly and spike detection',
            ].map((line) => (
              <div
                key={line}
                style={{
                  border: '1px solid rgba(114, 196, 236, 0.26)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: 'rgba(10, 21, 40, 0.62)',
                  color: '#c8eaff',
                  fontSize: 12,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="special-right">
          <div style={{ color: '#daf2ff', fontSize: 20, fontWeight: 700, marginBottom: 18 }}>
            Authenticate as Prime Admin
          </div>

          <form onSubmit={handleSubmit}>
            <div className="special-field">
              <label>Admin ID</label>
              <input
                value={adminId}
                onChange={(event) => {
                  setAdminId(event.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter special admin id"
                autoComplete="off"
              />
            </div>

            <div className="special-field">
              <label>Security Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter fixed admin password"
                autoComplete="off"
              />
            </div>

            <button type="submit" className="special-login-btn">
              Enter Mission Control
            </button>

            {error ? <div className="special-error">{error}</div> : null}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
