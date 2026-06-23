import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getMe } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('iqms_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Validate the stored token by fetching the current user.
    // On failure (expired token, server restart, etc.) we clear storage
    // and let the ProtectedRoute in App.jsx redirect to /login cleanly.
    getMe()
      .then(res => {
        setUser(res.data.user);
        setTenant(res.data.tenant);
      })
      .catch((err) => {
        // 401 = token invalid/expired; 402 = trial expired; 403 = suspended
        // In all cases just clear creds — the router handles the redirect
        const status = err?.response?.status;
        if (status === 401 || status === 402 || status === 403) {
          localStorage.removeItem('iqms_token');
          localStorage.removeItem('iqms_user');
          localStorage.removeItem('iqms_tenant');
        }
        // For network errors (server offline) keep the user logged in
        // so they see a better error state rather than being bounced to login
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await apiLogin({ email, password });
    const { token, user, tenant } = res.data;
    localStorage.setItem('iqms_token',  token);
    localStorage.setItem('iqms_user',   JSON.stringify(user));
    localStorage.setItem('iqms_tenant', JSON.stringify(tenant));
    setUser(user);
    setTenant(tenant);
    return { user, tenant };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('iqms_token');
    localStorage.removeItem('iqms_user');
    localStorage.removeItem('iqms_tenant');
    setUser(null);
    setTenant(null);
  }, []);

  /** Check if the current tenant plan has a specific feature enabled */
  const hasFeature = useCallback((feature) => {
    return tenant?.features?.[feature] === true;
  }, [tenant]);

  /** Check if we're in trial and how many days remain */
  const trialInfo = useCallback(() => {
    if (!tenant || tenant.plan !== 'trial') return null;
    const endsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    if (!endsAt) return null;
    const daysLeft = Math.max(0, Math.ceil((endsAt - new Date()) / 86400000));
    return { daysLeft, endsAt, expired: daysLeft === 0 };
  }, [tenant]);

  const hasPermission = useCallback((resource, action) => {
    if (!user) return false;
    const PERMISSIONS = {
      system_admin:          ['*'],
      quality_manager:       ['project:*','inspection:*','ncr:*','document:*','material:*','itp:*','welder:*','equipment:*','audit:read','user:read'],
      qa_engineer:           ['project:read','inspection:*','ncr:*','document:*','material:read','itp:*','welder:read','equipment:read','audit:read'],
      qc_inspector:          ['project:read','inspection:create','inspection:read','ncr:create','ncr:read','document:read','material:read','itp:read','equipment:read'],
      welding_inspector:     ['project:read','inspection:create','inspection:read','ncr:create','ncr:read','document:read','welder:*','equipment:*'],
      ndt_technician:        ['project:read','inspection:create','inspection:read','ncr:create','ncr:read','document:read','equipment:*'],
      document_controller:   ['project:read','inspection:read','document:*','ncr:read'],
      client_representative: ['project:read','inspection:read','ncr:read','document:read','itp:read','audit:read'],
    };
    const perms = PERMISSIONS[user.role] || [];
    return perms.includes('*') || perms.includes(`${resource}:*`) || perms.includes(`${resource}:${action}`);
  }, [user]);

  const updateTenant = useCallback((updates) => {
    setTenant(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * setSession — used by flows that authenticate outside the normal
   * login() call (e.g. onboarding signup, invite acceptance). Writes to
   * localStorage AND updates React state in one call so the UI reflects
   * the new session immediately without requiring a page refresh.
   */
  const setSession = useCallback((token, user, tenant) => {
    localStorage.setItem('iqms_token', token);
    localStorage.setItem('iqms_user', JSON.stringify(user));
    localStorage.setItem('iqms_tenant', JSON.stringify(tenant));
    setUser(user);
    setTenant(tenant);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, tenant, loading,
      login, logout,
      hasPermission, hasFeature, trialInfo,
      updateTenant, setSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
