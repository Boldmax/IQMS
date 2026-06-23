import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEMO_USERS = [
  { email: 'o.fasanya@iqms.ng',  label: 'Olabode',  role: 'QC Inspector'      },
  { email: 'c.eze@iqms.ng',      label: 'Chukwuma', role: 'Welding Inspector'  },
  { email: 'a.okonkwo@iqms.ng',  label: 'Amara',    role: 'Quality Manager'   },
  { email: 'b.adeyemi@iqms.ng',  label: 'Balogun',  role: 'NDT Technician'    },
  { email: 'admin@iqms.ng',      label: 'Admin',    role: 'System Admin'      },
];

const DOTS = Array.from({ length: 18 }, (_, i) => [1, 4, 7, 10, 13, 16].includes(i));

const LoginPage = () => {
  const [email, setEmail]       = useState('o.fasanya@iqms.ng');
  const [password, setPassword] = useState('Demo1234!');
  const [loading, setLoading]   = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) { toast.error('Email and password required.'); return; }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (userEmail) => {
    setEmail(userEmail);
    setPassword('Demo1234!');
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* LEFT PANEL */}
      <div style={{ width: 420, flexShrink: 0, background: 'var(--iron)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 48px' }}>
        <div style={{ fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 600, color: 'var(--steel2)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 20 }}>
          Industrial Quality Management System
        </div>
        <div style={{ fontFamily: 'var(--fD)', fontSize: 34, fontWeight: 700, color: 'var(--white)', lineHeight: 1.2, marginBottom: 16 }}>
          Quality control that<br />
          <span style={{ color: 'var(--signal)' }}>governs production.</span><br />
          <span style={{ fontSize: 22, fontWeight: 400, color: 'var(--steel)' }}>Not just records it.</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--steel)', lineHeight: 1.7, maxWidth: 310, marginBottom: 28 }}>
          Real-time SPC monitoring, enforced hold points, material traceability,
          and immutable audit trails — built for API, ASME, NORSOK, and ISO environments.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: 28 }}>
          {DOTS.map((lit, i) => (
            <div key={i} style={{ width: '100%', aspectRatio: 1, borderRadius: '50%', background: lit ? 'var(--signal)' : 'var(--slag)' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {['API 1104', 'ASME IX', 'NORSOK M-501', 'ISO 9001', 'AWS D1.1', 'NACE SP0188'].map(s => (
            <span key={s} style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 2, background: 'var(--slag)', color: 'var(--signal)', fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 600, letterSpacing: .5 }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-xl)', padding: 40, width: '100%', maxWidth: 400, boxShadow: 'var(--sh-md)' }}>
          <div style={{ fontFamily: 'var(--fD)', fontSize: 24, fontWeight: 700, color: 'var(--iron)', marginBottom: 4 }}>
            Sign In
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 24 }}>
            Access your quality management workspace
          </div>

          <form onSubmit={handleLogin}>
            <div className="fg mb3">
              <label className="fg-label">Email Address</label>
              <input className="fc" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" autoComplete="email" />
            </div>

            <div className="fg mb4">
              <label className="fg-label">Password</label>
              <input className="fc" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 10, fontSize: 14 }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Access IQMS →'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: 12, background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 11.5, color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-sub)', marginBottom: 8 }}>Demo — click to sign in as:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEMO_USERS.map(u => (
                <button
                  key={u.email}
                  className="btn btn-ghost btn-xs"
                  onClick={() => quickLogin(u.email)}
                  title={u.role}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-muted)' }}>
              Password for all demo users: <span style={{ fontFamily: 'var(--fM)' }}>Demo1234!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
