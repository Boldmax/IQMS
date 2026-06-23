import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$149',
    period: '/mo',
    description: 'For small QC teams getting started',
    limits: '10 users · 5 projects',
    features: [
      'Inspections & NCR management',
      'ITP workflow with hold points',
      'Punch list tracking',
      'Materials & document control',
      'Audit trail',
    ],
    locked: ['Welder qualification tracking', 'Equipment calibration', 'SPC charts', 'API access'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$399',
    period: '/mo',
    description: 'For full QA/QC departments',
    limits: '25 users · Unlimited projects',
    features: [
      'Everything in Starter',
      'Welder qualification tracking',
      'Equipment calibration management',
      'SPC control charts',
      'Repeat NCR detection',
    ],
    locked: ['API access', 'White-label branding', 'SSO / SAML'],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For multi-site operations & EPCs',
    limits: 'Unlimited users & projects',
    features: [
      'Everything in Pro',
      'REST API access',
      'White-label & custom branding',
      'SSO / SAML / Azure AD',
      'Dedicated support & SLA',
    ],
    locked: [],
    highlight: false,
  },
];

export default function Billing() {
  const { tenant, updateTenant } = useAuth();
  const [upgrading, setUpgrading] = useState(null);
  const [msg, setMsg] = useState('');

  const trial = tenant?.plan === 'trial';
  const currentPlan = tenant?.plan || 'trial';

  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000))
    : null;

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    setMsg('');
    try {
      // api instance auto-attaches Authorization header via interceptor
      const res = await api.post('/tenant/upgrade', { plan: planId });
      updateTenant({
        plan: planId,
        features: res.data.data.features,
        max_users: res.data.data.max_users,
        max_projects: res.data.data.max_projects,
        trial_ends_at: null,
      });
      setMsg(`Successfully upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}!`);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Upgrade failed. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Plans & Billing</h1>
        <p style={styles.sub}>
          {trial
            ? `You're on a free trial · ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`
            : `Current plan: ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}`}
        </p>
      </div>

      {msg && (
        <div style={{ ...styles.msg, background: msg.includes('Success') ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)', borderColor: msg.includes('Success') ? '#22c55e' : '#f87171', color: msg.includes('Success') ? '#22c55e' : '#f87171' }}>
          {msg}
        </div>
      )}

      {/* Current usage */}
      <div style={styles.usageCard}>
        <h3 style={styles.usageTitle}>Current usage</h3>
        <div style={styles.usageGrid}>
          <UsageStat label="Users" used={tenant?.current_users || 1} max={tenant?.max_users || 5} />
          <UsageStat label="Projects" used={tenant?.current_projects || 0} max={tenant?.max_projects || 3} />
        </div>
      </div>

      {/* Plan cards */}
      <div style={styles.plansGrid}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isEnterprise = plan.id === 'enterprise';

          return (
            <div key={plan.id} style={{ ...styles.planCard, ...(plan.highlight ? styles.planHighlight : {}) }}>
              {plan.highlight && <div style={styles.popularBadge}>Most popular</div>}

              <div style={styles.planName}>{plan.name}</div>
              <div style={styles.planPrice}>
                <span style={styles.priceAmount}>{plan.price}</span>
                <span style={styles.pricePeriod}>{plan.period}</span>
              </div>
              <div style={styles.planLimits}>{plan.limits}</div>
              <p style={styles.planDesc}>{plan.description}</p>

              <div style={styles.divider} />

              <ul style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <li key={i} style={styles.featureItem}>
                    <span style={{ color: '#22c55e' }}>✓</span> {f}
                  </li>
                ))}
                {plan.locked.map((f, i) => (
                  <li key={i} style={{ ...styles.featureItem, opacity: 0.35 }}>
                    <span>✕</span> {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div style={styles.currentBadge}>Current plan</div>
              ) : isEnterprise ? (
                <a href="mailto:sales@iqms.io" style={styles.btnOutline}>Contact sales</a>
              ) : (
                <button
                  style={{ ...styles.btn, ...(plan.highlight ? styles.btnPrimary : {}) }}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!upgrading}
                >
                  {upgrading === plan.id ? 'Processing…' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p style={styles.note}>
        Prices shown in USD. Annual billing available at 20% discount. 
        Payment processing powered by Stripe. Cancel anytime.
      </p>
    </div>
  );
}

function UsageStat({ label, used, max }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const warn = pct >= 80;
  return (
    <div style={styles.usageStat}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
        <span style={{ color: warn ? '#f59e0b' : '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
          {used} / {max === 9999 ? '∞' : max}
        </span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: warn ? '#f59e0b' : '#0ea5e9',
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '32px 24px',
    maxWidth: 1000,
    margin: '0 auto',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: { marginBottom: 24 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: 0 },
  sub: { color: '#64748b', fontSize: 14, marginTop: 4 },
  msg: {
    border: '1px solid',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    marginBottom: 20,
  },
  usageCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 28,
  },
  usageTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: 600, margin: '0 0 16px' },
  usageGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  usageStat: {},
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  },
  planCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '24px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  planHighlight: {
    border: '1px solid #0ea5e9',
    boxShadow: '0 0 0 1px #0ea5e9, 0 4px 24px rgba(14,165,233,0.12)',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0ea5e9',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 12px',
    borderRadius: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  planName: { color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  planPrice: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 },
  priceAmount: { color: '#f1f5f9', fontSize: 32, fontWeight: 800 },
  pricePeriod: { color: '#64748b', fontSize: 14 },
  planLimits: { color: '#0ea5e9', fontSize: 12, fontWeight: 600, marginTop: 4 },
  planDesc: { color: '#64748b', fontSize: 13, marginTop: 6, marginBottom: 0 },
  divider: { height: 1, background: '#334155', margin: '20px 0' },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 },
  featureItem: { color: '#cbd5e1', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    background: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 20,
    width: '100%',
  },
  btnPrimary: { background: '#0ea5e9', color: '#fff' },
  btnOutline: {
    display: 'block',
    textAlign: 'center',
    marginTop: 20,
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#94a3b8',
    textDecoration: 'none',
  },
  currentBadge: {
    marginTop: 20,
    textAlign: 'center',
    color: '#22c55e',
    fontSize: 13,
    fontWeight: 600,
    padding: '10px',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8,
    background: 'rgba(34,197,94,0.05)',
  },
  note: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
  },
};
