import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  {
    section: 'Operations',
    items: [
      { to: '/',            icon: '◉', label: 'Command Center' },
      { to: '/itp',         icon: '⊟', label: 'ITP & Workflow',     badgeKey: 'holdPoints', badgeColor: 'red' },
      { to: '/inspections', icon: '◎', label: 'Inspections' },
      { to: '/quality-audit', icon: '📋', label: 'Quality Audit' },
      { to: '/quality-planning', icon: '📐', label: 'Quality Planning' },
      { to: '/ncr',         icon: '⚠', label: 'NCRs',               badgeKey: 'openNCRs',   badgeColor: 'amber' },
    ],
  },
  {
    section: 'Traceability',
    items: [
      { to: '/materials', icon: '⬡', label: 'Material Traceability' },
      { to: '/audit',     icon: '🔐', label: 'Audit Trail' },
    ],
  },
  {
    section: 'Resources',
    items: [
      { to: '/resources',  icon: '◈', label: 'Resources & Equip.' },
      { to: '/documents',  icon: '▤', label: 'Document Control' },
      { to: '/projects',   icon: '◧', label: 'Projects' },
    ],
  },
  {
    section: 'Commissioning',
    items: [
      { to: '/punch', icon: '☑', label: 'Punch List', badgeKey: 'catA', badgeColor: 'red' },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/users', icon: '👤', label: 'Users & Roles', roles: ['system_admin', 'quality_manager'] },
      { to: '/billing', icon: '💳', label: 'Plans & Billing', roles: ['system_admin', 'quality_manager'] },
    ],
  },
];

const Sidebar = ({ stats }) => {
  const { user, logout, tenant, trialInfo } = useAuth();
  const navigate = useNavigate();

  const getBadge = (key) => {
    if (key === 'openNCRs')   return stats?.ncrs?.open || 0;
    if (key === 'holdPoints') return 3;
    if (key === 'catA')       return stats?.punch?.catA_open || 0;
    return 0;
  };

  const info = trialInfo();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">IQMS</div>
        <div className="sb-version">{tenant?.name || 'v2.0 · Production Ready'}</div>
      </div>

      {NAV.map(section => {
        const visibleItems = section.items.filter(item =>
          !item.roles || item.roles.includes(user?.role)
        );
        if (!visibleItems.length) return null;

        return (
          <div key={section.section}>
            <div className="sb-section">{section.section}</div>
            {visibleItems.map(item => {
              const badge = item.badgeKey ? getBadge(item.badgeKey) : 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {badge > 0 && (
                    <span className={`nav-badge${item.badgeColor === 'amber' ? ' amber' : ''}`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        );
      })}

      <div className="field-mode">
        <div className="field-mode-label">Field Mode</div>
        <div className="field-mode-status">
          <div className="field-mode-dot" />
          Online · Sync Active
        </div>
      </div>

      {info && (
        <div className="field-mode" style={{ borderTop: 'none', marginTop: 0 }}>
          <div className="field-mode-label">Trial</div>
          <div className="field-mode-status">
            <div className="field-mode-dot" style={{ background: info.daysLeft <= 3 ? '#f59e0b' : '#0ea5e9' }} />
            {info.expired ? 'Expired' : `${info.daysLeft} day${info.daysLeft !== 1 ? 's' : ''} left`}
          </div>
        </div>
      )}

      <div className="sb-user">
        <div className="sb-avatar">{user?.initials}</div>
        <div>
          <div className="sb-name">{user?.name?.split(' ')[0]}</div>
          <div className="sb-role">{user?.role?.replace(/_/g, ' ')}</div>
        </div>
        <button className="sb-logout" onClick={handleLogout} title="Sign out">↩</button>
      </div>
    </div>
  );
};

export default Sidebar;
