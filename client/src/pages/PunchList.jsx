import React, { useState, useEffect, useCallback } from 'react';
import {
  getPunchItems, createPunchItem,
  submitPunchClose, acceptPunchClose, getPunchStats, getProjects,
} from '../utils/api';
import {
  Badge, Tag, Button, Card, CardHeader, CardBody,
  Modal, Alert, SectionHeader, FilterBar, EmptyState, ProgressBar,
} from '../components/shared/UI';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DISCIPLINES = [
  'Civil/Structural','Piping','Mechanical','Electrical',
  'Instrumentation','Coating/Painting','Insulation',
  'Welding','NDT','Safety','Process','Other',
];
const CATEGORIES = [
  { value: 'A', label: 'Category A — Must clear before MC/Handover', color: 'var(--red)'    },
  { value: 'B', label: 'Category B — Clear after handover (agreed period)', color: 'var(--amber)' },
  { value: 'C', label: 'Category C — Deferred / observation only',  color: 'var(--blue)'   },
];
const MILESTONES = ['MC', 'RFSU', 'Handover', 'Final Acceptance', 'None'];
const PRIORITIES  = ['Critical', 'High', 'Medium', 'Low'];

const CAT_COLOR = { A: 'var(--red)', B: 'var(--amber)', C: 'var(--blue)' };
const PRI_COLOR = { Critical: 'var(--red)', High: 'var(--amber)', Medium: 'var(--blue)', Low: 'var(--steel)' };

const EMPTY_FORM = {
  project_id: '', system: '', subsystem: '', area_location: '',
  discipline: 'Piping', category: 'A', priority: 'High',
  description: '', reference_drawing: '', reference_spec: '',
  responsible_contractor: '', responsible_person: '',
  due_date: '', milestone: 'MC', walkdown_ref: '',
};

// ── MC STATUS BANNER ──────────────────────────────────────────────────────────
const MCBanner = ({ stats }) => {
  if (!stats) return null;
  const clear = stats.mcBlocking === 0;
  return (
    <div style={{
      background: clear ? 'var(--green-bg)' : 'var(--red-bg)',
      border: `1px solid ${clear ? 'var(--green)' : 'var(--red)'}`,
      borderRadius: 'var(--r-lg)', padding: '14px 20px', marginBottom: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div className="flex items-c gap3">
        <div style={{ fontSize: 24 }}>{clear ? '✅' : '⛔'}</div>
        <div>
          <div style={{ fontFamily: 'var(--fD)', fontSize: 15, fontWeight: 700, color: clear ? '#0E6A2A' : '#8A1A14' }}>
            Mechanical Completion (MC) Gate — {clear ? 'CLEAR FOR MC' : `BLOCKED: ${stats.mcBlocking} Cat-A item${stats.mcBlocking !== 1 ? 's' : ''} outstanding`}
          </div>
          <div style={{ fontSize: 12, color: clear ? '#1A9E3A' : '#CC2A21', marginTop: 2, fontFamily: 'var(--fM)' }}>
            {clear
              ? 'All Category A punch items closed. MC certificate may be issued.'
              : `Category A items must be cleared before MC can be declared. ${stats.overdue || 0} item${stats.overdue !== 1 ? 's' : ''} overdue.`}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--fD)', fontSize: 28, fontWeight: 700, color: clear ? 'var(--green)' : 'var(--red)' }}>
          {stats.completionPct}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fM)' }}>PUNCH COMPLETE</div>
      </div>
    </div>
  );
};

// ── SYSTEM COMPLETION PANEL ───────────────────────────────────────────────────
const SystemPanel = ({ bySystem }) => {
  if (!bySystem || !Object.keys(bySystem).length) return null;
  return (
    <Card className="mb4">
      <CardHeader title="System Completion Status" subtitle="Punch clearance by system — key for MC walk-down tracking" />
      <CardBody>
        {Object.entries(bySystem).map(([sys, data]) => (
          <div key={sys} style={{ marginBottom: 14 }}>
            <div className="flex jb items-c mb2">
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{sys}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fM)' }}>
                  {data.open} open / {data.total} total
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--fM)', fontSize: 13, fontWeight: 700,
                color: data.pct === 100 ? 'var(--green)' : data.pct >= 70 ? 'var(--amber)' : 'var(--red)',
              }}>
                {data.pct}%
              </div>
            </div>
            <ProgressBar
              value={data.pct}
              color={data.pct === 100 ? 'var(--green)' : data.pct >= 70 ? 'var(--amber)' : 'var(--red)'}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

// ── CLOSURE MODAL ─────────────────────────────────────────────────────────────
const ClosureModal = ({ item, onClose, onSubmit }) => {
  const [comments, setComments] = useState('');
  const [evidence, setEvidence] = useState('');

  const handleSubmit = () => {
    if (!comments.trim()) { toast.error('Closure comments required.'); return; }
    onSubmit(item.id, {
      closure_comments: comments,
      closure_evidence: evidence.split('\n').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <Modal open title={`Submit Closure — ${item?.punch_number}`}
      subtitle={`Category ${item?.category} · ${item?.discipline}`}
      onClose={onClose} size={520}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Submit for Verification</Button>
      </>}
    >
      <Alert type="info" className="mb4">
        Closure will be submitted for client/QA verification. Record will be updated to <strong>Pending Verification</strong> until accepted.
      </Alert>
      <div className="fg mb3">
        <label className="fg-label">Closure Description / Corrective Work Done</label>
        <textarea className="fc" rows={4} value={comments} onChange={e => setComments(e.target.value)}
          placeholder="Describe the work completed to address this punch item. Reference applicable documents or tests performed." />
      </div>
      <div className="fg">
        <label className="fg-label">Closure Evidence (one per line)</label>
        <textarea className="fc" rows={3} value={evidence} onChange={e => setEvidence(e.target.value)}
          placeholder={"Re-test report RT-NLNG-031\nPhoto evidence PL-0001-01.jpg\nRT acceptance certificate"} />
      </div>
    </Modal>
  );
};

// ── ACCEPT MODAL ──────────────────────────────────────────────────────────────
const AcceptModal = ({ item, onClose, onAccept, onReject }) => {
  const [reason, setReason] = useState('');
  return (
    <Modal open title={`Verify Closure — ${item?.punch_number}`}
      subtitle="Accept or reject contractor's closure submission"
      onClose={onClose} size={500}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => onReject(item.id, reason)}>Reject Closure</Button>
        <Button variant="primary" onClick={() => onAccept(item.id)}>Accept & Close</Button>
      </>}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16 }}>
        <div className="mono-sm mb2">CONTRACTOR'S CLOSURE STATEMENT</div>
        <div style={{ fontSize: 13 }}>{item?.closure_comments || '—'}</div>
        {item?.closure_evidence?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="mono-sm mb2">EVIDENCE PROVIDED</div>
            {item.closure_evidence.map(e => (
              <div key={e} style={{ fontSize: 12, color: 'var(--signal-dk)', fontFamily: 'var(--fM)' }}>• {e}</div>
            ))}
          </div>
        )}
      </div>
      <div className="fg">
        <label className="fg-label">Rejection Reason (if rejecting)</label>
        <textarea className="fc" rows={2} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="State reason if rejecting closure (e.g. evidence insufficient, re-test required)…" />
      </div>
    </Modal>
  );
};

// ── PUNCH ITEM CARD ───────────────────────────────────────────────────────────
const PunchCard = ({ item, onClose, onVerify, canAccept }) => {
  const overdue = item.due_date && new Date(item.due_date) < new Date() && !['Accepted'].includes(item.status);

  return (
    <div className="card mb3" style={{ borderLeft: `4px solid ${CAT_COLOR[item.category] || 'var(--border)'}` }}>
      <div className="card-bd">
        {/* Header row */}
        <div className="flex jb items-c mb3">
          <div className="flex items-c gap3">
            <Tag>{item.punch_number}</Tag>
            <div
              style={{ padding: '2px 8px', borderRadius: 'var(--r)', background: CAT_COLOR[item.category] + '20', border: `1px solid ${CAT_COLOR[item.category]}40`, fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 700, color: CAT_COLOR[item.category] }}
            >
              Cat {item.category}
            </div>
            <span style={{ padding: '2px 8px', borderRadius: 'var(--r)', background: PRI_COLOR[item.priority] + '18', border: `1px solid ${PRI_COLOR[item.priority]}30`, fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 600, color: PRI_COLOR[item.priority] }}>
              {item.priority}
            </span>
            <Badge label={item.discipline} />
          </div>
          <div className="flex items-c gap2">
            <Badge label={item.status} />
            {overdue && <span style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--red)', fontWeight: 700 }}>OVERDUE</span>}
          </div>
        </div>

        {/* System / location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            { l: 'SYSTEM', v: item.system || '—' },
            { l: 'SUBSYSTEM', v: item.subsystem || '—' },
            { l: 'LOCATION', v: item.area_location || '—' },
          ].map(f => (
            <div key={f.l}>
              <div style={{ fontFamily: 'var(--fM)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 2 }}>{f.l}</div>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.v}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '10px 14px', borderLeft: '3px solid var(--border)', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--fM)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>PUNCH DESCRIPTION</div>
          <div style={{ fontSize: 13 }}>{item.description}</div>
        </div>

        {/* Reference docs + milestone */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11.5, marginBottom: 12 }}>
          {item.reference_drawing && (
            <span style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--text-muted)' }}>
              📐 {item.reference_drawing}
            </span>
          )}
          {item.reference_spec && (
            <span style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--text-muted)' }}>
              📋 {item.reference_spec}
            </span>
          )}
          <span style={{ padding: '1px 8px', borderRadius: 10, background: 'var(--ore)', color: 'var(--signal)', fontFamily: 'var(--fM)', fontSize: 10, fontWeight: 600 }}>
            {item.milestone}
          </span>
        </div>

        {/* Closure evidence (if submitted) */}
        {item.status === 'Pending Verification' && item.closure_comments && (
          <div style={{ background: 'var(--amber-bg)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12, borderLeft: '3px solid var(--amber)' }}>
            <div style={{ fontFamily: 'var(--fM)', fontSize: 9, color: '#B5780A', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>CLOSURE SUBMITTED — PENDING VERIFICATION</div>
            <div style={{ fontSize: 12.5 }}>{item.closure_comments}</div>
            {item.closure_evidence?.length > 0 && (
              <div className="flex gap2 mt3" style={{ flexWrap: 'wrap' }}>
                {item.closure_evidence.map(e => <Badge key={e} label="Released" />)}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--fM)' }}>
              Submitted by {item.closed_by_name} on {item.closed_date}
            </div>
          </div>
        )}

        {/* Accepted closure */}
        {item.status === 'Accepted' && (
          <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12, borderLeft: '3px solid var(--green)' }}>
            <div style={{ fontFamily: 'var(--fM)', fontSize: 9, color: '#1A9E3A', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>CLOSURE ACCEPTED</div>
            <div style={{ fontSize: 12.5 }}>{item.closure_comments}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--fM)' }}>
              Accepted by {item.client_accepted_by} on {item.client_accepted_date}
            </div>
          </div>
        )}

        {/* Footer: meta + actions */}
        <div className="flex jb items-c">
          <div style={{ display: 'flex', gap: 18, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fM)', flexWrap: 'wrap' }}>
            <span>👤 {item.raised_by_name}</span>
            <span>🏗 {item.responsible_contractor}</span>
            <span>📅 Raised: {item.raised_date}</span>
            {item.due_date && (
              <span style={{ color: overdue ? 'var(--red)' : 'inherit' }}>
                ⏰ Due: {item.due_date}
              </span>
            )}
            {item.days_open !== undefined && !['Accepted'].includes(item.status) && (
              <span style={{ color: item.days_open > 14 ? 'var(--red)' : 'inherit' }}>
                ⚡ {item.days_open}d open
              </span>
            )}
            {item.walkdown_ref && <span>🚶 {item.walkdown_ref}</span>}
          </div>
          <div className="flex gap2">
            {item.status === 'Open' || item.status === 'In Progress' || item.status === 'Rejected Closure' ? (
              <Button size="xs" variant="primary" onClick={() => onClose(item)}>Submit Closure</Button>
            ) : null}
            {item.status === 'Pending Verification' && canAccept && (
              <Button size="xs" variant="dark" onClick={() => onVerify(item)}>Verify Closure</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const PunchListPage = () => {
  const { hasPermission } = useAuth();
  const canAccept = hasPermission('ncr', 'create'); // QA manager / client rep

  const [items, setItems]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [filter, setFilter]         = useState('All');
  const [catFilter, setCatFilter]   = useState('All');
  const [projFilter, setProjFilter] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [closeItem, setCloseItem]   = useState(null);
  const [verifyItem, setVerifyItem] = useState(null);

  const [form, setForm]             = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (filter !== 'All')    params.status   = filter;
    if (catFilter !== 'All') params.category = catFilter;
    if (projFilter)          params.project_id = projFilter;

    setLoading(true);
    Promise.all([
      getPunchItems(params),
      getPunchStats(projFilter ? { project_id: projFilter } : {}),
      getProjects(),
    ])
      .then(([i, s, p]) => {
        setItems(i.data.data || []);
        setStats(s.data.data);
        setProjects(p.data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, catFilter, projFilter]);

  useEffect(() => { load(); }, [load]);

  // Create
  const handleCreate = async () => {
    if (!form.project_id || !form.description) {
      toast.error('Project and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createPunchItem(form);
      toast.success(`${res.data.data.punch_number} raised`);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to raise punch item');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit closure
  const handleSubmitClose = async (id, data) => {
    try {
      await submitPunchClose(id, data);
      toast.success('Closure submitted for verification');
      setCloseItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit closure');
    }
  };

  // Accept closure
  const handleAccept = async (id) => {
    try {
      await acceptPunchClose(id, { accepted: true });
      toast.success('Closure accepted ✓');
      setVerifyItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept');
    }
  };

  // Reject closure
  const handleReject = async (id, reason) => {
    try {
      await acceptPunchClose(id, { accepted: false, rejection_reason: reason });
      toast('Closure rejected — item returned to contractor', { icon: '↩' });
      setVerifyItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <div>
      <SectionHeader
        title="Punch List"
        subtitle="Pre-commissioning & handover deficiency tracking — Category A/B/C with MC gate enforcement"
        actions={
          <div className="flex gap2 items-c">
            <select className="fc" style={{ width: 220, padding: '5px 10px', fontSize: 12 }}
              value={projFilter} onChange={e => setProjFilter(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name.slice(0, 25)}</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Raise Punch Item</Button>
          </div>
        }
      />

      {/* MC Banner */}
      <MCBanner stats={stats} />

      {/* Category Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Cat A Open',     value: stats?.catA_open ?? '—',      sub: 'MC blocking',       color: 'var(--red)'    },
          { label: 'Cat B Open',     value: stats?.catB_open ?? '—',      sub: 'Post-handover',     color: 'var(--amber)'  },
          { label: 'Cat C Open',     value: stats?.catC_open ?? '—',      sub: 'Deferred items',    color: 'var(--blue)'   },
          { label: 'Accepted / Closed', value: stats?.accepted ?? '—',   sub: `of ${stats?.total ?? 0} total`, color: 'var(--green)' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-accent" style={{ background: k.color }} />
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* System completion */}
      {stats?.bySystem && Object.keys(stats.bySystem).length > 0 && (
        <SystemPanel bySystem={stats.bySystem} />
      )}

      {/* Filter bar */}
      <div className="flex gap2 mb4" style={{ flexWrap: 'wrap' }}>
        <FilterBar
          options={['All', 'Open', 'In Progress', 'Pending Verification', 'Accepted', 'Rejected Closure']}
          active={filter}
          onChange={setFilter}
        />
        <div style={{ borderLeft: '1px solid var(--border)', margin: '0 4px' }} />
        {['All', 'A', 'B', 'C'].map(cat => (
          <Button key={cat} size="sm"
            variant={catFilter === cat ? 'primary' : 'ghost'}
            onClick={() => setCatFilter(cat)}
            style={cat !== 'All' ? { borderColor: CAT_COLOR[cat], color: catFilter === cat ? 'var(--iron)' : CAT_COLOR[cat] } : {}}
          >
            {cat === 'All' ? 'All Categories' : `Cat ${cat}`}
          </Button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="📋" title="No punch items found" subtitle="Raise the first punch item for this walk-down"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Raise Punch Item</Button>}
        />
      ) : items.map(item => (
        <PunchCard
          key={item.id}
          item={item}
          onClose={setCloseItem}
          onVerify={setVerifyItem}
          canAccept={canAccept}
        />
      ))}

      {/* ── CREATE MODAL ─────────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Raise Punch List Item"
        subtitle="Raised during walk-down or final inspection — enforces MC gate for Category A"
        size={740}
        footer={<>
          <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Raising…' : 'Raise Punch Item'}
          </Button>
        </>}
      >
        {/* Category explanation */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {CATEGORIES.map(c => (
            <div key={c.value}
              onClick={() => setForm({ ...form, category: c.value })}
              style={{
                padding: '10px 12px', borderRadius: 'var(--r)', cursor: 'pointer',
                border: `2px solid ${form.category === c.value ? c.color : 'var(--border)'}`,
                background: form.category === c.value ? c.color + '15' : 'var(--surface2)',
                transition: 'all .12s',
              }}
            >
              <div style={{ fontFamily: 'var(--fM)', fontSize: 11, fontWeight: 700, color: c.color, marginBottom: 4 }}>
                Category {c.value}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-sub)' }}>{c.label.split('—')[1].trim()}</div>
            </div>
          ))}
        </div>

        <div className="fg2">
          <div className="fg">
            <label className="fg-label">Project</label>
            <select className="fc" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name.slice(0, 28)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Discipline</label>
            <select className="fc" value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })}>
              {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">System</label>
            <input className="fc" value={form.system} onChange={e => setForm({ ...form, system: e.target.value })} placeholder="e.g. System 10 — Shell & Headers" />
          </div>
          <div className="fg">
            <label className="fg-label">Subsystem</label>
            <input className="fc" value={form.subsystem} onChange={e => setForm({ ...form, subsystem: e.target.value })} placeholder="e.g. Shell Course Assembly" />
          </div>
          <div className="fg fg-full">
            <label className="fg-label">Area / Location</label>
            <input className="fc" value={form.area_location} onChange={e => setForm({ ...form, area_location: e.target.value })} placeholder="e.g. Fabrication Bay 3, PRJ-002" />
          </div>
          <div className="fg fg-full">
            <label className="fg-label">Punch Description</label>
            <textarea className="fc" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the deficiency in technical detail. Reference applicable drawing, spec, or code clause." />
          </div>
          <div className="fg">
            <label className="fg-label">Reference Drawing</label>
            <input className="fc" value={form.reference_drawing} onChange={e => setForm({ ...form, reference_drawing: e.target.value })} placeholder="e.g. DWG-NLNG-PV-001 Rev 3" />
          </div>
          <div className="fg">
            <label className="fg-label">Reference Spec / Code</label>
            <input className="fc" value={form.reference_spec} onChange={e => setForm({ ...form, reference_spec: e.target.value })} placeholder="e.g. ASME VIII UW-51 / QCP-COAT-002" />
          </div>
          <div className="fg">
            <label className="fg-label">Priority</label>
            <select className="fc" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Milestone Gate</label>
            <select className="fc" value={form.milestone} onChange={e => setForm({ ...form, milestone: e.target.value })}>
              {MILESTONES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Responsible Contractor</label>
            <input className="fc" value={form.responsible_contractor} onChange={e => setForm({ ...form, responsible_contractor: e.target.value })} />
          </div>
          <div className="fg">
            <label className="fg-label">Responsible Person</label>
            <input className="fc" value={form.responsible_person} onChange={e => setForm({ ...form, responsible_person: e.target.value })} />
          </div>
          <div className="fg">
            <label className="fg-label">Due Date</label>
            <input className="fc" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="fg">
            <label className="fg-label">Walk-down Reference</label>
            <input className="fc" value={form.walkdown_ref} onChange={e => setForm({ ...form, walkdown_ref: e.target.value })} placeholder="e.g. WD-PRJ002-001" />
          </div>
        </div>
      </Modal>

      {/* Closure modal */}
      {closeItem && (
        <ClosureModal
          item={closeItem}
          onClose={() => setCloseItem(null)}
          onSubmit={handleSubmitClose}
        />
      )}

      {/* Verification modal */}
      {verifyItem && (
        <AcceptModal
          item={verifyItem}
          onClose={() => setVerifyItem(null)}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

export default PunchListPage;
