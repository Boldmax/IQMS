import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { getDashboardStats } from './utils/api';

import StatusBar    from './components/layout/StatusBar';
import Sidebar      from './components/layout/Sidebar';
import Topbar       from './components/layout/Topbar';
import TrialBanner  from './components/layout/TrialBanner';
import { FeatureGate } from './components/layout/FeatureGate';

import LoginPage    from './pages/Login';
import Onboarding   from './pages/Onboarding';
import Billing      from './pages/Billing';
import Dashboard    from './pages/Dashboard';
import Profile      from './pages/Profile';
import Inspections  from './pages/Inspections';
import PunchList    from './pages/PunchList';
import QualityAudit from './pages/QualityAudit';
import {
  NCRPage, ProjectsPage, ITPPage, MaterialsPage,
  DocumentsPage, ResourcesPage, AuditPage, UsersPage, QualityPlanPage,
} from './pages/OtherPages';

import './styles/global.css';

// ── PROTECTED ROUTE ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div style={{ fontFamily: 'var(--fM)', fontSize: 12, color: 'var(--text-muted)' }}>Loading IQMS…</div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

// ── APP SHELL (authenticated layout) ─────────────────────────────────────────
const AppShell = () => {
  const location = useLocation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => getDashboardStats().then(r => setStats(r.data.data)).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      {/* Trial banner sits above everything */}
      <TrialBanner />
      <StatusBar stats={stats} />
      <Topbar stats={stats} pathname={location.pathname} />
      <div className="body-row">
        <Sidebar stats={stats} />
        <main className="main-content">
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/itp"         element={<ITPPage />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/quality-audit" element={<QualityAudit />} />
            <Route path="/quality-planning" element={<QualityPlanPage />} />
            <Route path="/ncr"         element={<NCRPage />} />

            {/* Feature-gated routes — show upgrade prompt if plan doesn't include */}
            <Route path="/materials"  element={
              <FeatureGate feature="materials"><MaterialsPage /></FeatureGate>
            } />
            <Route path="/documents"  element={
              <FeatureGate feature="documents"><DocumentsPage /></FeatureGate>
            } />
            <Route path="/resources"  element={
              <FeatureGate feature="welders"><ResourcesPage /></FeatureGate>
            } />
            <Route path="/audit"      element={
              <FeatureGate feature="audit_trail"><AuditPage /></FeatureGate>
            } />

            <Route path="/projects"    element={<ProjectsPage />} />
            <Route path="/punch"       element={<PunchList />} />
            <Route path="/users"       element={<UsersPage />} />
            <Route path="/billing"     element={<Billing />} />
            <Route path="/profile"     element={<Profile />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid var(--border)',
              boxShadow: 'var(--sh-md)',
            },
            success: { iconTheme: { primary: '#30D158', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#FF3B30', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/signup"   element={<Onboarding />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

// ── ACCEPT INVITE (simple page) ───────────────────────────────────────────────
function AcceptInvitePage() {
  const { setSession } = useAuth();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm]   = React.useState('');
  const [status, setStatus]     = React.useState('');
  const [loading, setLoading]   = React.useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async () => {
    if (password !== confirm) return setStatus('Passwords do not match.');
    setLoading(true);
    try {
      // Use relative URL — CRA proxy forwards to Express; no hardcoded port needed
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.success) return setStatus(data.message);
      // accept-invite returns token + user but not tenant; setSession handles
      // a null tenant gracefully and AppShell will pick it up on next render
      // since ProtectedRoute re-checks via AuthContext's mount effect anyway.
      setSession(data.token, data.user, null);
      window.location.href = '/';
    } catch {
      setStatus('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 36, width: '100%', maxWidth: 400 },
    title: { color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 8px' },
    sub: { color: '#64748b', fontSize: 14, margin: '0 0 24px' },
    label: { color: '#cbd5e1', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4, marginTop: 12 },
    input: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14, padding: '10px 12px', width: '100%', boxSizing: 'border-box', outline: 'none' },
    btn: { background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 20 },
    err: { color: '#f87171', fontSize: 13, marginTop: 10 },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Accept your invitation</h2>
        <p style={s.sub}>Set a password to activate your IQMS account.</p>
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <label style={s.label}>Confirm password</label>
        <input style={s.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        {status && <p style={s.err}>{status}</p>}
        <button style={s.btn} onClick={handleSubmit} disabled={loading || !password || !confirm}>
          {loading ? 'Activating…' : 'Activate account'}
        </button>
      </div>
    </div>
  );
}

export default App;
