import React from 'react';

// ── BADGE ─────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  'Accepted':'b-green','Active':'b-green','Approved':'b-green','Complete':'b-green',
  'Closed':'b-green','Released':'b-green','Calibrated':'b-green',
  'Rejected':'b-red','Open':'b-red','Critical':'b-red','Suspended':'b-red',
  'Overdue':'b-red','Blocked':'b-red',
  'Conditional':'b-amber','On Hold':'b-amber','Under Review':'b-amber',
  'In Progress':'b-amber','Major':'b-amber','Due Soon':'b-amber','Hold':'b-amber',
  'Pending':'b-grey','Minor':'b-blue','Live':'b-signal','Draft':'b-grey',
  'Superseded':'b-grey','Waived':'b-grey',
};

export const Badge = ({ label, size }) => (
  <span className={`badge ${STATUS_MAP[label] || 'b-grey'}`}
    style={size === 'sm' ? { fontSize: 9 } : {}}>
    {label}
  </span>
);

// ── TAG ───────────────────────────────────────────────────────────────────────
export const Tag = ({ children }) => <span className="tag">{children}</span>;

// ── MONO ──────────────────────────────────────────────────────────────────────
export const Mono = ({ children, size = 'normal' }) => (
  <span className={size === 'sm' ? 'mono-sm' : 'mono'}>{children}</span>
);

// ── BUTTON ────────────────────────────────────────────────────────────────────
export const Button = ({ children, variant = 'ghost', size, onClick, disabled, type = 'button', className = '' }) => (
  <button
    type={type}
    className={`btn btn-${variant}${size ? ` btn-${size}` : ''} ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

// ── CARD ──────────────────────────────────────────────────────────────────────
export const Card = ({ children, className = '' }) => (
  <div className={`card ${className}`}>{children}</div>
);

export const CardHeader = ({ title, subtitle, actions }) => (
  <div className="card-hd">
    <div>
      <div className="card-title">{title}</div>
      {subtitle && <div className="card-sub">{subtitle}</div>}
    </div>
    {actions && <div className="flex gap2 items-c">{actions}</div>}
  </div>
);

export const CardBody = ({ children, style }) => (
  <div className="card-bd" style={style}>{children}</div>
);

// ── MODAL ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, subtitle, children, footer, size = 700 }) => {
  if (!open) return null;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: size }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-bd">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
};

// ── FORM FIELDS ───────────────────────────────────────────────────────────────
export const FormGroup = ({ label, children, className = '' }) => (
  <div className={`fg ${className}`}>
    {label && <label className="fg-label">{label}</label>}
    {children}
  </div>
);

export const Input = ({ label, ...props }) => (
  <div className="fg">
    {label && <label className="fg-label">{label}</label>}
    <input className="fc" {...props} />
  </div>
);

export const Select = ({ label, children, ...props }) => (
  <div className="fg">
    {label && <label className="fg-label">{label}</label>}
    <select className="fc" {...props}>{children}</select>
  </div>
);

export const Textarea = ({ label, ...props }) => (
  <div className="fg">
    {label && <label className="fg-label">{label}</label>}
    <textarea className="fc" {...props} />
  </div>
);

// ── ALERT ─────────────────────────────────────────────────────────────────────
export const Alert = ({ type = 'info', children, className = '' }) => (
  <div className={`alert alert-${type} ${className}`}>{children}</div>
);

// ── PROGRESS BAR ──────────────────────────────────────────────────────────────
export const ProgressBar = ({ value, color }) => (
  <div className="prog-bar">
    <div className="prog-fill" style={{ width: `${Math.min(value, 100)}%`, background: color || 'var(--signal)' }} />
  </div>
);

// ── SECTION HEADER ─────────────────────────────────────────────────────────────
export const SectionHeader = ({ title, subtitle, actions }) => (
  <div className="sec-hd">
    <div>
      <div className="sec-title">{title}</div>
      {subtitle && <div className="sec-sub">{subtitle}</div>}
    </div>
    {actions && <div className="flex gap2 items-c">{actions}</div>}
  </div>
);

// ── SPINNER ───────────────────────────────────────────────────────────────────
export const Spinner = () => <div className="spinner" />;

export const LoadingScreen = ({ message = 'Loading…' }) => (
  <div className="loading-screen">
    <div className="spinner" />
    <div style={{ fontFamily: 'var(--fM)', fontSize: 12, color: 'var(--text-muted)' }}>{message}</div>
  </div>
);

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = '📋', title, subtitle, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-sub)', fontFamily: 'var(--fD)' }}>{title}</div>
    {subtitle && <div style={{ fontSize: 13, marginTop: 6 }}>{subtitle}</div>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

// ── SCORE RING ─────────────────────────────────────────────────────────────────
export const ScoreRing = ({ score, grade }) => {
  const r = 26, circ = 2 * Math.PI * r, pct = score / 100;
  const c = score >= 85 ? 'var(--green)' : score >= 70 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={c} strokeWidth="5"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`} strokeLinecap="round" />
      </svg>
      <div className="score-text">
        <div className="score-num" style={{ color: c }}>{score}</div>
        <div className="score-grade" style={{ color: c }}>{grade}</div>
      </div>
    </div>
  );
};

// ── MINI SPC CHART ────────────────────────────────────────────────────────────
export const MiniSPC = ({ data = [], ucl, lcl, color }) => {
  if (!data.length) return null;
  const w = 280, h = 90, p = 10;
  const mx = Math.max(...data, ucl) * 1.12, mn = 0;
  const sx = (i) => p + (i / (data.length - 1)) * (w - p * 2);
  const sy = (v) => h - p - ((v - mn) / (mx - mn)) * (h - p * 2);
  const pts = data.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const oc = last > ucl || (lcl > 0 && last < lcl);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 90 }}>
      <line x1={p} x2={w - p} y1={sy(ucl)} y2={sy(ucl)} stroke="#FF3B30" strokeWidth="1" strokeDasharray="4,3" opacity=".8" />
      {lcl > 0 && <line x1={p} x2={w - p} y1={sy(lcl)} y2={sy(lcl)} stroke="#409CFF" strokeWidth="1" strokeDasharray="4,3" opacity=".8" />}
      <polyline points={pts} fill="none" stroke={oc ? 'var(--red)' : color || 'var(--signal)'} strokeWidth="2" />
      {data.map((v, i) => (
        <circle key={i} cx={sx(i)} cy={sy(v)} r={i === data.length - 1 ? 4 : 2.5}
          fill={(v > ucl || (lcl > 0 && v < lcl)) ? 'var(--red)' : color || 'var(--signal)'}
          opacity={i === data.length - 1 ? 1 : 0.6} />
      ))}
      <text x={w - p} y={sy(ucl) - 4} fontSize="8" fill="#FF3B30" textAnchor="end" fontFamily="JetBrains Mono,monospace">UCL {ucl}</text>
    </svg>
  );
};

// ── FILTER BAR ────────────────────────────────────────────────────────────────
export const FilterBar = ({ options, active, onChange }) => (
  <div className="flex gap2">
    {options.map(opt => (
      <Button key={opt} size="sm" variant={active === opt ? 'primary' : 'ghost'} onClick={() => onChange(opt)}>
        {opt}
      </Button>
    ))}
  </div>
);
