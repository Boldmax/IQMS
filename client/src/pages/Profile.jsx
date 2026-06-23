import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * Minimal profile page — name editing for now. Email/role changes are
 * intentionally not exposed here: email is tied to login identity and role
 * changes should go through an admin (Users & Roles page) to avoid a user
 * silently escalating their own permissions.
 */
export default function Profile() {
  const { user, tenant } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name cannot be empty.');
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      // Keep localStorage in sync so the sidebar/topbar reflect the change
      // immediately without requiring a full re-login.
      const stored = JSON.parse(localStorage.getItem('iqms_user') || '{}');
      localStorage.setItem('iqms_user', JSON.stringify({ ...stored, name: name.trim() }));
      toast.success('Profile updated. Refresh to see changes everywhere.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--fD)', fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--iron)' }}>
          My Profile
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          {tenant?.name} · {user?.role?.replace(/_/g, ' ')}
        </p>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
          Full name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px',
            border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
            fontFamily: 'inherit', marginBottom: 14,
          }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 6 }}>
          Email
        </label>
        <input
          value={user?.email || ''}
          disabled
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px',
            border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
            fontFamily: 'inherit', marginBottom: 4, background: 'var(--surface)', color: 'var(--text-muted)',
          }}
        />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Contact your account owner to change your email address.
        </p>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', display: 'block', marginBottom: 8 }}>
            Theme
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => toggleTheme()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: theme === 'light' ? 'var(--surface)' : 'var(--ore)',
                color: 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 16 }}>
                {theme === 'light' ? '☀️' : '🌙'}
              </span>
              <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: 'var(--signal)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
