import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PLAN_NAMES = { trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
const FEATURE_PLAN = {
  materials:    'starter',
  documents:    'starter',
  audit_trail:  'starter',
  welders:      'pro',
  equipment:    'pro',
  spc_charts:   'pro',
  api_access:   'enterprise',
  white_label:  'enterprise',
  sso:          'enterprise',
};

/**
 * Wrap any component in <FeatureGate feature="welders"> to show an upgrade
 * prompt instead of the content when the tenant's plan doesn't include it.
 *
 * Usage:
 *   <FeatureGate feature="welders">
 *     <WeldersPage />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children }) {
  const { hasFeature } = useAuth();
  if (hasFeature(feature)) return children;
  return <UpgradePrompt feature={feature} />;
}

/**
 * useFeatureGate hook — returns false + shows nothing if feature is locked.
 * Useful for hiding individual UI elements (buttons, tabs) rather than pages.
 */
export function useFeatureGate(feature) {
  const { hasFeature } = useAuth();
  return hasFeature(feature);
}

function UpgradePrompt({ feature }) {
  const navigate = useNavigate();
  const requiredPlan = FEATURE_PLAN[feature] || 'pro';
  const planName = PLAN_NAMES[requiredPlan] || 'Pro';
  const featureLabel = feature.replace(/_/g, ' ');

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🔒</div>
        <h2 style={styles.title}>{featureLabel.charAt(0).toUpperCase() + featureLabel.slice(1)}</h2>
        <p style={styles.desc}>
          This feature is available on the <strong style={{ color: '#0ea5e9' }}>{planName} plan</strong> and above.
          Upgrade to unlock it along with the rest of your team's workflow.
        </p>
        <button style={styles.btn} onClick={() => navigate('/billing')}>
          View plans & upgrade
        </button>
        <p style={styles.sub}>No commitment required · Cancel anytime</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    padding: 24,
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: '40px 48px',
    textAlign: 'center',
    maxWidth: 400,
  },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 12px' },
  desc: { color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' },
  btn: {
    background: '#0ea5e9',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px 28px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  sub: { color: '#475569', fontSize: 12, marginTop: 10 },
};
