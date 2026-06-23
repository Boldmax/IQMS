import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProjects, getNCRs, getInspections } from '../../utils/api';

const PAGE_TITLES = {
  '/':            'Command Center',
  '/itp':         'ITP & Workflow Engine',
  '/inspections': 'Inspection Reports',
  '/ncr':         'Non-Conformance Reports',
  '/materials':   'Material Traceability',
  '/audit':       'Audit Trail',
  '/resources':   'Resources & Equipment',
  '/documents':   'Document Control',
  '/projects':    'Project Register',
  '/punch':       'Punch List',
  '/users':       'User Management',
  '/billing':     'Plans & Billing',
  '/profile':     'My Profile',
};

// ── GLOBAL SEARCH ────────────────────────────────────────────────────────────
// Searches projects, NCRs, and inspections in parallel and shows a unified
// results dropdown. Debounced to avoid firing a request on every keystroke.
const SearchBox = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const runSearch = useCallback((q) => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    Promise.all([
      getProjects({ search: q }),
      getNCRs({ search: q }),
      getInspections({ search: q, limit: 5 }),
    ])
      .then(([proj, ncr, insp]) => {
        setResults({
          projects: (proj.data.data || []).slice(0, 4),
          ncrs: (ncr.data.data || []).slice(0, 4),
          inspections: (insp.data.data || []).slice(0, 4),
        });
      })
      .catch(() => setResults(null))
      .finally(() => setSearching(false));
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const goTo = (path) => {
    navigate(path);
    setOpen(false);
    setQuery('');
    setResults(null);
  };

  const hasResults = results && (results.projects.length || results.ncrs.length || results.inspections.length);
  const showEmpty = results && !hasResults && query.trim().length >= 2;

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 240 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '6px 12px', fontSize: 12.5,
      }}>
        <span style={{ color: 'var(--text-muted)' }}>🔍</span>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Search records, NCRs…"
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--iron)', width: '100%', fontFamily: 'inherit',
          }}
        />
        {query && (
          <span
            style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
            onClick={() => { setQuery(''); setResults(null); }}
          >
            ✕
          </span>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: '110%', right: 0, width: 340,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 50, maxHeight: 420, overflowY: 'auto',
        }}>
          {searching && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Searching…
            </div>
          )}

          {!searching && showEmpty && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No matches for "{query}"
            </div>
          )}

          {!searching && results?.projects?.length > 0 && (
            <SearchSection title="Projects">
              {results.projects.map(p => (
                <SearchRow
                  key={p.id}
                  label={p.name}
                  sub={`${p.project_number} · ${p.client}`}
                  onClick={() => goTo('/projects')}
                />
              ))}
            </SearchSection>
          )}

          {!searching && results?.ncrs?.length > 0 && (
            <SearchSection title="NCRs">
              {results.ncrs.map(n => (
                <SearchRow
                  key={n.id}
                  label={n.title}
                  sub={`${n.ncr_number} · ${n.severity} · ${n.status}`}
                  onClick={() => goTo('/ncr')}
                />
              ))}
            </SearchSection>
          )}

          {!searching && results?.inspections?.length > 0 && (
            <SearchSection title="Inspections">
              {results.inspections.map(i => (
                <SearchRow
                  key={i.id}
                  label={i.component || i.inspection_type}
                  sub={`${i.inspection_type} · ${i.result}`}
                  onClick={() => goTo('/inspections')}
                />
              ))}
            </SearchSection>
          )}
        </div>
      )}
    </div>
  );
};

const SearchSection = ({ title, children }) => (
  <div>
    <div style={{
      padding: '8px 14px 4px', fontSize: 10, fontWeight: 700,
      letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)',
    }}>
      {title}
    </div>
    {children}
  </div>
);

const SearchRow = ({ label, sub, onClick }) => (
  <div
    onClick={onClick}
    style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
  >
    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--iron)' }}>{label}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
  </div>
);

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
// Derives a live notification feed from dashboard stats — open NCRs, overdue
// items, expiring welder certs/equipment calibration — rather than a separate
// notifications table. Clicking a notification routes to the relevant page.
const NotificationsBell = ({ stats }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const notifications = [];
  if (stats?.ncrs?.open > 0) {
    notifications.push({
      icon: '⚠', color: 'var(--red)',
      text: `${stats.ncrs.open} open NCR${stats.ncrs.open !== 1 ? 's' : ''}`,
      sub: stats.ncrs.critical > 0 ? `${stats.ncrs.critical} critical severity` : 'Needs review',
      path: '/ncr',
    });
  }
  if (stats?.ncrs?.overdue > 0) {
    notifications.push({
      icon: '⏰', color: 'var(--red)',
      text: `${stats.ncrs.overdue} overdue NCR${stats.ncrs.overdue !== 1 ? 's' : ''}`,
      sub: 'Past due date — escalation recommended',
      path: '/ncr',
    });
  }
  if (stats?.equipment?.overdue > 0) {
    notifications.push({
      icon: '🔧', color: 'var(--amber)',
      text: `${stats.equipment.overdue} equipment item${stats.equipment.overdue !== 1 ? 's' : ''} overdue calibration`,
      sub: 'Recalibrate before further use',
      path: '/resources',
    });
  }
  if (stats?.punch?.catA_open > 0) {
    notifications.push({
      icon: '☑', color: 'var(--amber)',
      text: `${stats.punch.catA_open} open Category A punch item${stats.punch.catA_open !== 1 ? 's' : ''}`,
      sub: 'Blocking mechanical completion',
      path: '/punch',
    });
  }

  const count = notifications.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="icon-btn" title="Notifications" onClick={() => setOpen(o => !o)}>
        🔔
        {count > 0 && <div className="notif-dot" />}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '130%', right: 0, width: 300,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 50, maxHeight: 380, overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 14px', fontSize: 12, fontWeight: 700,
            color: 'var(--iron)', borderBottom: '1px solid var(--border)',
          }}>
            Notifications {count > 0 && `(${count})`}
          </div>

          {count === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              You're all caught up.
            </div>
          )}

          {notifications.map((n, i) => (
            <div
              key={i}
              onClick={() => { navigate(n.path); setOpen(false); }}
              style={{
                display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: n.color, fontSize: 14, flexShrink: 0 }}>{n.icon}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--iron)' }}>{n.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── SETTINGS MENU ────────────────────────────────────────────────────────────
const SettingsMenu = () => {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const isOwnerOrAdmin = user?.is_tenant_owner || user?.role === 'system_admin' || user?.role === 'quality_manager';

  const items = [
    { label: 'Plans & Billing', path: '/billing', show: isOwnerOrAdmin },
    { label: 'Users & Roles', path: '/users', show: isOwnerOrAdmin },
    { label: 'My Profile', path: '/profile', show: true },
  ].filter(i => i.show);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="icon-btn" title="Settings" onClick={() => setOpen(o => !o)}>⚙</div>

      {open && (
        <div style={{
          position: 'absolute', top: '130%', right: 0, width: 220,
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 50, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--iron)' }}>{tenant?.name || 'Workspace'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tenant?.plan ? `${tenant.plan.charAt(0).toUpperCase()}${tenant.plan.slice(1)} plan` : ''}</div>
          </div>

          {items.map(item => (
            <div
              key={item.path}
              onClick={() => { navigate(item.path); setOpen(false); }}
              style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--iron)', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {item.label}
            </div>
          ))}

          <div
            onClick={() => { logout(); navigate('/login'); setOpen(false); }}
            style={{
              padding: '10px 14px', fontSize: 12.5, color: 'var(--red)',
              cursor: 'pointer', borderTop: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Sign out
          </div>
        </div>
      )}
    </div>
  );
};

// ── TOPBAR ────────────────────────────────────────────────────────────────────
const Topbar = ({ stats, pathname }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const title = PAGE_TITLES[pathname] || 'IQMS';
  const openNCRs = stats?.ncrs?.open || 0;

  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-crumb">IQMS v3.0 / {title}</div>
      </div>

      <div className="flex gap2 items-c" style={{ marginLeft: 16 }}>
        {openNCRs > 0 && (
          <div
            className="alert alert-danger"
            style={{ padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}
            onClick={() => navigate('/ncr')}
          >
            ⚠ {openNCRs} open NCR{openNCRs !== 1 ? 's' : ''}
          </div>
        )}
        {stats?.ncrs?.overdue > 0 && (
          <div className="alert alert-danger" style={{ padding: '3px 10px', fontSize: 11.5 }}>
            ⏰ {stats.ncrs.overdue} overdue
          </div>
        )}
      </div>

      <div className="topbar-right">
        <SearchBox />
        <NotificationsBell stats={stats} />
        <SettingsMenu />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeft: '1px solid var(--border)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--signal-dim)', border: '1.5px solid var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 700, color: 'var(--signal-dk)', flexShrink: 0 }}>
            {user?.initials}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--iron)' }}>{user?.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
