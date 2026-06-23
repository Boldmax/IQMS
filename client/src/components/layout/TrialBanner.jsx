import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * TrialBanner — shown at the top of every page during the trial period.
 * Disappears automatically on paid plans. Dismissable per session.
 */
export default function TrialBanner() {
  const { trialInfo } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const info = trialInfo();
  if (!info || dismissed) return null;

  const { daysLeft, expired } = info;

  const urgent = daysLeft <= 3;

  return (
    <div style={{
      ...styles.banner,
      background: expired
        ? 'linear-gradient(90deg, #7f1d1d, #991b1b)'
        : urgent
        ? 'linear-gradient(90deg, #78350f, #92400e)'
        : 'linear-gradient(90deg, #0c4a6e, #075985)',
    }}>
      <span style={styles.text}>
        {expired
          ? '⚠ Your trial has ended. Upgrade to keep your data and continue.'
          : urgent
          ? `⏰ Your trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade now to avoid interruption.`
          : `🎉 You're on a free trial · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
      </span>
      <div style={styles.actions}>
        <button style={styles.upgradeBtn} onClick={() => navigate('/billing')}>
          {expired ? 'Upgrade now' : 'See plans'}
        </button>
        {!expired && (
          <button style={styles.dismissBtn} onClick={() => setDismissed(true)}>✕</button>
        )}
      </div>
    </div>
  );
}

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 20px',
    gap: 12,
    flexShrink: 0,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  upgradeBtn: {
    background: '#fff',
    color: '#0f172a',
    border: 'none',
    borderRadius: 6,
    padding: '5px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(226,232,240,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
  },
};
