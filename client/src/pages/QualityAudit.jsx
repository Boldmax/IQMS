import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardBody, Badge, Button, Modal, Alert, SectionHeader, FilterBar, EmptyState, ProgressBar } from '../components/shared/UI';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ISO_9001_CLAUSES = [
  { id: '4', name: 'Context of the Organization', description: 'Understanding organization and its context' },
  { id: '5', name: 'Leadership', description: 'Leadership and commitment' },
  { id: '6', name: 'Planning', description: 'Actions to address risks and opportunities' },
  { id: '7', name: 'Support', description: 'Resources, competence, awareness' },
  { id: '8', name: 'Operation', description: 'Operational planning and control' },
  { id: '9', name: 'Performance Evaluation', description: 'Monitoring, measurement, analysis and evaluation' },
  { id: '10', name: 'Improvement', description: 'Nonconformity and corrective action' },
];

const AUDIT_TYPES = [
  'Internal Audit',
  'External Audit',
  'Supplier Audit',
  'Process Audit',
  'Product Audit',
  'System Audit',
];

const COMPLIANCE_LEVELS = [
  'Fully Compliant',
  'Partially Compliant',
  'Non-Compliant',
  'Not Applicable',
];

const RISK_LEVELS = [
  'Low',
  'Medium',
  'High',
  'Critical',
];

const EMPTY_REPORT = {
  audit_number: '',
  audit_type: 'Internal Audit',
  audit_date: new Date().toISOString().split('T')[0],
  auditor: '',
  auditee: '',
  scope: '',
  objectives: '',
  criteria: 'ISO 9001:2015',
  findings: [],
  overall_conclusion: '',
  overall_compliance: 'Partially Compliant',
  risk_assessment: 'Medium',
  recommendations: '',
};

export default function QualityAudit() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('All');
  const [selectedReport, setSelectedReport] = useState(null);

  const loadReports = useCallback(() => {
    setLoading(true);
    // Simulate API call - replace with actual API
    setTimeout(() => {
      setReports([
        {
          id: '1',
          audit_number: 'QA-2026-001',
          audit_type: 'Internal Audit',
          audit_date: '2026-01-15',
          auditor: 'John Smith',
          auditee: 'Production Department',
          scope: 'Welding Process Control',
          objectives: 'Verify compliance with welding procedures',
          criteria: 'ISO 9001:2015',
          findings: [
            { clause: '8.5.1', description: 'WPS not properly documented', nonconformity: true, severity: 'Major' },
            { clause: '7.2', description: 'Training records incomplete', nonconformity: true, severity: 'Minor' },
          ],
          overall_conclusion: 'Process requires improvement in documentation and training',
          overall_compliance: 'Partially Compliant',
          risk_assessment: 'Medium',
          recommendations: 'Update WPS documentation and complete training records',
          status: 'Completed',
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleCreate = () => {
    setForm(EMPTY_REPORT);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.audit_type || !form.audit_date || !form.auditor || !form.auditee) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      // Simulate API call - replace with actual API
      const newReport = {
        ...form,
        id: Date.now().toString(),
        audit_number: `QA-${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`,
        status: 'Draft',
      };
      setReports([newReport, ...reports]);
      setShowModal(false);
      toast.success('Quality Audit Report created successfully');
    } catch (err) {
      toast.error('Failed to create report');
    } finally {
      setSubmitting(false);
    }
  };

  const addFinding = () => {
    setForm({
      ...form,
      findings: [
        ...form.findings,
        { clause: '', description: '', nonconformity: false, severity: 'Minor' },
      ],
    });
  };

  const updateFinding = (index, field, value) => {
    const updatedFindings = [...form.findings];
    updatedFindings[index] = { ...updatedFindings[index], [field]: value };
    setForm({ ...form, findings: updatedFindings });
  };

  const removeFinding = (index) => {
    setForm({
      ...form,
      findings: form.findings.filter((_, i) => i !== index),
    });
  };

  const getComplianceColor = (level) => {
    switch (level) {
      case 'Fully Compliant': return 'var(--green)';
      case 'Partially Compliant': return 'var(--amber)';
      case 'Non-Compliant': return 'var(--red)';
      default: return 'var(--text-muted)';
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Low': return 'var(--green)';
      case 'Medium': return 'var(--amber)';
      case 'High': return 'var(--red)';
      case 'Critical': return 'var(--red)';
      default: return 'var(--text-muted)';
    }
  };

  const filteredReports = filter === 'All' 
    ? reports 
    : reports.filter(r => r.status === filter);

  return (
    <div>
      <SectionHeader 
        title="Quality Audit Reports" 
        subtitle="ISO 9001:2015 compliant audit management system"
      />
      <Alert type="signal" className="mb4">
        📋 Quality audits ensure compliance with ISO 9001 standards and identify opportunities for improvement.
      </Alert>

      <Card>
        <CardHeader 
          title="Audit Reports" 
          actions={
            <Button variant="primary" onClick={handleCreate}>
              + New Audit Report
            </Button>
          }
        />
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Audit Number</th>
                <th>Type</th>
                <th>Date</th>
                <th>Auditee</th>
                <th>Compliance</th>
                <th>Risk Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:20}}>Loading...</td></tr>
              ) : filteredReports.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:20}}>No audit reports found</td></tr>
              ) : filteredReports.map(report => (
                <tr key={report.id}>
                  <td style={{fontFamily:'var(--fM)',fontSize:10,fontWeight:600}}>{report.audit_number}</td>
                  <td>{report.audit_type}</td>
                  <td style={{fontFamily:'var(--fM)',fontSize:10}}>{format(new Date(report.audit_date), 'yyyy-MM-dd')}</td>
                  <td>{report.auditee}</td>
                  <td>
                    <Badge 
                      label={report.overall_compliance} 
                      style={{background: getComplianceColor(report.overall_compliance) + '22', color: getComplianceColor(report.overall_compliance), borderColor: getComplianceColor(report.overall_compliance) + '40'}}
                    />
                  </td>
                  <td>
                    <Badge 
                      label={report.risk_assessment} 
                      style={{background: getRiskColor(report.risk_assessment) + '22', color: getRiskColor(report.risk_assessment), borderColor: getRiskColor(report.risk_assessment) + '40'}}
                    />
                  </td>
                  <td>
                    <Badge label={report.status} />
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Create Quality Audit Report"
        subtitle="ISO 9001:2015 compliant audit documentation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Report'}
            </Button>
          </>
        }
      >
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="fg">
            <label className="fg-label">Audit Type *</label>
            <select 
              className="fc" 
              value={form.audit_type} 
              onChange={e => setForm({...form, audit_type: e.target.value})}
            >
              {AUDIT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Audit Date *</label>
            <input 
              className="fc" 
              type="date" 
              value={form.audit_date} 
              onChange={e => setForm({...form, audit_date: e.target.value})} 
            />
          </div>
          <div className="fg">
            <label className="fg-label">Auditor *</label>
            <input 
              className="fc" 
              value={form.auditor} 
              onChange={e => setForm({...form, auditor: e.target.value})} 
              placeholder="Auditor name" 
            />
          </div>
          <div className="fg">
            <label className="fg-label">Auditee *</label>
            <input 
              className="fc" 
              value={form.auditee} 
              onChange={e => setForm({...form, auditee: e.target.value})} 
              placeholder="Department or process" 
            />
          </div>
        </div>

        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Audit Scope</label>
          <textarea 
            className="fc" 
            rows={2} 
            value={form.scope} 
            onChange={e => setForm({...form, scope: e.target.value})} 
            placeholder="Describe the scope of the audit"
          />
        </div>

        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Audit Objectives</label>
          <textarea 
            className="fc" 
            rows={2} 
            value={form.objectives} 
            onChange={e => setForm({...form, objectives: e.target.value})} 
            placeholder="Define the audit objectives"
          />
        </div>

        <div style={{marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <label className="fg-label" style={{margin:0}}>Audit Findings (ISO 9001 Clauses)</label>
            <Button variant="ghost" size="sm" onClick={addFinding}>+ Add Finding</Button>
          </div>
          
          {form.findings.length === 0 ? (
            <div style={{textAlign:'center',padding:20,color:'var(--text-muted)',fontSize:12}}>
              No findings added yet
            </div>
          ) : (
            form.findings.map((finding, index) => (
              <div key={index} style={{background:'var(--surface2)',padding:12,borderRadius:6,marginBottom:8,border:'1px solid var(--border)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div className="fg">
                    <label className="fg-label">ISO 9001 Clause</label>
                    <select 
                      className="fc" 
                      value={finding.clause} 
                      onChange={e => updateFinding(index, 'clause', e.target.value)}
                    >
                      <option value="">Select clause...</option>
                      {ISO_9001_CLAUSES.map(clause => (
                        <option key={clause.id} value={clause.id}>{clause.id} - {clause.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fg">
                    <label className="fg-label">Severity</label>
                    <select 
                      className="fc" 
                      value={finding.severity} 
                      onChange={e => updateFinding(index, 'severity', e.target.value)}
                    >
                      <option value="Minor">Minor</option>
                      <option value="Major">Major</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="fg" style={{marginTop:8}}>
                  <label className="fg-label">Description</label>
                  <textarea 
                    className="fc" 
                    rows={2} 
                    value={finding.description} 
                    onChange={e => updateFinding(index, 'description', e.target.value)} 
                    placeholder="Describe the finding"
                  />
                </div>
                <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
                  <label style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
                    <input 
                      type="checkbox" 
                      checked={finding.nonconformity} 
                      onChange={e => updateFinding(index, 'nonconformity', e.target.checked)} 
                    />
                    Mark as Nonconformity
                  </label>
                  <Button variant="ghost" size="xs" style={{marginLeft:'auto',color:'var(--red)'}} onClick={() => removeFinding(index)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>
          <div className="fg">
            <label className="fg-label">Overall Compliance</label>
            <select 
              className="fc" 
              value={form.overall_compliance} 
              onChange={e => setForm({...form, overall_compliance: e.target.value})}
            >
              {COMPLIANCE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fg-label">Risk Assessment</label>
            <select 
              className="fc" 
              value={form.risk_assessment} 
              onChange={e => setForm({...form, risk_assessment: e.target.value})}
            >
              {RISK_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
        </div>

        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Overall Conclusion</label>
          <textarea 
            className="fc" 
            rows={2} 
            value={form.overall_conclusion} 
            onChange={e => setForm({...form, overall_conclusion: e.target.value})} 
            placeholder="Summarize the audit conclusion"
          />
        </div>

        <div className="fg" style={{marginTop:14}}>
          <label className="fg-label">Recommendations</label>
          <textarea 
            className="fc" 
            rows={2} 
            value={form.recommendations} 
            onChange={e => setForm({...form, recommendations: e.target.value})} 
            placeholder="Provide recommendations for improvement"
          />
        </div>
      </Modal>

      {/* View Report Modal */}
      <Modal
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`Audit Report: ${selectedReport?.audit_number}`}
        footer={<Button variant="ghost" onClick={() => setSelectedReport(null)}>Close</Button>}
      >
        {selectedReport && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>AUDIT TYPE</div>
                <div style={{fontSize:13,fontWeight:500}}>{selectedReport.audit_type}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>AUDIT DATE</div>
                <div style={{fontSize:13,fontWeight:500}}>{format(new Date(selectedReport.audit_date), 'yyyy-MM-dd')}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>AUDITOR</div>
                <div style={{fontSize:13,fontWeight:500}}>{selectedReport.auditor}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>AUDITEE</div>
                <div style={{fontSize:13,fontWeight:500}}>{selectedReport.auditee}</div>
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>SCOPE</div>
              <div style={{fontSize:12,color:'var(--text-sub)'}}>{selectedReport.scope || 'Not specified'}</div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>OBJECTIVES</div>
              <div style={{fontSize:12,color:'var(--text-sub)'}}>{selectedReport.objectives || 'Not specified'}</div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>FINDINGS</div>
              {selectedReport.findings.length === 0 ? (
                <div style={{fontSize:12,color:'var(--text-muted)'}}>No findings recorded</div>
              ) : (
                selectedReport.findings.map((finding, index) => (
                  <div key={index} style={{background:'var(--surface2)',padding:10,borderRadius:4,marginBottom:8,borderLeft:`3px solid ${finding.nonconformity ? 'var(--red)' : 'var(--amber)'}`}}>
                    <div style={{fontSize:11,fontWeight:600,marginBottom:4}}>
                      Clause {finding.clause} · {finding.severity}
                      {finding.nonconformity && <Badge label="Nonconformity" style={{marginLeft:8,fontSize:9}} />}
                    </div>
                    <div style={{fontSize:12,color:'var(--text-sub)'}}>{finding.description}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>COMPLIANCE</div>
                <Badge 
                  label={selectedReport.overall_compliance} 
                  style={{background: getComplianceColor(selectedReport.overall_compliance) + '22', color: getComplianceColor(selectedReport.overall_compliance), borderColor: getComplianceColor(selectedReport.overall_compliance) + '40'}}
                />
              </div>
              <div>
                <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>RISK LEVEL</div>
                <Badge 
                  label={selectedReport.risk_assessment} 
                  style={{background: getRiskColor(selectedReport.risk_assessment) + '22', color: getRiskColor(selectedReport.risk_assessment), borderColor: getRiskColor(selectedReport.risk_assessment) + '40'}}
                />
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>CONCLUSION</div>
              <div style={{fontSize:12,color:'var(--text-sub)'}}>{selectedReport.overall_conclusion || 'Not specified'}</div>
            </div>

            <div>
              <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--fM)',marginBottom:2}}>RECOMMENDATIONS</div>
              <div style={{fontSize:12,color:'var(--text-sub)'}}>{selectedReport.recommendations || 'Not specified'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
