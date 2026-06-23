import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api'; // use the shared instance so CRA proxy is used

const INDUSTRIES = [
  { value: 'oil_gas',      label: 'Oil & Gas' },
  { value: 'fabrication',  label: 'Fabrication & Manufacturing' },
  { value: 'ndt',          label: 'NDT & Inspection Services' },
  { value: 'construction', label: 'Construction & Civil' },
  { value: 'mining',       label: 'Mining & Resources' },
  { value: 'power',        label: 'Power & Energy' },
  { value: 'marine',       label: 'Marine & Offshore' },
  { value: 'other',        label: 'Other' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [step, setStep] = useState(1); // 1 = company, 2 = account, 3 = success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    company_name: '',
    industry: 'oil_gas',
    country: '',
    owner_name: '',
    owner_email: '',
    password: '',
    password_confirm: '',
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (form.password !== form.password_confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      const res = await api.post('/onboard', {
        company_name: form.company_name,
        industry:     form.industry,
        country:      form.country,
        owner_name:   form.owner_name,
        owner_email:  form.owner_email,
        password:     form.password,
      });

      // Auto-login with the returned token
      // Updates both localStorage AND React auth state in one call, so the
      // dashboard renders correctly on first paint instead of needing a refresh.
      setSession(res.data.token, res.data.user, res.data.tenant);

      setStep(3);
      setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>IQMS</div>
          <p style={styles.tagline}>Industrial Quality Management</p>
        </div>

        {/* Progress dots */}
        {step < 3 && (
          <div style={styles.progress}>
            {[1, 2].map(s => (
              <div key={s} style={{ ...styles.dot, background: step >= s ? '#0ea5e9' : '#334155' }} />
            ))}
          </div>
        )}

        {/* Step 1 — Company */}
        {step === 1 && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Tell us about your company</h2>
            <p style={styles.stepSub}>Start your free 14-day trial — no credit card required.</p>

            <label style={styles.label}>Company / Organisation name</label>
            <input
              style={styles.input}
              placeholder="e.g. Chevron Nigeria Ltd"
              value={form.company_name}
              onChange={set('company_name')}
            />

            <label style={styles.label}>Industry</label>
            <select style={styles.input} value={form.industry} onChange={set('industry')}>
              {INDUSTRIES.map(i => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>

            <label style={styles.label}>Country (optional)</label>
            <input
              style={styles.input}
              placeholder="e.g. Nigeria"
              value={form.country}
              onChange={set('country')}
            />

            <button
              style={{ ...styles.btn, opacity: !form.company_name ? 0.5 : 1 }}
              disabled={!form.company_name}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 — Account */}
        {step === 2 && (
          <div style={styles.section}>
            <h2 style={styles.stepTitle}>Create your account</h2>
            <p style={styles.stepSub}>You'll be the admin for <strong style={{ color: '#e2e8f0' }}>{form.company_name}</strong>.</p>

            <label style={styles.label}>Your full name</label>
            <input
              style={styles.input}
              placeholder="e.g. Amara Okonkwo"
              value={form.owner_name}
              onChange={set('owner_name')}
            />

            <label style={styles.label}>Work email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@company.com"
              value={form.owner_email}
              onChange={set('owner_email')}
            />

            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={set('password')}
            />

            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              placeholder=""
              value={form.password_confirm}
              onChange={set('password_confirm')}
            />

            {error && <p style={styles.error}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={styles.btnSecondary} onClick={() => setStep(1)}>← Back</button>
              <button
                style={{ ...styles.btn, flex: 1, opacity: loading ? 0.7 : 1 }}
                disabled={loading || !form.owner_name || !form.owner_email || !form.password}
                onClick={handleSubmit}
              >
                {loading ? 'Creating account…' : 'Start free trial'}
              </button>
            </div>

            <p style={styles.terms}>
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        )}

        {/* Step 3 — Success */}
        {step === 3 && (
          <div style={{ ...styles.section, textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.stepTitle}>You're all set!</h2>
            <p style={styles.stepSub}>
              Welcome to IQMS, <strong style={{ color: '#e2e8f0' }}>{form.owner_name}</strong>.<br />
              Your 14-day trial has started. Taking you to your dashboard…
            </p>
          </div>
        )}

        {/* Footer */}
        <p style={styles.footer}>
          Already have an account? <a href="/login" style={styles.link}>Sign in</a>
        </p>
      </div>

      {/* Feature highlights */}
      <div style={styles.features}>
        {[
          { icon: '🔍', text: 'Inspection management with code validation' },
          { icon: '📋', text: 'NCR lifecycle tracking & repeat detection' },
          { icon: '✅', text: 'Enforced ITP workflow with hold points' },
          { icon: '📊', text: 'Live SPC charts and audit trail' },
          { icon: '👥', text: 'Role-based access for your whole team' },
        ].map((f, i) => (
          <div key={i} style={styles.feature}>
            <span style={{ fontSize: 20 }}>{f.icon}</span>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    padding: 24,
    gap: 32,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
    padding: '28px 32px 24px',
    textAlign: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: 3,
  },
  tagline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    margin: '4px 0 0',
  },
  progress: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    padding: '16px 0 0',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'background 0.3s',
  },
  section: {
    padding: '24px 32px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  stepTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  stepSub: {
    color: '#94a3b8',
    fontSize: 14,
    margin: '4px 0 16px',
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 14,
    padding: '10px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: 16,
    transition: 'opacity 0.2s',
  },
  btnSecondary: {
    background: '#334155',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: 8,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    margin: '8px 0 0',
    background: 'rgba(248,113,113,0.1)',
    borderRadius: 6,
    padding: '8px 12px',
  },
  terms: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 0,
  },
  footer: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    padding: '16px 32px 24px',
    margin: 0,
  },
  link: { color: '#0ea5e9', textDecoration: 'none' },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.15)',
    border: '2px solid #22c55e',
    color: '#22c55e',
    fontSize: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
};
