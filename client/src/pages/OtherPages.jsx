// ── NCR PAGE ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { getNCRs, createNCR, closeNCR, getProjects, createProject,
         getITPItems, signOffITP, updateITPItem, createITPItem, getMaterials, createMaterial,
         getDocuments, createDocument, approveDocument,
         getQualityPlans, createQualityPlan, approveQualityPlan,
         getWelders, createWelder, updateWelder,
         getBlasters, createBlaster, updateBlaster,
         getPainters, createPainter, updatePainter,
         getEquipment, createEquipment, calibrateEquipment,
         getAuditLog, getUsers, toggleUser, getInspectorWorkload, updateUserCapacity,
         aiNCRAssist, aiExtractWelderDoc } from '../utils/api';
import { Badge, Tag, Button, Card, CardHeader, CardBody, Modal,
         Alert, SectionHeader, FilterBar, EmptyState, ProgressBar } from '../components/shared/UI';
import { AttachmentPanel } from '../components/shared/AttachmentPanel';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Format audit change values for better readability
const formatAuditChange = (before, after) => {
  try {
    const beforeVal = before && typeof before === 'string' ? JSON.parse(before) : before;
    const afterVal = after && typeof after === 'string' ? JSON.parse(after) : after;
    
    if (!afterVal) return null;
    
    const changes = [];
    const allKeys = new Set([...Object.keys(beforeVal || {}), ...Object.keys(afterVal)]);
    
    allKeys.forEach(key => {
      const beforeValStr = beforeVal?.[key];
      const afterValStr = afterVal?.[key];
      
      if (beforeValStr !== afterValStr) {
        const displayBefore = beforeValStr !== undefined ? String(beforeValStr) : '—';
        const displayAfter = afterValStr !== undefined ? String(afterValStr) : '—';
        changes.push(`${key}: ${displayBefore} → ${displayAfter}`);
      }
    });
    
    return changes.length > 0 ? changes.join(', ') : null;
  } catch {
    // Fallback to simple string display if parsing fails
    return after ? String(after) : null;
  }
};

// ── NCR ───────────────────────────────────────────────────────────────────────
export const NCRPage = () => {
  const [ncrs, setNcrs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    project_id:'', inspection_ref:'', description:'', severity:'Major',
    responsible_party:'', root_cause:'', corrective_action:'',
    preventive_action:'', due_date:''
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null); // { root_cause_category, is_likely_repeat, repeat_reasoning, similar_ncrs }

  const load = useCallback(() => {
    const params = {};
    if (filter !== 'All') {
      if (['Open','Under Review','Closed'].includes(filter)) params.status = filter;
      else params.severity = filter;
    }
    Promise.all([getNCRs(params), getProjects()])
      .then(([n, p]) => { setNcrs(n.data.data || []); setProjects(p.data.data || []); })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAIAssist = async () => {
    if (!form.description || form.description.trim().length < 10) {
      toast.error('Add a fuller description before requesting AI assistance.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiNCRAssist({ description: form.description, severity: form.severity, project_id: form.project_id });
      const d = res.data.data;
      setForm(f => ({
        ...f,
        root_cause: d.root_cause || f.root_cause,
        corrective_action: d.corrective_action || f.corrective_action,
        preventive_action: d.preventive_action || f.preventive_action,
      }));
      setAiResult(d);
      toast.success('AI draft inserted — review and edit before issuing.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI assist failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.project_id || !form.description) { toast.error('Project and description required.'); return; }
    try {
      const res = await createNCR(form);
      toast.success(`${res.data.data.ncr_number} raised`);
      if (res.data.warning) toast(res.data.warning, { icon: '⚠️' });
      setShowModal(false);
      setForm({ project_id:'', inspection_ref:'', description:'', severity:'Major', responsible_party:'', root_cause:'', corrective_action:'', preventive_action:'', due_date:'' });
      setAiResult(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to raise NCR'); }
  };

  const handleClose = async (id, num) => {
    try {
      await closeNCR(id, {});
      toast.success(`${num} closed`);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to close'); }
  };

  const SEV_COLOR = { Critical:'var(--red)', Major:'var(--amber)', Minor:'var(--blue)' };

  return (
    <div>
      <SectionHeader title="Non-Conformance Reports" subtitle="Full lifecycle: Finding → Root Cause → Corrective & Preventive Action → Verified Closure"
        actions={<>
          <FilterBar options={['All','Open','Under Review','Closed','Critical','Major']} active={filter} onChange={setFilter} />
          <Button variant="danger" size="sm" onClick={() => setShowModal(true)}>+ Raise NCR</Button>
        </>}
      />

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><div className="spinner"/></div>
      : ncrs.length === 0 ? <EmptyState icon="⚠" title="No NCRs found" subtitle="No non-conformances match this filter" />
      : ncrs.map(n => (
        <Card key={n.id} className="mb3" style={{ borderLeft: `4px solid ${SEV_COLOR[n.severity] || 'var(--border)'}` }}>
          <CardBody>
            <div className="flex jb items-c mb3">
              <div className="flex items-c gap3">
                <Tag>{n.ncr_number}</Tag>
                {n.inspection_ref && <span style={{fontFamily:'var(--fM)',fontSize:10,color:'var(--text-muted)'}}>→ {n.inspection_ref}</span>}
                <Badge label={n.severity} />
              </div>
              <div className="flex gap2 items-c">
                <Badge label={n.status} />
                {n.status !== 'Closed' && <Button size="xs" variant="ghost" onClick={() => handleClose(n.id, n.ncr_number)}>Mark Closed</Button>}
              </div>
            </div>
            <div style={{fontSize:13.5,fontWeight:500,marginBottom:12}}>{n.description}</div>
            <div className="g3 mb3">
              {[{label:'ROOT CAUSE',val:n.root_cause},{label:'CORRECTIVE ACTION',val:n.corrective_action},{label:'PREVENTIVE ACTION',val:n.preventive_action}].map(b => (
                <div key={b.label} style={{background:'var(--surface)',borderRadius:'var(--r)',padding:'10px 12px'}}>
                  <div style={{fontFamily:'var(--fM)',fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:4}}>{b.label}</div>
                  <div style={{fontSize:12.5}}>{b.val || '— Pending'}</div>
                </div>
              ))}
            </div>
            <div className="flex gap2" style={{flexWrap:'wrap',fontSize:11,fontFamily:'var(--fM)',color:'var(--text-muted)'}}>
              <span>👤 {n.raised_by_name}</span>
              <span>📅 {n.raised_date}</span>
              <span>⏰ Due {n.due_date}</span>
              {n.status !== 'Closed' && <span style={{color:n.days_open>7?'var(--red)':'var(--amber)'}}>⚡ {n.days_open}d open</span>}
              {n.closed_date && <span style={{color:'var(--green)'}}>✓ Closed {n.closed_date}</span>}
              {n.is_repeat && <span style={{color:'var(--red)',fontWeight:700}}>⚠ REPEAT NCR</span>}
            </div>
            {n.closure_evidence?.length > 0 && (
              <div style={{marginTop:10}}>
                <div style={{fontFamily:'var(--fM)',fontSize:9,color:'var(--text-muted)',marginBottom:5}}>CLOSURE EVIDENCE</div>
                <div className="flex gap2" style={{flexWrap:'wrap'}}>{n.closure_evidence.map(e => <Badge key={e} label="Released" />)}</div>
              </div>
            )}
          </CardBody>
        </Card>
      ))}

      <Modal open={showModal} onClose={() => { setShowModal(false); setAiResult(null); }} title="Raise Non-Conformance Report" subtitle="Immutable once issued — visible to contractor and client"
        footer={<><Button variant="ghost" onClick={() => { setShowModal(false); setAiResult(null); }}>Cancel</Button><Button variant="danger" onClick={handleCreate}>Issue NCR</Button></>}>
        <Alert type="danger" className="mb4">⚠ Verify all details before issuing. NCR cannot be deleted once raised.</Alert>
        <div className="fg2">
          <div className="fg"><label className="fg-label">Project</label>
            <select className="fc" value={form.project_id} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Severity</label>
            <select className="fc" value={form.severity} onChange={e => setForm({...form,severity:e.target.value})}>
              <option>Minor</option><option>Major</option><option>Critical</option>
            </select>
          </div>
          <div className="fg"><label className="fg-label">Inspection Ref.</label>
            <input className="fc" value={form.inspection_ref} onChange={e => setForm({...form,inspection_ref:e.target.value})} placeholder="IR-2025-XXXX"/>
          </div>
          <div className="fg"><label className="fg-label">Responsible Party</label>
            <input className="fc" value={form.responsible_party} onChange={e => setForm({...form,responsible_party:e.target.value})}/>
          </div>
          <div className="fg fg-full"><label className="fg-label">Non-Conformance Description</label>
            <textarea className="fc" rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Technical description referencing violated standard clauses."/>
          </div>
          <div className="fg fg-full">
            <Button size="sm" variant="primary" onClick={handleAIAssist} disabled={aiLoading}>
              {aiLoading ? '✨ Analyzing…' : '✨ AI Assist — draft root cause & CAPA'}
            </Button>
            {aiResult && (
              <div style={{marginTop:10,background:'var(--surface)',borderRadius:'var(--r)',padding:'10px 12px',fontSize:12}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:aiResult.is_likely_repeat?6:0}}>
                  <Tag>{aiResult.root_cause_category}</Tag>
                  {aiResult.is_likely_repeat && <Badge label="Possible Repeat" />}
                </div>
                {aiResult.is_likely_repeat && aiResult.repeat_reasoning && (
                  <div style={{color:'var(--text-muted)'}}>{aiResult.repeat_reasoning}</div>
                )}
                {aiResult.similar_ncrs?.length > 0 && (
                  <div style={{marginTop:6,fontFamily:'var(--fM)',fontSize:10.5,color:'var(--text-muted)'}}>
                    Grounded in: {aiResult.similar_ncrs.map(s => s.ncr_number).join(', ')}
                  </div>
                )}
                <div style={{marginTop:6,fontSize:11,color:'var(--text-muted)'}}>Draft inserted into Root Cause, Corrective Action, and Preventive Action below — review and edit before issuing.</div>
              </div>
            )}
          </div>
          <div className="fg fg-full"><label className="fg-label">Root Cause Analysis</label>
            <textarea className="fc" rows={2} value={form.root_cause} onChange={e => setForm({...form,root_cause:e.target.value})} placeholder="5-Why or Fishbone result."/>
          </div>
          <div className="fg fg-full"><label className="fg-label">Corrective Action</label>
            <textarea className="fc" rows={2} value={form.corrective_action} onChange={e => setForm({...form,corrective_action:e.target.value})}/>
          </div>
          <div className="fg fg-full"><label className="fg-label">Preventive Action</label>
            <textarea className="fc" rows={2} value={form.preventive_action} onChange={e => setForm({...form,preventive_action:e.target.value})} placeholder="What systemic change prevents recurrence?"/>
          </div>
          <div className="fg"><label className="fg-label">Due Date</label>
            <input className="fc" type="date" value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})}/>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── PROJECTS PAGE ─────────────────────────────────────────────────────────────
export const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', client:'', contractor:'', location:'', start_date:'', end_date:'', standards:'' });

  const load = () => getProjects().then(r => setProjects(r.data.data || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await createProject({ ...form, standards: form.standards.split(',').map(s => s.trim()).filter(Boolean) });
      toast.success('Project created');
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <SectionHeader title="Project Register" subtitle="All active and historical quality projects"
        actions={<Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ New Project</Button>}
      />
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><div className="spinner"/></div>
      : projects.map(p => (
        <Card key={p.id} className="mb3">
          <CardBody>
            <div className="flex jb items-c mb3">
              <div className="flex items-c gap3">
                <Tag>{p.project_number}</Tag>
                <div>
                  <div style={{fontWeight:700,fontSize:14,fontFamily:'var(--fD)'}}>{p.name}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{p.client} · {p.contractor} · {p.location}</div>
                </div>
              </div>
              <Badge label={p.status} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:12}}>
              {[{l:'Start Date',v:p.start_date},{l:'End Date',v:p.end_date},{l:'Completion',v:`${p.completion_pct}%`}].map(f => (
                <div key={f.l}>
                  <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.8px'}}>{f.l}</div>
                  <div style={{fontFamily:'var(--fM)',fontSize:13.5,fontWeight:600}}>{f.v}</div>
                </div>
              ))}
            </div>
            <ProgressBar value={p.completion_pct} color={p.status==='On Hold'?'var(--amber)':'var(--signal)'} />
            <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
              {(p.standards||[]).map(s => <Tag key={s}>{s}</Tag>)}
            </div>
          </CardBody>
        </Card>
      ))}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Project"
        footer={<><Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button><Button variant="primary" onClick={handleCreate}>Create Project</Button></>}>
        <div className="fg2">
          <div className="fg fg-full"><label className="fg-label">Project Name</label><input className="fc" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. OML 61 Pipeline Rehabilitation Phase 2"/></div>
          <div className="fg"><label className="fg-label">Client</label><input className="fc" value={form.client} onChange={e => setForm({...form,client:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Contractor</label><input className="fc" value={form.contractor} onChange={e => setForm({...form,contractor:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Location</label><input className="fc" value={form.location} onChange={e => setForm({...form,location:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Start Date</label><input className="fc" type="date" value={form.start_date} onChange={e => setForm({...form,start_date:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">End Date</label><input className="fc" type="date" value={form.end_date} onChange={e => setForm({...form,end_date:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Applicable Standards (comma-separated)</label><input className="fc" value={form.standards} onChange={e => setForm({...form,standards:e.target.value})} placeholder="API 1104, ASME IX, AWS D1.1"/></div>
        </div>
      </Modal>
    </div>
  );
};

// ── ITP PAGE ──────────────────────────────────────────────────────────────────
export const ITPPage = () => {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [showSign, setShowSign] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [signRemarks, setSignRemarks] = useState('');
  const [signRef, setSignRef] = useState('');
  const [editForm, setEditForm] = useState({});
  const [createForm, setCreateForm] = useState({ activity: '', acceptance_criteria: '', responsibility: '', is_hold_point: false, is_witness_point: false, sequence: 1 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getProjects().then(r => {
      const ps = r.data.data || [];
      setProjects(ps);
      if (ps.length) setSelectedProject(ps[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    getITPItems({ project_id: selectedProject }).then(r => setItems(r.data.data || [])).finally(() => setLoading(false));
  }, [selectedProject]);

  const handleSignOff = async () => {
    try {
      await signOffITP(showSign.id, { inspection_ref: signRef, sign_off_remarks: signRemarks });
      toast.success(`Hold point released: ${showSign.activity}`);
      setShowSign(null); setSignRemarks(''); setSignRef('');
      getITPItems({ project_id: selectedProject }).then(r => setItems(r.data.data || []));
    } catch (err) { toast.error(err.response?.data?.message || 'Sign-off failed'); }
  };

  const handleEdit = (item) => {
    setEditForm({
      activity: item.activity,
      acceptance_criteria: item.acceptance_criteria,
      responsibility: item.responsibility,
      is_hold_point: item.is_hold_point,
      is_witness_point: item.is_witness_point,
    });
    setShowEdit(item);
  };

  const handleUpdate = async () => {
    if (!editForm.activity || !editForm.responsibility) {
      toast.error('Activity and Responsibility are required');
      return;
    }
    setUpdating(true);
    try {
      await updateITPItem(showEdit.id, editForm);
      toast.success('ITP item updated successfully');
      setShowEdit(null);
      setEditForm({});
      getITPItems({ project_id: selectedProject }).then(r => setItems(r.data.data || []));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.activity || !createForm.responsibility) {
      toast.error('Activity and Responsibility are required');
      return;
    }
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }
    setCreating(true);
    try {
      const nextSequence = items.length + 1;
      await createITPItem({ ...createForm, project_id: selectedProject, sequence: nextSequence });
      toast.success('ITP item created successfully');
      setShowCreate(false);
      setCreateForm({ activity: '', acceptance_criteria: '', responsibility: '', is_hold_point: false, is_witness_point: false, sequence: 1 });
      getITPItems({ project_id: selectedProject }).then(r => setItems(r.data.data || []));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const stepCls = (item) => {
    if (item.status === 'Complete') return 'complete';
    if (item.status === 'In Progress') return 'active';
    if (item.status === 'Blocked') return 'blocked';
    return 'pending';
  };

  return (
    <div>
      <SectionHeader title="ITP & Workflow Engine" subtitle="Hold points are technically enforced — downstream steps locked until sign-off"
        actions={
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <select className="fc" style={{width:300}} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name.slice(0,30)}</option>)}
            </select>
            <Button variant="primary" onClick={() => setShowCreate(true)}>+ Add ITP Item</Button>
          </div>
        }
      />
      <Alert type="danger" className="mb4">⛔ <strong>Production Block Active:</strong> Hold points block production advance. Steps cannot proceed without verified QC sign-off.</Alert>
      <div className="g2">
        <Card>
          <CardHeader title="ITP Activity Matrix" />
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>#</th><th>Activity</th><th>Criteria</th><th>Resp.</th><th>H</th><th>W</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
                : items.map((item, idx) => (
                  <tr key={item.id} style={{ opacity: item.status === 'Blocked' ? 0.5 : 1, background: item.status === 'In Progress' ? 'var(--signal-dim)' : item.status === 'Blocked' ? 'var(--red-bg)' : '' }}>
                    <td><span style={{fontFamily:'var(--fM)',fontSize:10}}>{String(idx+1).padStart(2,'0')}</span></td>
                    <td style={{fontWeight:600,fontSize:12.5}}>{item.activity}</td>
                    <td style={{fontSize:11,fontFamily:'var(--fM)',color:'var(--text-sub)',maxWidth:160}}>{item.acceptance_criteria}</td>
                    <td style={{fontSize:11.5}}>{item.responsibility}</td>
                    <td style={{textAlign:'center'}}>{item.is_hold_point ? <span className="chip hp" style={{padding:'1px 5px',fontSize:9}}>H</span> : <span style={{color:'var(--border-dk)'}}>—</span>}</td>
                    <td style={{textAlign:'center'}}>{item.is_witness_point ? <span className="chip wp" style={{padding:'1px 5px',fontSize:9}}>W</span> : <span style={{color:'var(--border-dk)'}}>—</span>}</td>
                    <td><Badge label={item.status} /></td>
                    <td>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        {item.status === 'In Progress' && item.is_hold_point && <Button size="xs" variant="primary" onClick={() => setShowSign(item)}>Sign Off ▸</Button>}
                        {item.status === 'Complete' && <span style={{fontSize:10,color:'var(--green)',fontFamily:'var(--fM)'}}>✓ {item.completed_date}</span>}
                        {item.status === 'Blocked' && <span style={{fontSize:10,color:'var(--red)',fontFamily:'var(--fM)'}}>⛔ Locked</span>}
                        {item.status !== 'Complete' && <Button size="xs" variant="secondary" onClick={() => handleEdit(item)}>✎ Edit</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div>
          <Card className="mb4">
            <CardHeader title="Workflow Gate Status" />
            <CardBody>
              {items.map((item, idx) => (
                <div key={item.id} className={`wf-step ${stepCls(item)}`}>
                  <div className="wf-num" style={{ background: item.status==='Complete'?'var(--green)':item.status==='In Progress'?'var(--signal)':item.status==='Blocked'?'var(--red)':'var(--border)', color: item.status==='In Progress'?'var(--iron)':'var(--white)' }}>
                    {item.status === 'Complete' ? '✓' : idx + 1}
                  </div>
                  <div>
                    <div className="wf-label">{item.activity}</div>
                    <div className="wf-sub">
                      {item.status==='Complete' ? `Signed off ${item.completed_date} — ${item.completed_by_name}`
                        : item.status==='In Progress' ? 'Active — hold point requires QC sign-off'
                        : item.status==='Blocked' ? 'Locked — upstream gate not cleared' : 'Pending'}
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Inspection Coverage" />
            <CardBody>
              {[{label:'RT Coverage (PRJ-002)',done:97.8,target:100,c:'var(--amber)'},{label:'Visual Inspection (PRJ-001)',done:100,target:100,c:'var(--green)'},{label:'DFT Spot Coverage (PRJ-004)',done:73.2,target:85,c:'var(--red)'},{label:'MT Fillet Welds (PRJ-001)',done:88.5,target:100,c:'var(--amber)'}].map(s => (
                <div key={s.label} style={{marginBottom:12}}>
                  <div className="flex jb items-c mb2">
                    <span style={{fontSize:12,fontWeight:500}}>{s.label}</span>
                    <span style={{fontFamily:'var(--fM)',fontSize:11,color:s.done<s.target?'var(--red)':'var(--green)',fontWeight:600}}>{s.done}%</span>
                  </div>
                  <ProgressBar value={s.done} color={s.c} />
                  <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginTop:3}}>Target: {s.target}%</div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
      <Modal open={!!showSign} onClose={() => setShowSign(null)} title="Release Hold Point" subtitle={showSign?.activity} size={480}
        footer={<><Button variant="ghost" onClick={() => setShowSign(null)}>Cancel</Button><Button variant="primary" onClick={handleSignOff}>✓ Release Hold & Lock Record</Button></>}>
        <Alert type="warn" className="mb4">This releases the production hold. Action recorded in immutable audit log.</Alert>
        <div className="fg2">
          <div className="fg"><label className="fg-label">Inspection Reference</label><input className="fc" value={signRef} onChange={e => setSignRef(e.target.value)} placeholder="IR-2025-XXXX"/></div>
          <div className="fg"><label className="fg-label">Acceptance Criteria</label><input className="fc" defaultValue={showSign?.acceptance_criteria} readOnly/></div>
          <div className="fg fg-full"><label className="fg-label">Remarks</label><textarea className="fc" rows={2} value={signRemarks} onChange={e => setSignRemarks(e.target.value)} placeholder="Any remarks before releasing hold…"/></div>
        </div>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Edit ITP Item" subtitle={showEdit?.activity} size={480}
        footer={<><Button variant="ghost" onClick={() => setShowEdit(null)}>Cancel</Button><Button variant="primary" onClick={handleUpdate} disabled={updating}>{updating ? 'Updating...' : 'Update Item'}</Button></>}>
        <div className="fg">
          <label className="fg-label">Activity *</label>
          <input className="fc" value={editForm.activity} onChange={e => setEditForm({...editForm, activity: e.target.value})} placeholder="Activity description"/>
        </div>
        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Acceptance Criteria</label>
          <textarea className="fc" rows={2} value={editForm.acceptance_criteria} onChange={e => setEditForm({...editForm, acceptance_criteria: e.target.value})} placeholder="Acceptance criteria"/>
        </div>
        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Responsibility *</label>
          <input className="fc" value={editForm.responsibility} onChange={e => setEditForm({...editForm, responsibility: e.target.value})} placeholder="Responsible party"/>
        </div>
        <div style={{marginTop:14,display:'flex',gap:14}}>
          <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={editForm.is_hold_point} onChange={e => setEditForm({...editForm, is_hold_point: e.target.checked})}/>
            Hold Point
          </label>
          <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={editForm.is_witness_point} onChange={e => setEditForm({...editForm, is_witness_point: e.target.checked})}/>
            Witness Point
          </label>
        </div>
      </Modal>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add ITP Item" subtitle="Create new ITP activity for selected project" size={480}
        footer={<><Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="primary" onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create Item'}</Button></>}>
        <Alert type="signal" className="mb4">New ITP items will be added to the end of the workflow sequence.</Alert>
        <div className="fg">
          <label className="fg-label">Activity *</label>
          <input className="fc" value={createForm.activity} onChange={e => setCreateForm({...createForm, activity: e.target.value})} placeholder="Activity description"/>
        </div>
        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Acceptance Criteria</label>
          <textarea className="fc" rows={2} value={createForm.acceptance_criteria} onChange={e => setCreateForm({...createForm, acceptance_criteria: e.target.value})} placeholder="Acceptance criteria"/>
        </div>
        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Responsibility *</label>
          <input className="fc" value={createForm.responsibility} onChange={e => setCreateForm({...createForm, responsibility: e.target.value})} placeholder="Responsible party"/>
        </div>
        <div style={{marginTop:14,display:'flex',gap:14}}>
          <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={createForm.is_hold_point} onChange={e => setCreateForm({...createForm, is_hold_point: e.target.checked})}/>
            Hold Point
          </label>
          <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
            <input type="checkbox" checked={createForm.is_witness_point} onChange={e => setCreateForm({...createForm, is_witness_point: e.target.checked})}/>
            Witness Point
          </label>
        </div>
      </Modal>
    </div>
  );
};

// ── MATERIALS PAGE ────────────────────────────────────────────────────────────
export const MaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ grade:'', heat_number:'', certificate_ref:'', manufacturer:'', supplier:'', received_date:'', dimensions:'' });

  const load = useCallback(() => getMaterials().then(r => { const d = r.data.data||[]; setMaterials(d); if(d.length && !selected) setSelected(d[0]); }).finally(() => setLoading(false)), [selected]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try { await createMaterial(form); toast.success('Material registered'); setShowModal(false); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const CHECKS = ['Mill Test Certificate (CMTR)','Dimensional Inspection Report','Chemical Composition Cert.','Mechanical Properties Report','Supplier Conformance Cert.','Receiving Inspection Stamp'];

  return (
    <div>
      <SectionHeader title="Material Traceability" subtitle="Full chain: Mill cert → Supplier → Receiving → Storage → Fabrication use"
        actions={<Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ Register Material</Button>}
      />
      <div className="g2">
        <Card>
          <CardHeader title="Material Register" />
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Mat. ID</th><th>Grade</th><th>Heat No.</th><th>Cert Ref.</th><th>Supplier</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
                : materials.map(m => (
                  <tr key={m.id} onClick={() => setSelected(m)} style={{cursor:'pointer', background: selected?.id===m.id?'var(--surface)':''}}>
                    <td><Tag>{m.material_id}</Tag></td>
                    <td style={{fontWeight:600,fontSize:12.5}}>{m.grade}</td>
                    <td style={{fontFamily:'var(--fM)',fontSize:11}}>{m.heat_number}</td>
                    <td style={{fontFamily:'var(--fM)',fontSize:10.5}}>{m.certificate_ref}</td>
                    <td style={{fontSize:12}}>{m.supplier}</td>
                    <td><Badge label={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <CardBody>
              {selected.status === 'Hold' && <Alert type="warn" className="mb3">⚠ On hold. Do not issue to production until QC Engineer lifts hold.</Alert>}
              <div style={{fontFamily:'var(--fM)',fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:10}}>TRACEABILITY CHAIN — {selected.heat_number}</div>
              <div className="trace-chain">
                {[
                  {label:'Mill Origin',val:selected.manufacturer,sub:selected.certificate_ref,cls:selected.status==='Hold'?'hold':'accepted'},
                  {label:'Supplier',val:selected.supplier,sub:'PO verified',cls:'accepted'},
                  {label:'Received',val:selected.received_date,sub:'Inspector verified',cls:selected.status==='Hold'?'hold':'accepted'},
                  {label:'Used In',val:selected.used_in?.length>0?selected.used_in[0]:'Not issued',sub:selected.used_in?.length>1?`+${selected.used_in.length-1} more`:'',cls:selected.used_in?.length>0?'accepted':'hold'},
                ].map((n, i, arr) => (
                  <React.Fragment key={n.label}>
                    <div className={`trace-node ${n.cls}`}>
                      <div className="trace-label">{n.label}</div>
                      <div className="trace-val">{n.val}</div>
                      {n.sub && <div style={{fontSize:10.5,color:'var(--text-muted)',marginTop:2}}>{n.sub}</div>}
                    </div>
                    {i < arr.length - 1 && <div className="trace-arrow">→</div>}
                  </React.Fragment>
                ))}
              </div>
            </CardBody>
          )}
        </Card>
        {selected && (
          <Card>
            <CardHeader title="Certificate Checklist" subtitle={selected.material_id} />
            <CardBody style={{padding:'8px 18px'}}>
              {CHECKS.map((c, i) => {
                const ok = selected.cert_checklist ? Object.values(selected.cert_checklist)[i] !== false : selected.status !== 'Hold';
                return (
                  <div key={c} className="val-row">
                    <div className="val-icon" style={{color:ok?'var(--green)':'var(--red)'}}>{ok?'✓':'✗'}</div>
                    <div className="val-label">{c}</div>
                    <div style={{fontSize:11,fontFamily:'var(--fM)',color:ok?'var(--green)':'var(--red)',fontWeight:600}}>{ok?'Verified':'Missing'}</div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Material"
        footer={<><Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button><Button variant="primary" onClick={handleCreate}>Register</Button></>}>
        <div className="fg2">
          <div className="fg fg-full"><label className="fg-label">Material Grade</label><input className="fc" value={form.grade} onChange={e => setForm({...form,grade:e.target.value})} placeholder="e.g. ASTM A516 Gr.70"/></div>
          <div className="fg"><label className="fg-label">Heat Number</label><input className="fc" value={form.heat_number} onChange={e => setForm({...form,heat_number:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Certificate Ref.</label><input className="fc" value={form.certificate_ref} onChange={e => setForm({...form,certificate_ref:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Manufacturer</label><input className="fc" value={form.manufacturer} onChange={e => setForm({...form,manufacturer:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Supplier</label><input className="fc" value={form.supplier} onChange={e => setForm({...form,supplier:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Received Date</label><input className="fc" type="date" value={form.received_date} onChange={e => setForm({...form,received_date:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Dimensions</label><input className="fc" value={form.dimensions} onChange={e => setForm({...form,dimensions:e.target.value})} placeholder="e.g. 25mm × 2400mm × 6000mm"/></div>
        </div>
      </Modal>
    </div>
  );
};

// ── DOCUMENTS PAGE ────────────────────────────────────────────────────────────
export const DocumentsPage = () => {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filesDoc, setFilesDoc] = useState(null); // doc currently shown in the attachments modal
  const [form, setForm] = useState({ doc_number:'', title:'', doc_type:'WPS', project_id:'', revision:'Rev 0', author_name:'' });

  const load = () => Promise.all([getDocuments(), getProjects()]).then(([d,p]) => { setDocs(d.data.data||[]); setProjects(p.data.data||[]); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try { await createDocument(form); toast.success('Document registered'); setShowModal(false); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleApprove = async (id, num) => {
    try { await approveDocument(id); toast.success(`${num} approved`); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <SectionHeader title="Document Control Register" subtitle="Version-locked. Previous revisions superseded, never overwritten."
        actions={<Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ Register Document</Button>}
      />
      <Alert type="info" className="mb4">ℹ Documents are locked upon approval. Any change requires a new revision. Superseded revisions remain accessible for traceability. Attached files are compressed automatically on upload and restored on download.</Alert>
      <Card>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Doc Number</th><th>Title</th><th>Type</th><th>Project</th><th>Rev</th><th>Author</th><th>Approved By</th><th>Date</th><th>Status</th><th>Files</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={11} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : docs.map(d => (
                <tr key={d.id}>
                  <td><Tag>{d.doc_number}</Tag></td>
                  <td style={{fontWeight:500,maxWidth:200,fontSize:12.5}}>{d.title}</td>
                  <td><span className="badge b-grey" style={{fontSize:9}}>{d.doc_type}</span></td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{d.project_id?.slice(0,8)}…</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{d.revision}</td>
                  <td style={{fontSize:12.5}}>{d.author_name}</td>
                  <td style={{fontSize:12,color:d.approved_by_name?'var(--green)':'var(--text-muted)'}}>{d.approved_by_name||'— Pending'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{d.created_at?.split('T')[0]}</td>
                  <td><Badge label={d.status} /></td>
                  <td><Button size="xs" variant="ghost" onClick={() => setFilesDoc(d)}>📎 Files</Button></td>
                  <td>
                    {d.status === 'Under Review' && <Button size="xs" variant="primary" onClick={() => handleApprove(d.id, d.doc_number)}>Approve</Button>}
                    {d.status === 'Draft' && <Button size="xs" variant="ghost" onClick={() => handleApprove(d.id, d.doc_number)}>Submit</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Document"
        footer={<><Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button><Button variant="primary" onClick={handleCreate}>Register</Button></>}>
        <div className="fg2">
          <div className="fg fg-full"><label className="fg-label">Document Title</label><input className="fc" value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></div>
          <div className="fg"><label className="fg-label">Document Number</label><input className="fc" value={form.doc_number} onChange={e => setForm({...form,doc_number:e.target.value})} placeholder="e.g. WPS-AGIP-016"/></div>
          <div className="fg"><label className="fg-label">Type</label>
            <select className="fc" value={form.doc_type} onChange={e => setForm({...form,doc_type:e.target.value})}>
              {['WPS','PQR','ITP','Quality Plan','NDT Procedure','Coating Procedure','Inspection Report','Certificate','Datasheet','Drawing','Manual','Other'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Project</label>
            <select className="fc" value={form.project_id} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Revision</label>
            <select className="fc" value={form.revision} onChange={e => setForm({...form,revision:e.target.value})}>
              {['Rev 0','Rev 1','Rev 2','Rev 3','Rev 4'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Author</label><input className="fc" value={form.author_name} onChange={e => setForm({...form,author_name:e.target.value})}/></div>
        </div>
      </Modal>
      <Modal open={!!filesDoc} onClose={() => setFilesDoc(null)} title={filesDoc ? `Files — ${filesDoc.doc_number}` : ''}>
        {filesDoc && <AttachmentPanel entityType="document" entityId={filesDoc.id} />}
      </Modal>
    </div>
  );
};

// ── QUALITY PLAN PAGE ──────────────────────────────────────────────────────────
export const QualityPlanPage = () => {
  const [plans, setPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filesPlan, setFilesPlan] = useState(null);
  const [form, setForm] = useState({
    project_id: '', plan_name: '', quality_objectives: '', scope_of_work: '',
    acceptance_criteria: '', applicable_standards: '', notes: '',
  });

  const load = () => Promise.all([getQualityPlans(), getProjects()])
    .then(([qp, p]) => { setPlans(qp.data.data || []); setProjects(p.data.data || []); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.plan_name.trim()) return toast.error('Plan name is required');
    if (!form.project_id) return toast.error('Please select a project');
    try {
      await createQualityPlan({
        ...form,
        applicable_standards: form.applicable_standards
          ? form.applicable_standards.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      });
      toast.success('Quality Plan created');
      setShowModal(false);
      setForm({ project_id:'', plan_name:'', quality_objectives:'', scope_of_work:'', acceptance_criteria:'', applicable_standards:'', notes:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleApprove = async (id, num) => {
    try { await approveQualityPlan(id); toast.success(`${num} approved`); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <SectionHeader title="Quality Plan Register" subtitle="Master quality control documents — objectives, scope, acceptance criteria, and approval workflow per project."
        actions={<Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ New Quality Plan</Button>}
      />
      <Alert type="info" className="mb4">ℹ Each revision increments the plan version and is recorded in the revision history. Approved plans become the project's governing quality document.</Alert>
      <Card>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Plan No.</th><th>Name</th><th>Project</th><th>Version</th><th>Prepared By</th><th>Approved By</th><th>Status</th><th>Files</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : plans.length === 0 ? <tr><td colSpan={9}><EmptyState title="No quality plans yet" subtitle="Create your first quality plan to define project quality objectives and acceptance criteria." /></td></tr>
              : plans.map(p => (
                <tr key={p.id}>
                  <td><Tag>{p.plan_number}</Tag></td>
                  <td style={{fontWeight:500,maxWidth:220,fontSize:12.5}}>{p.plan_name}</td>
                  <td style={{fontSize:12.5}}>{p.project?.project_number || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.version}</td>
                  <td style={{fontSize:12.5}}>{p.prepared_by_name || '—'}</td>
                  <td style={{fontSize:12,color:p.approved_by_name?'var(--green)':'var(--text-muted)'}}>{p.approved_by_name || '— Pending'}</td>
                  <td><Badge label={p.status} /></td>
                  <td><Button size="xs" variant="ghost" onClick={() => setFilesPlan(p)}>📎 Files</Button></td>
                  <td>
                    {p.status !== 'Approved' && <Button size="xs" variant="primary" onClick={() => handleApprove(p.id, p.plan_number)}>Approve</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!filesPlan} onClose={() => setFilesPlan(null)} title={filesPlan ? `Files — ${filesPlan.plan_number}` : ''}>
        {filesPlan && <AttachmentPanel entityType="quality_plan" entityId={filesPlan.id} />}
      </Modal>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Quality Plan"
        footer={<><Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button><Button variant="primary" onClick={handleCreate}>Create</Button></>}>
        <div className="fg2">
          <div className="fg fg-full"><label className="fg-label">Plan Name</label><input className="fc" value={form.plan_name} onChange={e => setForm({...form,plan_name:e.target.value})} placeholder="e.g. Project Quality Plan — Phase 1"/></div>
          <div className="fg"><label className="fg-label">Project</label>
            <select className="fc" value={form.project_id} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Applicable Standards</label><input className="fc" value={form.applicable_standards} onChange={e => setForm({...form,applicable_standards:e.target.value})} placeholder="e.g. ISO 9001, API 1104 (comma separated)"/></div>
          <div className="fg fg-full"><label className="fg-label">Quality Objectives</label><textarea className="fc" rows={2} value={form.quality_objectives} onChange={e => setForm({...form,quality_objectives:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Scope of Work</label><textarea className="fc" rows={2} value={form.scope_of_work} onChange={e => setForm({...form,scope_of_work:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Acceptance Criteria</label><textarea className="fc" rows={2} value={form.acceptance_criteria} onChange={e => setForm({...form,acceptance_criteria:e.target.value})}/></div>
          <div className="fg fg-full"><label className="fg-label">Notes</label><textarea className="fc" rows={2} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})}/></div>
        </div>
      </Modal>
    </div>
  );
};

// ── RESOURCES PAGE ────────────────────────────────────────────────────────────
export const ResourcesPage = () => {
  const [welders, setWelders] = useState([]);
  const [blasters, setBlasters] = useState([]);
  const [painters, setPainters] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showWelderModal, setShowWelderModal] = useState(false);
  const [showBlasterModal, setShowBlasterModal] = useState(false);
  const [showPainterModal, setShowPainterModal] = useState(false);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);
  const [editingWelder, setEditingWelder] = useState(null);   // null = creating new
  const [editingBlaster, setEditingBlaster] = useState(null);
  const [editingPainter, setEditingPainter] = useState(null);
  const [calibratingEquip, setCalibratingEquip] = useState(null);

  const emptyWelderForm = { 
    name:'', 
    stamp:'', 
    welder_id:'',
    process:'SMAW', 
    wpq_reference:'', 
    expiry_date:'', 
    status:'Active',
    // Process Qualification Test Parameters
    test_pipe_dia:'',
    test_plate_thk:'',
    test_position:'',
    test_filler_aws_no:'',
    test_filler_f_no:'',
    test_material_p_no:'',
    test_material_spec:'',
    // Qualified Parameter Range
    qual_process:'',
    qual_dia_thk:'',
    qual_f_no:'',
    qual_p_no:'',
    qual_position:'',
  };
  const emptyBlasterForm = {
    name:'',
    stamp:'',
    blaster_id:'',
    process:'Abrasive Blasting',
    qualification_reference:'',
    expiry_date:'',
    status:'Active',
    test_abrasive_type:'',
    test_surface_preparation:'',
    test_blast_profile:'',
    test_material_spec:'',
    qual_abrasive_type:'',
    qual_surface_preparation:'',
    qual_blast_profile:'',
    qual_material_spec:'',
  };
  const emptyPainterForm = {
    name:'',
    stamp:'',
    painter_id:'',
    process:'Coating Application',
    qualification_reference:'',
    expiry_date:'',
    status:'Active',
    test_coating_system:'',
    test_application_method:'',
    test_dft_range:'',
    test_material_spec:'',
    qual_coating_system:'',
    qual_application_method:'',
    qual_dft_range:'',
    qual_material_spec:'',
  };
  const emptyEquipForm  = { name:'', equipment_type:'', serial_number:'', calibration_due:'', calibration_cert:'' };
  const emptyCalForm    = { calibration_due:'', calibration_cert:'' };

  const [welderForm, setWelderForm] = useState(emptyWelderForm);
  const [extracting, setExtracting] = useState(false);
  const [extractNotes, setExtractNotes] = useState(null);
  const [blasterForm, setBlasterForm] = useState(emptyBlasterForm);
  const [painterForm, setPainterForm] = useState(emptyPainterForm);
  const [equipForm, setEquipForm]   = useState(emptyEquipForm);
  const [calForm, setCalForm]       = useState(emptyCalForm);

  const [workload, setWorkload] = useState([]);

  const load = useCallback(() => {
    Promise.all([getWelders(), getBlasters(), getPainters(), getEquipment(), getInspectorWorkload()])
      .then(([w, b, p, e, wl]) => { 
        setWelders(w.data.data||[]); 
        setBlasters(b.data.data||[]); 
        setPainters(p.data.data||[]); 
        setEquipment(e.data.data||[]); 
        setWorkload(wl.data.data||[]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const overloadedInspectors = workload.filter(i => i.overloaded);

  // ── WELDER HANDLERS ──────────────────────────────────────────────────────
  const openAddWelder = () => { setEditingWelder(null); setWelderForm(emptyWelderForm); setExtractNotes(null); setShowWelderModal(true); };

  const handleExtractWelderDoc = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setExtracting(true);
    setExtractNotes(null);
    try {
      const res = await aiExtractWelderDoc(file);
      const d = res.data.data;
      // Only overwrite fields the AI actually found — never blank out
      // something the inspector already typed with a null from the doc.
      setWelderForm(f => {
        const next = { ...f };
        Object.entries(d).forEach(([key, val]) => {
          if (key === 'extraction_notes') return;
          if (val !== null && val !== undefined && val !== '' && key in next) next[key] = String(val);
        });
        return next;
      });
      setExtractNotes(d.extraction_notes || null);
      toast.success('Document extracted — review fields below before saving.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extract document.');
    } finally {
      setExtracting(false);
    }
  };

  const openEditWelder = (w) => {
    setEditingWelder(w);
    setExtractNotes(null);
    setWelderForm({ 
      name: w.name, 
      stamp: w.stamp, 
      welder_id: w.welder_id || '',
      process: w.process || 'SMAW', 
      wpq_reference: w.wpq_reference || '', 
      expiry_date: w.expiry_date || '', 
      status: w.status,
      test_pipe_dia: w.test_pipe_dia || '',
      test_plate_thk: w.test_plate_thk || '',
      test_position: w.test_position || '',
      test_filler_aws_no: w.test_filler_aws_no || '',
      test_filler_f_no: w.test_filler_f_no || '',
      test_material_p_no: w.test_material_p_no || '',
      test_material_spec: w.test_material_spec || '',
      qual_process: w.qual_process || '',
      qual_dia_thk: w.qual_dia_thk || '',
      qual_f_no: w.qual_f_no || '',
      qual_p_no: w.qual_p_no || '',
      qual_position: w.qual_position || '',
    });
    setShowWelderModal(true);
  };

  const handleSaveWelder = async () => {
    if (!welderForm.name || !welderForm.stamp) { toast.error('Name and stamp are required.'); return; }
    try {
      if (editingWelder) {
        await updateWelder(editingWelder.id, welderForm);
        toast.success(`${welderForm.name} updated`);
      } else {
        await createWelder(welderForm);
        toast.success(`${welderForm.name} added to qualification register`);
      }
      setShowWelderModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save welder record.');
    }
  };

  // ── BLASTER HANDLERS ─────────────────────────────────────────────────────
  const openAddBlaster = () => { setEditingBlaster(null); setBlasterForm(emptyBlasterForm); setShowBlasterModal(true); };
  const openEditBlaster = (b) => {
    setEditingBlaster(b);
    setBlasterForm({
      name: b.name,
      stamp: b.stamp,
      blaster_id: b.blaster_id || '',
      process: b.process || 'Abrasive Blasting',
      qualification_reference: b.qualification_reference || '',
      expiry_date: b.expiry_date || '',
      status: b.status,
      test_abrasive_type: b.test_abrasive_type || '',
      test_surface_preparation: b.test_surface_preparation || '',
      test_blast_profile: b.test_blast_profile || '',
      test_material_spec: b.test_material_spec || '',
      qual_abrasive_type: b.qual_abrasive_type || '',
      qual_surface_preparation: b.qual_surface_preparation || '',
      qual_blast_profile: b.qual_blast_profile || '',
      qual_material_spec: b.qual_material_spec || '',
    });
    setShowBlasterModal(true);
  };

  const handleSaveBlaster = async () => {
    if (!blasterForm.name || !blasterForm.stamp) { toast.error('Name and stamp are required.'); return; }
    try {
      if (editingBlaster) {
        await updateBlaster(editingBlaster.id, blasterForm);
        toast.success(`${blasterForm.name} updated`);
      } else {
        await createBlaster(blasterForm);
        toast.success(`${blasterForm.name} added to qualification register`);
      }
      setShowBlasterModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save blaster record.');
    }
  };

  // ── PAINTER HANDLERS ─────────────────────────────────────────────────────
  const openAddPainter = () => { setEditingPainter(null); setPainterForm(emptyPainterForm); setShowPainterModal(true); };
  const openEditPainter = (p) => {
    setEditingPainter(p);
    setPainterForm({
      name: p.name,
      stamp: p.stamp,
      painter_id: p.painter_id || '',
      process: p.process || 'Coating Application',
      qualification_reference: p.qualification_reference || '',
      expiry_date: p.expiry_date || '',
      status: p.status,
      test_coating_system: p.test_coating_system || '',
      test_application_method: p.test_application_method || '',
      test_dft_range: p.test_dft_range || '',
      test_material_spec: p.test_material_spec || '',
      qual_coating_system: p.qual_coating_system || '',
      qual_application_method: p.qual_application_method || '',
      qual_dft_range: p.qual_dft_range || '',
      qual_material_spec: p.qual_material_spec || '',
    });
    setShowPainterModal(true);
  };

  const handleSavePainter = async () => {
    if (!painterForm.name || !painterForm.stamp) { toast.error('Name and stamp are required.'); return; }
    try {
      if (editingPainter) {
        await updatePainter(editingPainter.id, painterForm);
        toast.success(`${painterForm.name} updated`);
      } else {
        await createPainter(painterForm);
        toast.success(`${painterForm.name} added to qualification register`);
      }
      setShowPainterModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save painter record.');
    }
  };

  // ── EQUIPMENT HANDLERS ───────────────────────────────────────────────────
  const openAddEquipment = () => { setEquipForm(emptyEquipForm); setShowEquipModal(true); };

  const handleSaveEquipment = async () => {
    if (!equipForm.name || !equipForm.calibration_due) { toast.error('Name and calibration due date are required.'); return; }
    try {
      await createEquipment(equipForm);
      toast.success(`${equipForm.name} added to calibration register`);
      setShowEquipModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add equipment.');
    }
  };

  const openCalibrate = (e) => {
    setCalibratingEquip(e);
    setCalForm({ calibration_due: '', calibration_cert: e.calibration_cert || '' });
    setShowCalModal(true);
  };

  const handleRecordCalibration = async () => {
    if (!calForm.calibration_due) { toast.error('Next calibration due date is required.'); return; }
    try {
      await calibrateEquipment(calibratingEquip.id, calForm);
      toast.success(`${calibratingEquip.name} calibration recorded`);
      setShowCalModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record calibration.');
    }
  };

  return (
    <div>
      <SectionHeader title="Resources & Equipment" subtitle="Inspector capacity, equipment calibration, and environmental control" />
      <div className="g2 mb4">
        <Card>
          <CardHeader title="Inspector Workload Capacity" actions={<Badge label="Live" />} />
          <CardBody style={{padding:'10px 18px'}}>
            {overloadedInspectors.length > 0 && (
              <Alert type="warn" className="mb4" style={{fontSize:11.5}}>
                ⚠ {overloadedInspectors.map(i => `${i.name} at ${i.load}%`).join(', ')} — risk of quality degradation. Reassign non-critical inspections.
              </Alert>
            )}
            {loading ? <div className="spinner" /> : workload.length === 0 ? (
              <EmptyState title="No inspectors with workload data" subtitle="Active QC/NDT/Welding inspectors will appear here once inspections are assigned to them." />
            ) : workload.map(i => (
              <div key={i.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--fM)',fontSize:11,fontWeight:700,background:i.overloaded?'var(--red-bg)':'var(--signal-dim)',color:i.overloaded?'var(--red)':'var(--signal-dk)',border:`1.5px solid ${i.overloaded?'var(--red)':'var(--signal)'}`}}>{i.init}</div>
                <div style={{flex:1}}>
                  <div className="flex jb items-c mb2">
                    <div><div style={{fontSize:13,fontWeight:600}}>{i.name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{i.roleLabel}</div></div>
                    <div style={{fontFamily:'var(--fM)',fontSize:12,fontWeight:700,color:i.load>=90?'var(--red)':i.load>=75?'var(--amber)':'var(--green)'}}>{i.load}%</div>
                  </div>
                  <ProgressBar value={i.load} color={i.load>=90?'var(--red)':i.load>=75?'var(--amber)':'var(--green)'} />
                  <div style={{fontSize:10,color:i.overloaded?'var(--red)':'var(--text-muted)',fontFamily:'var(--fM)',marginTop:3}}>{i.active} active / {i.max} max</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Equipment Calibration Register"
            actions={<Button variant="primary" size="sm" onClick={openAddEquipment}>+ Add Equipment</Button>}
          />
          <CardBody style={{padding:'10px 18px'}}>
            {equipment.filter(e => e.status === 'Overdue').length > 0 && (
              <Alert type="danger" className="mb4" style={{fontSize:11.5}}>⛔ {equipment.filter(e=>e.status==='Overdue').length} equipment item(s) calibration OVERDUE. Quarantined from field use.</Alert>
            )}
            {loading ? <div className="spinner" /> : equipment.length === 0 ? (
              <EmptyState title="No equipment registered" subtitle="Add your first instrument to start tracking calibration." />
            ) : equipment.map(e => (
              <div key={e.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div className="flex jb items-c mb2">
                  <div><div style={{fontSize:13,fontWeight:600}}>{e.name}</div><div style={{fontFamily:'var(--fM)',fontSize:10,color:'var(--text-muted)'}}>{e.serial_number} · {e.equipment_type}</div></div>
                  <div className="flex items-c gap2">
                    <Badge label={e.status} />
                    <Button variant="ghost" size="sm" onClick={() => openCalibrate(e)}>Calibrate</Button>
                  </div>
                </div>
                <div className="flex jb" style={{fontSize:10.5,color:'var(--text-muted)',fontFamily:'var(--fM)'}}>
                  <span>Cal due: <span style={{color:e.status==='Overdue'?'var(--red)':e.status==='Due Soon'?'var(--amber)':'var(--green)',fontWeight:600}}>{e.calibration_due}</span></span>
                  <span>Utilisation: {e.utilisation_pct}%</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Welder Qualification Register"
          actions={<Button variant="primary" size="sm" onClick={openAddWelder}>+ Add Welder</Button>}
        />
        <div className="tbl-wrap" style={{overflowX:'auto'}}>
          <table style={{minWidth:'1800px'}}>
            <thead><tr><th>Stamp</th><th>Welder Id</th><th>Name</th><th>Process</th><th>WPQ Ref</th><th>Expiry</th><th>Welds</th><th>Repair Rate</th><th>Test Pipe Dia(mm)</th><th>Test Plate Thk(mm)</th><th>Test Position</th><th>Test Filler AWS No</th><th>Test Filler F No</th><th>Test Material P No</th><th>Test Material Spec</th><th>Qual Process</th><th>Qual Dia/Thk(mm)</th><th>Qual F No</th><th>Qual P No</th><th>Qual Position</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={21} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : welders.length === 0 ? <tr><td colSpan={21}><EmptyState title="No welders registered" subtitle="Add your first welder to start tracking qualifications." /></td></tr>
              : welders.map(w => (
                <tr key={w.id}>
                  <td><Tag>{w.stamp}</Tag></td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.welder_id || '—'}</td>
                  <td style={{fontWeight:500}}>{w.name}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{w.process}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{w.wpq_reference}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12,color:w.expiry_alert==='expired'?'var(--red)':w.expiry_alert==='warning'?'var(--amber)':'inherit'}}>{w.expiry_date}</td>
                  <td style={{textAlign:'center'}}>{w.total_welds}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12,color:parseFloat(w.repair_rate)>2.5?'var(--red)':parseFloat(w.repair_rate)>1.5?'var(--amber)':'var(--green)',fontWeight:600}}>{w.repair_rate}%</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_pipe_dia || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_plate_thk || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_position || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_filler_aws_no || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_filler_f_no || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_material_p_no || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.test_material_spec || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.qual_process || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.qual_dia_thk || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.qual_f_no || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.qual_p_no || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{w.qual_position || '—'}</td>
                  <td><Badge label={w.status} /></td>
                  <td><Button variant="ghost" size="sm" onClick={() => openEditWelder(w)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt4">
        <CardHeader
          title="Blaster Qualification Register"
          actions={<Button variant="primary" size="sm" onClick={openAddBlaster}>+ Add Blaster</Button>}
        />
        <div className="tbl-wrap" style={{overflowX:'auto'}}>
          <table style={{minWidth:'1400px'}}>
            <thead><tr><th>Stamp</th><th>Blaster Id</th><th>Name</th><th>Process</th><th>Qual Ref</th><th>Expiry</th><th>Test Abrasive Type</th><th>Test Surface Prep</th><th>Test Blast Profile</th><th>Test Material Spec</th><th>Qual Abrasive Type</th><th>Qual Surface Prep</th><th>Qual Blast Profile</th><th>Qual Material Spec</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={16} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : blasters.length === 0 ? <tr><td colSpan={16}><EmptyState title="No blasters registered" subtitle="Add your first blaster to start tracking qualifications." /></td></tr>
              : blasters.map(b => (
                <tr key={b.id}>
                  <td><Tag>{b.stamp}</Tag></td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.blaster_id || '—'}</td>
                  <td style={{fontWeight:500}}>{b.name}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{b.process}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{b.qualification_reference}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{b.expiry_date}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.test_abrasive_type || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.test_surface_preparation || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.test_blast_profile || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.test_material_spec || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.qual_abrasive_type || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.qual_surface_preparation || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.qual_blast_profile || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{b.qual_material_spec || '—'}</td>
                  <td><Badge label={b.status} /></td>
                  <td><Button variant="ghost" size="sm" onClick={() => openEditBlaster(b)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt4">
        <CardHeader
          title="Painter Qualification Register"
          actions={<Button variant="primary" size="sm" onClick={openAddPainter}>+ Add Painter</Button>}
        />
        <div className="tbl-wrap" style={{overflowX:'auto'}}>
          <table style={{minWidth:'1400px'}}>
            <thead><tr><th>Stamp</th><th>Painter Id</th><th>Name</th><th>Process</th><th>Qual Ref</th><th>Expiry</th><th>Test Coating System</th><th>Test App Method</th><th>Test DFT Range</th><th>Test Material Spec</th><th>Qual Coating System</th><th>Qual App Method</th><th>Qual DFT Range</th><th>Qual Material Spec</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={15} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : painters.length === 0 ? <tr><td colSpan={15}><EmptyState title="No painters registered" subtitle="Add your first painter to start tracking qualifications." /></td></tr>
              : painters.map(p => (
                <tr key={p.id}>
                  <td><Tag>{p.stamp}</Tag></td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.painter_id || '—'}</td>
                  <td style={{fontWeight:500}}>{p.name}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{p.process}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{p.qualification_reference}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:12}}>{p.expiry_date}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.test_coating_system || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.test_application_method || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.test_dft_range || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.test_material_spec || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.qual_coating_system || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.qual_application_method || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.qual_dft_range || '—'}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:11}}>{p.qual_material_spec || '—'}</td>
                  <td><Badge label={p.status} /></td>
                  <td><Button variant="ghost" size="sm" onClick={() => openEditPainter(p)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── ADD / EDIT WELDER MODAL ────────────────────────────────────── */}
      <Modal
        open={showWelderModal}
        onClose={() => { setShowWelderModal(false); setExtractNotes(null); }}
        title={editingWelder ? `Edit Welder — ${editingWelder.name}` : 'Add Welder'}
        subtitle={editingWelder ? 'Update qualification, status, or re-qualify with a new WPQ reference.' : 'Register a new welder into the qualification register.'}
        footer={<>
          <Button variant="ghost" onClick={() => { setShowWelderModal(false); setExtractNotes(null); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveWelder}>{editingWelder ? 'Save changes' : 'Add welder'}</Button>
        </>}
        size={600}
      >
        <div style={{marginBottom:18,padding:'12px 14px',background:'var(--surface)',borderRadius:'var(--r)',border:'1px dashed var(--border)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
            <div>
              <div style={{fontSize:12.5,fontWeight:600}}>✨ Extract from WPQ/PQR document</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>Upload a scan or photo and AI will fill in the fields below.</div>
            </div>
            <label className="btn btn-ghost btn-sm" style={{cursor:extracting?'default':'pointer',opacity:extracting?0.6:1}}>
              {extracting ? 'Reading…' : 'Upload Document'}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleExtractWelderDoc} disabled={extracting} style={{display:'none'}} />
            </label>
          </div>
          {extractNotes && (
            <div style={{marginTop:8,fontSize:11,color:'var(--amber)'}}>⚠ {extractNotes}</div>
          )}
        </div>
        <div className="fg2">
          <div className="fg"><label className="fg-label">Full Name</label>
            <input className="fc" value={welderForm.name} onChange={e => setWelderForm({...welderForm, name: e.target.value})} placeholder="e.g. Emeka Okafor" />
          </div>
          <div className="fg"><label className="fg-label">Stamp / Symbol</label>
            <input className="fc" value={welderForm.stamp} onChange={e => setWelderForm({...welderForm, stamp: e.target.value})} placeholder="e.g. EO1" disabled={!!editingWelder} />
          </div>
          <div className="fg"><label className="fg-label">Welder Id</label>
            <input className="fc" value={welderForm.welder_id} onChange={e => setWelderForm({...welderForm, welder_id: e.target.value})} placeholder="e.g. W-001" />
          </div>
          <div className="fg"><label className="fg-label">Process</label>
            <select className="fc" value={welderForm.process} onChange={e => setWelderForm({...welderForm, process: e.target.value})}>
              {['SMAW','GTAW','GMAW','FCAW','SAW','PAW'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">WPQ Reference</label>
            <input className="fc" value={welderForm.wpq_reference} onChange={e => setWelderForm({...welderForm, wpq_reference: e.target.value})} placeholder="e.g. WPQ-2026-014" />
          </div>
          <div className="fg"><label className="fg-label">Expiry Date</label>
            <input className="fc" type="date" value={welderForm.expiry_date} onChange={e => setWelderForm({...welderForm, expiry_date: e.target.value})} />
          </div>
          <div className="fg"><label className="fg-label">Status</label>
            <select className="fc" value={welderForm.status} onChange={e => setWelderForm({...welderForm, status: e.target.value})}>
              {['Active','Expired','Suspended','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Process Qualification Test Parameters</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Test Pipe Dia (mm)</label>
              <input className="fc" value={welderForm.test_pipe_dia} onChange={e => setWelderForm({...welderForm, test_pipe_dia: e.target.value})} placeholder="e.g. 50.8" />
            </div>
            <div className="fg"><label className="fg-label">Test Plate Thk (mm)</label>
              <input className="fc" value={welderForm.test_plate_thk} onChange={e => setWelderForm({...welderForm, test_plate_thk: e.target.value})} placeholder="e.g. 12.7" />
            </div>
            <div className="fg"><label className="fg-label">Test Position</label>
              <input className="fc" value={welderForm.test_position} onChange={e => setWelderForm({...welderForm, test_position: e.target.value})} placeholder="e.g. 2G, 3G, 6G" />
            </div>
            <div className="fg"><label className="fg-label">Test Filler AWS No</label>
              <input className="fc" value={welderForm.test_filler_aws_no} onChange={e => setWelderForm({...welderForm, test_filler_aws_no: e.target.value})} placeholder="e.g. E7018" />
            </div>
            <div className="fg"><label className="fg-label">Test Filler F No</label>
              <input className="fc" value={welderForm.test_filler_f_no} onChange={e => setWelderForm({...welderForm, test_filler_f_no: e.target.value})} placeholder="e.g. 4" />
            </div>
            <div className="fg"><label className="fg-label">Test Material P No</label>
              <input className="fc" value={welderForm.test_material_p_no} onChange={e => setWelderForm({...welderForm, test_material_p_no: e.target.value})} placeholder="e.g. 1" />
            </div>
            <div className="fg"><label className="fg-label">Test Material Spec</label>
              <input className="fc" value={welderForm.test_material_spec} onChange={e => setWelderForm({...welderForm, test_material_spec: e.target.value})} placeholder="e.g. A36" />
            </div>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Qualified Parameter Range</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Qual Process</label>
              <input className="fc" value={welderForm.qual_process} onChange={e => setWelderForm({...welderForm, qual_process: e.target.value})} placeholder="e.g. SMAW" />
            </div>
            <div className="fg"><label className="fg-label">Qual Dia/Thk (mm)</label>
              <input className="fc" value={welderForm.qual_dia_thk} onChange={e => setWelderForm({...welderForm, qual_dia_thk: e.target.value})} placeholder="e.g. 3.2-50.8" />
            </div>
            <div className="fg"><label className="fg-label">Qual F No</label>
              <input className="fc" value={welderForm.qual_f_no} onChange={e => setWelderForm({...welderForm, qual_f_no: e.target.value})} placeholder="e.g. 4" />
            </div>
            <div className="fg"><label className="fg-label">Qual P No</label>
              <input className="fc" value={welderForm.qual_p_no} onChange={e => setWelderForm({...welderForm, qual_p_no: e.target.value})} placeholder="e.g. 1" />
            </div>
            <div className="fg"><label className="fg-label">Qual Position</label>
              <input className="fc" value={welderForm.qual_position} onChange={e => setWelderForm({...welderForm, qual_position: e.target.value})} placeholder="e.g. 1G-6G" />
            </div>
          </div>
        </div>

        {editingWelder && (
          <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>
            Tip: entering a new WPQ Reference here is logged as a re-qualification in the audit trail.
          </p>
        )}
      </Modal>

      {/* ── ADD / EDIT BLASTER MODAL ────────────────────────────────────── */}
      <Modal
        open={showBlasterModal}
        onClose={() => setShowBlasterModal(false)}
        title={editingBlaster ? `Edit Blaster — ${editingBlaster.name}` : 'Add Blaster'}
        subtitle={editingBlaster ? 'Update qualification, status, or re-qualify with a new reference.' : 'Register a new blaster into the qualification register.'}
        footer={<>
          <Button variant="ghost" onClick={() => setShowBlasterModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveBlaster}>{editingBlaster ? 'Save changes' : 'Add blaster'}</Button>
        </>}
        size={600}
      >
        <div className="fg2">
          <div className="fg"><label className="fg-label">Full Name</label>
            <input className="fc" value={blasterForm.name} onChange={e => setBlasterForm({...blasterForm, name: e.target.value})} placeholder="e.g. John Doe" />
          </div>
          <div className="fg"><label className="fg-label">Stamp / Symbol</label>
            <input className="fc" value={blasterForm.stamp} onChange={e => setBlasterForm({...blasterForm, stamp: e.target.value})} placeholder="e.g. B01" disabled={!!editingBlaster} />
          </div>
          <div className="fg"><label className="fg-label">Blaster Id</label>
            <input className="fc" value={blasterForm.blaster_id} onChange={e => setBlasterForm({...blasterForm, blaster_id: e.target.value})} placeholder="e.g. BL-001" />
          </div>
          <div className="fg"><label className="fg-label">Process</label>
            <select className="fc" value={blasterForm.process} onChange={e => setBlasterForm({...blasterForm, process: e.target.value})}>
              {['Abrasive Blasting','Water Blasting','Sand Blasting'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Qualification Reference</label>
            <input className="fc" value={blasterForm.qualification_reference} onChange={e => setBlasterForm({...blasterForm, qualification_reference: e.target.value})} placeholder="e.g. BQ-2026-001" />
          </div>
          <div className="fg"><label className="fg-label">Expiry Date</label>
            <input className="fc" type="date" value={blasterForm.expiry_date} onChange={e => setBlasterForm({...blasterForm, expiry_date: e.target.value})} />
          </div>
          <div className="fg"><label className="fg-label">Status</label>
            <select className="fc" value={blasterForm.status} onChange={e => setBlasterForm({...blasterForm, status: e.target.value})}>
              {['Active','Expired','Suspended','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Process Qualification Test Parameters</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Test Abrasive Type</label>
              <input className="fc" value={blasterForm.test_abrasive_type} onChange={e => setBlasterForm({...blasterForm, test_abrasive_type: e.target.value})} placeholder="e.g. Steel Grit" />
            </div>
            <div className="fg"><label className="fg-label">Test Surface Prep</label>
              <input className="fc" value={blasterForm.test_surface_preparation} onChange={e => setBlasterForm({...blasterForm, test_surface_preparation: e.target.value})} placeholder="e.g. Sa 2.5" />
            </div>
            <div className="fg"><label className="fg-label">Test Blast Profile</label>
              <input className="fc" value={blasterForm.test_blast_profile} onChange={e => setBlasterForm({...blasterForm, test_blast_profile: e.target.value})} placeholder="e.g. 50-75 microns" />
            </div>
            <div className="fg"><label className="fg-label">Test Material Spec</label>
              <input className="fc" value={blasterForm.test_material_spec} onChange={e => setBlasterForm({...blasterForm, test_material_spec: e.target.value})} placeholder="e.g. A36" />
            </div>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Qualified Parameter Range</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Qual Abrasive Type</label>
              <input className="fc" value={blasterForm.qual_abrasive_type} onChange={e => setBlasterForm({...blasterForm, qual_abrasive_type: e.target.value})} placeholder="e.g. Steel Grit" />
            </div>
            <div className="fg"><label className="fg-label">Qual Surface Prep</label>
              <input className="fc" value={blasterForm.qual_surface_preparation} onChange={e => setBlasterForm({...blasterForm, qual_surface_preparation: e.target.value})} placeholder="e.g. Sa 2.5" />
            </div>
            <div className="fg"><label className="fg-label">Qual Blast Profile</label>
              <input className="fc" value={blasterForm.qual_blast_profile} onChange={e => setBlasterForm({...blasterForm, qual_blast_profile: e.target.value})} placeholder="e.g. 50-100 microns" />
            </div>
            <div className="fg"><label className="fg-label">Qual Material Spec</label>
              <input className="fc" value={blasterForm.qual_material_spec} onChange={e => setBlasterForm({...blasterForm, qual_material_spec: e.target.value})} placeholder="e.g. Carbon Steel" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── ADD / EDIT PAINTER MODAL ──────────────────────────────────────── */}
      <Modal
        open={showPainterModal}
        onClose={() => setShowPainterModal(false)}
        title={editingPainter ? `Edit Painter — ${editingPainter.name}` : 'Add Painter'}
        subtitle={editingPainter ? 'Update qualification, status, or re-qualify with a new reference.' : 'Register a new painter into the qualification register.'}
        footer={<>
          <Button variant="ghost" onClick={() => setShowPainterModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSavePainter}>{editingPainter ? 'Save changes' : 'Add painter'}</Button>
        </>}
        size={600}
      >
        <div className="fg2">
          <div className="fg"><label className="fg-label">Full Name</label>
            <input className="fc" value={painterForm.name} onChange={e => setPainterForm({...painterForm, name: e.target.value})} placeholder="e.g. Jane Smith" />
          </div>
          <div className="fg"><label className="fg-label">Stamp / Symbol</label>
            <input className="fc" value={painterForm.stamp} onChange={e => setPainterForm({...painterForm, stamp: e.target.value})} placeholder="e.g. P01" disabled={!!editingPainter} />
          </div>
          <div className="fg"><label className="fg-label">Painter Id</label>
            <input className="fc" value={painterForm.painter_id} onChange={e => setPainterForm({...painterForm, painter_id: e.target.value})} placeholder="e.g. PT-001" />
          </div>
          <div className="fg"><label className="fg-label">Process</label>
            <select className="fc" value={painterForm.process} onChange={e => setPainterForm({...painterForm, process: e.target.value})}>
              {['Coating Application','Spray Painting','Brush Painting'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fg-label">Qualification Reference</label>
            <input className="fc" value={painterForm.qualification_reference} onChange={e => setPainterForm({...painterForm, qualification_reference: e.target.value})} placeholder="e.g. PQ-2026-001" />
          </div>
          <div className="fg"><label className="fg-label">Expiry Date</label>
            <input className="fc" type="date" value={painterForm.expiry_date} onChange={e => setPainterForm({...painterForm, expiry_date: e.target.value})} />
          </div>
          <div className="fg"><label className="fg-label">Status</label>
            <select className="fc" value={painterForm.status} onChange={e => setPainterForm({...painterForm, status: e.target.value})}>
              {['Active','Expired','Suspended','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Process Qualification Test Parameters</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Test Coating System</label>
              <input className="fc" value={painterForm.test_coating_system} onChange={e => setPainterForm({...painterForm, test_coating_system: e.target.value})} placeholder="e.g. Epoxy" />
            </div>
            <div className="fg"><label className="fg-label">Test Application Method</label>
              <input className="fc" value={painterForm.test_application_method} onChange={e => setPainterForm({...painterForm, test_application_method: e.target.value})} placeholder="e.g. Spray" />
            </div>
            <div className="fg"><label className="fg-label">Test DFT Range</label>
              <input className="fc" value={painterForm.test_dft_range} onChange={e => setPainterForm({...painterForm, test_dft_range: e.target.value})} placeholder="e.g. 250-300 microns" />
            </div>
            <div className="fg"><label className="fg-label">Test Material Spec</label>
              <input className="fc" value={painterForm.test_material_spec} onChange={e => setPainterForm({...painterForm, test_material_spec: e.target.value})} placeholder="e.g. A36" />
            </div>
          </div>
        </div>

        <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'var(--text-sub)'}}>Qualified Parameter Range</div>
          <div className="fg2">
            <div className="fg"><label className="fg-label">Qual Coating System</label>
              <input className="fc" value={painterForm.qual_coating_system} onChange={e => setPainterForm({...painterForm, qual_coating_system: e.target.value})} placeholder="e.g. Epoxy/Polyurethane" />
            </div>
            <div className="fg"><label className="fg-label">Qual Application Method</label>
              <input className="fc" value={painterForm.qual_application_method} onChange={e => setPainterForm({...painterForm, qual_application_method: e.target.value})} placeholder="e.g. Spray/Brush" />
            </div>
            <div className="fg"><label className="fg-label">Qual DFT Range</label>
              <input className="fc" value={painterForm.qual_dft_range} onChange={e => setPainterForm({...painterForm, qual_dft_range: e.target.value})} placeholder="e.g. 200-350 microns" />
            </div>
            <div className="fg"><label className="fg-label">Qual Material Spec</label>
              <input className="fc" value={painterForm.qual_material_spec} onChange={e => setPainterForm({...painterForm, qual_material_spec: e.target.value})} placeholder="e.g. Carbon Steel" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ── ADD EQUIPMENT MODAL ────────────────────────────────────────── */}
      <Modal
        open={showEquipModal}
        onClose={() => setShowEquipModal(false)}
        title="Add Equipment"
        subtitle="Register a new instrument into the calibration register."
        footer={<>
          <Button variant="ghost" onClick={() => setShowEquipModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveEquipment}>Add equipment</Button>
        </>}
      >
        <div className="fg2">
          <div className="fg fg-full"><label className="fg-label">Equipment Name</label>
            <input className="fc" value={equipForm.name} onChange={e => setEquipForm({...equipForm, name: e.target.value})} placeholder="e.g. Ultrasonic Thickness Gauge" />
          </div>
          <div className="fg"><label className="fg-label">Type</label>
            <input className="fc" value={equipForm.equipment_type} onChange={e => setEquipForm({...equipForm, equipment_type: e.target.value})} placeholder="e.g. UT Gauge" />
          </div>
          <div className="fg"><label className="fg-label">Serial Number</label>
            <input className="fc" value={equipForm.serial_number} onChange={e => setEquipForm({...equipForm, serial_number: e.target.value})} placeholder="e.g. SN-44218" />
          </div>
          <div className="fg"><label className="fg-label">Calibration Due Date</label>
            <input className="fc" type="date" value={equipForm.calibration_due} onChange={e => setEquipForm({...equipForm, calibration_due: e.target.value})} />
          </div>
          <div className="fg"><label className="fg-label">Calibration Cert Ref</label>
            <input className="fc" value={equipForm.calibration_cert} onChange={e => setEquipForm({...equipForm, calibration_cert: e.target.value})} placeholder="e.g. CAL-2026-0091" />
          </div>
        </div>
      </Modal>

      {/* ── RECORD CALIBRATION MODAL ───────────────────────────────────── */}
      <Modal
        open={showCalModal}
        onClose={() => setShowCalModal(false)}
        title={calibratingEquip ? `Record Calibration — ${calibratingEquip.name}` : 'Record Calibration'}
        subtitle="Sets last calibration to today and advances the next due date."
        footer={<>
          <Button variant="ghost" onClick={() => setShowCalModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleRecordCalibration}>Record calibration</Button>
        </>}
      >
        <div className="fg2">
          <div className="fg"><label className="fg-label">Next Calibration Due</label>
            <input className="fc" type="date" value={calForm.calibration_due} onChange={e => setCalForm({...calForm, calibration_due: e.target.value})} />
          </div>
          <div className="fg"><label className="fg-label">Calibration Cert Ref</label>
            <input className="fc" value={calForm.calibration_cert} onChange={e => setCalForm({...calForm, calibration_cert: e.target.value})} placeholder="e.g. CAL-2026-0091" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── USERS PAGE ────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  system_admin:          'System Admin',
  quality_manager:       'Quality Manager',
  qa_engineer:           'QA Engineer',
  qc_inspector:          'QC Inspector',
  welding_inspector:     'Welding Inspector',
  ndt_technician:        'NDT Technician',
  document_controller:   'Document Controller',
  client_representative: 'Client Representative',
};

const ROLE_BADGE = {
  system_admin:          'b-iron',
  quality_manager:       'b-signal',
  qa_engineer:           'b-blue',
  qc_inspector:          'b-green',
  welding_inspector:     'b-amber',
  ndt_technician:        'b-blue',
  document_controller:   'b-grey',
  client_representative: 'b-green',
};

const PERMISSIONS_MATRIX = [
  { label: 'Create Project',      perms: ['system_admin','quality_manager'] },
  { label: 'Submit Inspection',   perms: ['system_admin','quality_manager','qa_engineer','qc_inspector','welding_inspector','ndt_technician'] },
  { label: 'Approve Inspection',  perms: ['system_admin','quality_manager','qa_engineer','client_representative'] },
  { label: 'Raise NCR',           perms: ['system_admin','quality_manager','qa_engineer','qc_inspector','welding_inspector','ndt_technician','client_representative'] },
  { label: 'Close NCR',           perms: ['system_admin','quality_manager','qa_engineer'] },
  { label: 'Sign Off ITP',        perms: ['system_admin','quality_manager','qa_engineer'] },
  { label: 'Register Document',   perms: ['system_admin','quality_manager','qa_engineer','qc_inspector','welding_inspector','ndt_technician','document_controller'] },
  { label: 'Approve Document',    perms: ['system_admin','quality_manager','client_representative'] },
  { label: 'Raise Punch Item',    perms: ['system_admin','quality_manager','qa_engineer','qc_inspector','welding_inspector','ndt_technician'] },
  { label: 'Accept Punch Closure',perms: ['system_admin','quality_manager','client_representative'] },
  { label: 'View Audit Trail',    perms: ['system_admin','quality_manager','qa_engineer','client_representative'] },
  { label: 'Manage Users',        perms: ['system_admin'] },
];

const ALL_ROLES = Object.keys(ROLE_LABELS);

export const UsersPage = () => {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'permissions'
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'qc_inspector' });
  const [submitting, setSubmitting] = useState(false);
  const [capacityDrafts, setCapacityDrafts] = useState({}); // { [userId]: string }

  const load = () => {
    getUsers()
      .then(r => setUsers(r.data.data || []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id, name, currentlyActive) => {
    try {
      await toggleUser(id);
      toast.success(`${name} ${currentlyActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleSaveCapacity = async (id, name) => {
    const raw = capacityDrafts[id];
    const value = raw === '' || raw === undefined ? null : parseInt(raw, 10);
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      toast.error('Capacity must be a positive whole number, or blank to use the role default.');
      return;
    }
    try {
      await updateUserCapacity(id, { max_active_inspections: value });
      toast.success(`${name} capacity updated`);
      setCapacityDrafts(d => { const next = { ...d }; delete next[id]; return next; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update capacity');
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Use the register endpoint
      const { default: api } = await import('../utils/api');
      await api.post('/auth/register', form);
      toast.success(`${form.name} registered successfully`);
      setShowModal(false);
      setForm({ name:'', email:'', password:'', role:'qc_inspector' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const activeUsers   = users.filter(u => u.is_active);
  const inactiveUsers = users.filter(u => !u.is_active);

  return (
    <div>
      <SectionHeader
        title="Users & Roles"
        subtitle="Role-based access control, user management, and permissions matrix"
        actions={
          <div className="flex gap2">
            <Button
              variant={activeTab === 'users' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('users')}
            >
              👤 Users ({users.length})
            </Button>
            <Button
              variant={activeTab === 'permissions' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('permissions')}
            >
              🔐 Permissions Matrix
            </Button>
            <Button variant="dark" size="sm" onClick={() => setShowModal(true)}>
              + Add User
            </Button>
          </div>
        }
      />

      {activeTab === 'users' && (
        <>
          {/* Stats strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
            {[
              { label:'Total Users',    value: users.length,        color:'var(--signal)' },
              { label:'Active',         value: activeUsers.length,  color:'var(--green)'  },
              { label:'Inactive',       value: inactiveUsers.length,color:'var(--amber)'  },
              { label:'Roles In Use',   value: [...new Set(users.map(u=>u.role))].length, color:'var(--blue)' },
            ].map(k => (
              <div key={k.label} className="kpi">
                <div className="kpi-accent" style={{ background: k.color }} />
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value">{k.value}</div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader title="System Users" subtitle="Click Deactivate to revoke access without deleting the user record" />
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Last Login</th>
                    <th>Max Capacity</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign:'center', padding:24 }}>
                        <div className="spinner" style={{ margin:'0 auto' }} />
                      </td>
                    </tr>
                  ) : users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{
                            width:32, height:32, borderRadius:'50%', flexShrink:0,
                            background: u.is_active ? 'var(--signal-dim)' : 'var(--surface)',
                            border: `1.5px solid ${u.is_active ? 'var(--signal)' : 'var(--border)'}`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontFamily:'var(--fM)', fontSize:11, fontWeight:700,
                            color: u.is_active ? 'var(--signal-dk)' : 'var(--text-muted)',
                          }}>
                            {u.initials}
                          </div>
                          <span style={{ fontWeight:600, fontSize:13 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily:'var(--fM)', fontSize:11.5, color:'var(--text-muted)' }}>
                        {u.email}
                      </td>
                      <td>
                        <span className={`badge ${ROLE_BADGE[u.role] || 'b-grey'}`} style={{ fontSize:10 }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td style={{ fontFamily:'var(--fM)', fontSize:11, color:'var(--text-muted)' }}>
                        {u.last_login
                          ? format(new Date(u.last_login), 'dd MMM yyyy HH:mm')
                          : '— Never'}
                      </td>
                      <td>
                        {['qc_inspector','welding_inspector','ndt_technician','qa_engineer','quality_manager'].includes(u.role) ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <input
                              type="number"
                              min={1}
                              placeholder="default"
                              value={capacityDrafts[u.id] !== undefined ? capacityDrafts[u.id] : (u.max_active_inspections ?? '')}
                              onChange={e => setCapacityDrafts(d => ({ ...d, [u.id]: e.target.value }))}
                              style={{ width:64, fontFamily:'var(--fM)', fontSize:11.5, padding:'4px 6px', border:'1px solid var(--border)', borderRadius:4, background:'var(--bg)' }}
                            />
                            {capacityDrafts[u.id] !== undefined && (
                              <Button size="xs" variant="ghost" onClick={() => handleSaveCapacity(u.id, u.name)}>Save</Button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Badge label={u.is_active ? 'Active' : 'Suspended'} />
                      </td>
                      <td>
                        <Button
                          size="xs"
                          variant={u.is_active ? 'danger' : 'ghost'}
                          onClick={() => handleToggle(u.id, u.name, u.is_active)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'permissions' && (
        <Card>
          <CardHeader
            title="Role Permissions Matrix"
            subtitle="Defines what each role can do across all modules"
          />
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth:180 }}>Permission</th>
                  {ALL_ROLES.map(r => (
                    <th key={r} style={{ textAlign:'center', minWidth:80, fontSize:8.5 }}>
                      {ROLE_LABELS[r].replace(' ', '\n')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS_MATRIX.map(row => (
                  <tr key={row.label}>
                    <td style={{ fontWeight:600, fontSize:13 }}>{row.label}</td>
                    {ALL_ROLES.map(role => (
                      <td key={role} style={{ textAlign:'center' }}>
                        {row.perms.includes(role)
                          ? <span style={{ color:'var(--green)', fontSize:16 }}>✓</span>
                          : <span style={{ color:'var(--border-dk)', fontSize:13 }}>—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add User Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Register New User"
        subtitle="User will receive login credentials to access IQMS"
        size={500}
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register User'}
          </Button>
        </>}
      >
        <Alert type="info" className="mb4">
          The new user will be able to log in immediately with the password you set. Advise them to change it after first login.
        </Alert>
        <div className="fg2">
          <div className="fg fg-full">
            <label className="fg-label">Full Name</label>
            <input className="fc" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Emeka Okafor" />
          </div>
          <div className="fg">
            <label className="fg-label">Email Address</label>
            <input className="fc" type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="e.g. e.okafor@company.ng" />
          </div>
          <div className="fg">
            <label className="fg-label">Temporary Password</label>
            <input className="fc" type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} placeholder="Min. 8 characters" />
          </div>
          <div className="fg fg-full">
            <label className="fg-label">Role</label>
            <select className="fc" value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="fg fg-full">
            <div style={{ background:'var(--surface)', borderRadius:'var(--r)', padding:'10px 14px' }}>
              <div style={{ fontFamily:'var(--fM)', fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>
                PERMISSIONS FOR SELECTED ROLE
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {PERMISSIONS_MATRIX
                  .filter(p => p.perms.includes(form.role))
                  .map(p => (
                    <span key={p.label} className="badge b-green" style={{ fontSize:9 }}>
                      {p.label}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ── AUDIT PAGE ────────────────────────────────────────────────────────────────
export const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog({ limit: 100 }).then(r => setLogs(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  const actionColor = (action) => {
    if (!action) return 'var(--text-muted)';
    if (action.includes('Lock') || action.includes('Approv') || action.includes('Released') || action.includes('Closed')) return 'var(--green)';
    if (action.includes('NCR') || action.includes('Reject')) return 'var(--red)';
    return 'var(--amber)';
  };

  return (
    <div>
      <SectionHeader title="Audit Trail" subtitle="Immutable field-level log of every system action with before/after values" />
      <Alert type="signal" className="mb4">🔐 All records cryptographically timestamped. Append-only log — accessible to auditors and client representatives in real time.</Alert>
      <Card>
        <CardHeader title="System Event Log" actions={<span style={{fontFamily:'var(--fM)',fontSize:10,color:'var(--text-muted)'}}>🔒 Read-only</span>} />
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Description</th><th>Change</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{textAlign:'center',padding:20}}><div className="spinner" style={{margin:'0 auto'}}/></td></tr>
              : logs.map(a => (
                <tr key={a.id}>
                  <td style={{fontFamily:'var(--fM)',fontSize:10}}>{a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss') : '—'}</td>
                  <td style={{fontSize:12.5,fontWeight:500}}>{a.user_name}</td>
                  <td style={{fontSize:11,color:'var(--text-muted)'}}>{a.user_role}</td>
                  <td><span className="badge b-grey" style={{fontSize:9}}>{a.action}</span></td>
                  <td><Tag>{a.entity_ref || a.entity_id?.slice(0,8)}</Tag></td>
                  <td style={{fontSize:11.5,color:'var(--text-sub)',maxWidth:220}}>{a.description}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:10,color:actionColor(a.action),maxWidth:200}}>
                    {a.after_value ? formatAuditChange(a.before_value, a.after_value) || '—' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
