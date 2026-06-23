import React, { useState, useEffect, useCallback } from 'react';
import { getInspections, createInspection, approveInspection, getProjects } from '../utils/api';
import { Badge, Tag, Button, Card, CardBody, Modal, SectionHeader, FilterBar, EmptyState } from '../components/shared/UI';
import toast from 'react-hot-toast';

const INSPECTION_TYPES = [
  'Weld Visual','RT Examination','UT Examination','MT Examination',
  'PT Examination','DFT Measurement','Holiday Test','Dimensional Check',
  'Hydrostatic Test','Material Receiving','Coating Inspection','Other',
];

const CodeViolations = ({ violations, measurements, type }) => {
  if (!violations?.length && !Object.keys(measurements || {}).length) return null;
  return (
    <div className="card mb3" style={{ border: '1px solid var(--border)' }}>
      <div className="card-hd" style={{ padding: '8px 14px', background: 'var(--surface)' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)' }}>⚖ Code Validation — Measured vs. Acceptance Limit</div>
      </div>
      <div style={{ padding: '4px 14px' }}>
        {measurements?.undercut !== undefined && (
          <div className="val-row">
            <div className="val-icon" style={{ color: measurements.undercut <= measurements.undercut_limit ? 'var(--green)' : 'var(--red)' }}>
              {measurements.undercut <= measurements.undercut_limit ? '✓' : '✗'}
            </div>
            <div className="val-label">Undercut depth (API 1104 Cl.9.3.2)</div>
            <div className="val-measured" style={{ color: measurements.undercut <= measurements.undercut_limit ? 'var(--green)' : 'var(--red)' }}>{measurements.undercut}mm</div>
            <div className="val-limit">Max {measurements.undercut_limit}mm</div>
          </div>
        )}
        {measurements?.dft_min !== undefined && (<>
          <div className="val-row">
            <div className="val-icon" style={{ color: measurements.dft_min >= measurements.dft_required ? 'var(--green)' : 'var(--red)' }}>
              {measurements.dft_min >= measurements.dft_required ? '✓' : '✗'}
            </div>
            <div className="val-label">DFT Minimum (QCP / NACE SP0188)</div>
            <div className="val-measured" style={{ color: measurements.dft_min >= measurements.dft_required ? 'var(--green)' : 'var(--red)' }}>{measurements.dft_min}µm</div>
            <div className="val-limit">Min {measurements.dft_required}µm</div>
          </div>
          {measurements.spots_below > 0 && (
            <div className="val-row">
              <div className="val-icon" style={{ color: 'var(--red)' }}>⚠</div>
              <div className="val-label">Spots below minimum DFT</div>
              <div className="val-measured" style={{ color: 'var(--red)' }}>{measurements.spots_below}/{measurements.total_spots}</div>
              <div className="val-limit">Target: 0</div>
            </div>
          )}
        </>)}
        {measurements?.holidays !== undefined && (
          <div className="val-row">
            <div className="val-icon" style={{ color: measurements.holidays === 0 ? 'var(--green)' : 'var(--red)' }}>
              {measurements.holidays === 0 ? '✓' : '✗'}
            </div>
            <div className="val-label">Holidays at {measurements.voltage}V DC (NACE SP0188)</div>
            <div className="val-measured" style={{ color: measurements.holidays === 0 ? 'var(--green)' : 'var(--red)' }}>{measurements.holidays} detected</div>
            <div className="val-limit">Allowable: 0</div>
          </div>
        )}
        {violations?.map((v, i) => (
          <div key={i} className="val-row">
            <div className="val-icon" style={{ color: v.pass ? 'var(--green)' : 'var(--red)' }}>{v.pass ? '✓' : '✗'}</div>
            <div className="val-label">{v.parameter} ({v.standard})</div>
            {v.measured !== undefined && <div className="val-measured" style={{ color: v.pass ? 'var(--green)' : 'var(--red)' }}>{v.measured}</div>}
            {v.limit !== undefined && <div className="val-limit">Limit: {v.limit}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const EMPTY_FORM = {
  project_id: '', inspection_type: 'Weld Visual', component: '', location: '',
  inspection_date: '', procedure_reference: '', acceptance_criteria: '',
  result: 'Accepted', severity: '', findings: '',
  measurements: {},
};

const Inspections = () => {
  const [inspections, setInspections] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(() => {
    const params = filter !== 'All' ? { result: filter } : {};
    Promise.all([getInspections(params), getProjects()])
      .then(([i, p]) => {
        setInspections(i.data.data || []);
        setProjects(p.data.data || []);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.project_id || !form.component || !form.inspection_date) {
      toast.error('Project, component, and date are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Convert empty string severity to null for Accepted inspections
      const submissionData = {
        ...form,
        severity: form.severity || null,
      };
      const res = await createInspection(submissionData);
      toast.success(`Report ${res.data.data.report_number} submitted`);
      if (res.data.warnings) toast(res.data.warnings, { icon: '⚠️' });
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id, reportNum) => {
    try {
      await approveInspection(id);
      toast.success(`${reportNum} approved and locked`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  return (
    <div>
      <SectionHeader
        title="Inspection Reports"
        subtitle="Code-validated findings auto-flagged against acceptance criteria"
        actions={<>
          <FilterBar options={['All','Accepted','Conditional','Rejected']} active={filter} onChange={setFilter} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ New Report</Button>
        </>}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : inspections.length === 0 ? (
        <EmptyState icon="◎" title="No inspections found" subtitle="Submit the first inspection report for this filter" action={<Button variant="primary" onClick={() => setShowModal(true)}>+ New Report</Button>} />
      ) : inspections.map(i => (
        <Card key={i.id} className="mb3">
          <CardBody>
            <div className="flex jb items-c mb3">
              <div className="flex items-c gap3">
                <Tag>{i.report_number}</Tag>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{i.inspection_type} — {i.component}</div>
                  <div style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--text-muted)' }}>
                    {i.project?.project_number} · {i.location} · {i.inspector_name} · {i.inspection_date}
                  </div>
                </div>
              </div>
              <div className="flex items-c gap2">
                {i.severity && <Badge label={i.severity} />}
                <Badge label={i.result} />
                {i.is_locked
                  ? <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--fM)' }}>🔒 Locked</span>
                  : <Button size="xs" variant="primary" onClick={() => handleApprove(i.id, i.report_number)}>Approve & Lock</Button>
                }
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '10px 14px', borderLeft: '3px solid var(--border)', marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--fM)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>FINDINGS</div>
              <div style={{ fontSize: 13 }}>{i.findings || '—'}</div>
            </div>

            <CodeViolations violations={i.code_violations} measurements={i.measurements} type={i.inspection_type} />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fM)' }}>
              Procedure: {i.procedure_reference || '—'}
            </div>
          </CardBody>
        </Card>
      ))}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Submit Inspection Report"
        subtitle="Record locked upon approval — measurements auto-validated against code"
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Report'}</Button>
        </>}
      >
        <div className="fg2">
          <div className="fg">
            <label className="fg-label">Project</label>
            <select className="fc" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name.slice(0, 30)}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Inspection Type</label>
            <select className="fc" value={form.inspection_type} onChange={e => setForm({ ...form, inspection_type: e.target.value })}>
              {INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Component / Joint ID</label>
            <input className="fc" value={form.component} onChange={e => setForm({ ...form, component: e.target.value })} placeholder="e.g. Shell Course 2, Joint 14" />
          </div>
          <div className="fg">
            <label className="fg-label">Location</label>
            <input className="fc" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. KP 14+200" />
          </div>
          <div className="fg">
            <label className="fg-label">Inspection Date</label>
            <input className="fc" type="date" value={form.inspection_date} onChange={e => setForm({ ...form, inspection_date: e.target.value })} />
          </div>
          <div className="fg">
            <label className="fg-label">Procedure Reference</label>
            <input className="fc" value={form.procedure_reference} onChange={e => setForm({ ...form, procedure_reference: e.target.value })} placeholder="e.g. WPS-AGIP-014" />
          </div>
          <div className="fg">
            <label className="fg-label">Result</label>
            <select className="fc" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>
              <option>Accepted</option><option>Conditional</option><option>Rejected</option>
            </select>
          </div>
          {form.result !== 'Accepted' && (
            <div className="fg">
              <label className="fg-label">Severity</label>
              <select className="fc" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                <option value="">Select…</option>
                <option>Minor</option><option>Major</option><option>Critical</option>
              </select>
            </div>
          )}
          <div className="fg fg-full">
            <label className="fg-label">Findings / Technical Observations</label>
            <textarea className="fc" rows={4} value={form.findings} onChange={e => setForm({ ...form, findings: e.target.value })} placeholder="Describe findings referencing specific code clauses, measured values, and locations." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Inspections;
