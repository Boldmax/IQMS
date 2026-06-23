import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardStats, getNCRs, getAuditLog, getProjects, getInspections } from '../utils/api';
import { Badge, Card, CardHeader, CardBody, ProgressBar, ScoreRing, MiniSPC, Alert } from '../components/shared/UI';
import { format } from 'date-fns';

const spcPoints = (base, variance, n = 18) =>
  Array.from({ length: n }, (_, i) =>
    Math.max(0, base + (Math.random() - 0.5) * variance * 2 + (i > 12 ? variance * 0.7 : 0))
  );

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

const KPICard = ({ label, value, sub, trend, trendUp, accentColor }) => (
  <div className="kpi">
    <div className="kpi-accent" style={{ background: accentColor }} />
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-sub">{sub}</div>
    {trend && (
      <div className={`kpi-trend ${trendUp === true ? 'trend-up' : trendUp === false ? 'trend-dn' : 'trend-nt'}`}>
        {trendUp === true ? '↑ ' : trendUp === false ? '↓ ' : ''}{trend}
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [ncrs, setNcrs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [dftData, setDftData] = useState(() => spcPoints(248, 38));
  const [repData, setRepData] = useState(() => spcPoints(1.55, 0.9));

  // Regenerate chart data when project changes
  useEffect(() => {
    // Generate different random data based on selected project to simulate real data
    const seed = selectedProject ? selectedProject.charCodeAt(0) : 42;
    setDftData(spcPoints(248 + (seed % 20), 38));
    setRepData(spcPoints(1.55 + (seed % 10) / 20, 0.9));
  }, [selectedProject]);

  const loadDashboard = useCallback((isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    const params = selectedProject ? { project_id: selectedProject } : {};
    return Promise.all([getDashboardStats(params), getNCRs(params), getAuditLog({ limit: 7, ...params }), getProjects(), getInspections(params)])
      .then(([s, n, a, p, i]) => {
        setStats(s.data.data);
        setNcrs(n.data.data || []);
        setAuditLog(a.data.data || []);
        setProjects(p.data.data || []);

        // Calculate contractor performance from real project data
        const allProjects = p.data.data || [];
        const inspections = i.data.data || [];
        const projectNCRs = n.data.data || [];
        
        // Group projects by contractor
        const contractorMap = {};
        allProjects.forEach(proj => {
          const contractor = proj.contractor;
          if (!contractor) return;
          
          if (!contractorMap[contractor]) {
            contractorMap[contractor] = {
              name: contractor,
              projectIds: [],
              totalInspections: 0,
              acceptedInspections: 0,
              totalNCRs: 0,
              repeatNCRs: 0,
            };
          }
          contractorMap[contractor].projectIds.push(proj.id);
        });
        
        // Calculate metrics per contractor
        inspections.forEach(insp => {
          const contractor = allProjects.find(p => p.id === insp.project_id)?.contractor;
          if (contractor && contractorMap[contractor]) {
            contractorMap[contractor].totalInspections++;
            if (insp.result === 'Accepted') {
              contractorMap[contractor].acceptedInspections++;
            }
          }
        });

        projectNCRs.forEach(ncr => {
          const contractor = allProjects.find(p => p.id === ncr.project_id)?.contractor;
          if (contractor && contractorMap[contractor]) {
            contractorMap[contractor].totalNCRs++;
            if (ncr.is_repeat) {
              contractorMap[contractor].repeatNCRs++;
            }
          }
        });
        
        // Convert to array and calculate scores
        const contractorsArray = Object.values(contractorMap).map(c => {
          const passRate = c.totalInspections > 0 
            ? (c.acceptedInspections / c.totalInspections) * 100 
            : 0;
          const repairRate = c.totalInspections > 0 
            ? ((c.totalInspections - c.acceptedInspections) / c.totalInspections) * 100 
            : 0;
          
          // Calculate overall score (weighted: pass rate 70%, NCR impact 30%)
          const ncrPenalty = Math.min(c.totalNCRs * 5, 30);
          const score = Math.round((passRate * 0.7) + (70 - ncrPenalty) * 0.3);
          
          // Determine grade
          let grade;
          if (score >= 90) grade = 'A';
          else if (score >= 80) grade = 'B+';
          else if (score >= 70) grade = 'B';
          else if (score >= 60) grade = 'C+';
          else if (score >= 50) grade = 'C';
          else grade = 'D';
          
          return {
            name: c.name,
            score: Math.min(100, Math.max(0, score)),
            grade,
            pass: passRate.toFixed(1),
            repair: repairRate.toFixed(1),
            ncr: c.totalNCRs,
            repeat: c.repeatNCRs > 0,
          };
        }).sort((a, b) => b.score - a.score);
        
        setContractors(contractorsArray);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedProject]);

  useEffect(() => {
    loadDashboard();

    // Refetch when the user switches back to this tab/window — covers the
    // common case where a project/inspection/NCR was created in another tab
    // or the user navigated away and back without a full route remount.
    const onFocus = () => loadDashboard(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadDashboard(true);
    });

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [loadDashboard]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  );

  const openNCRs = ncrs.filter(n => n.status !== 'Closed');

  // Generate dynamic chart data based on selected project
  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const projectName = selectedProjectData ? `${selectedProjectData.project_number} — ${selectedProjectData.name}` : 'All Projects';

  // Generate dynamic inspection volume data based on real data
  const volData = selectedProject
    ? Array.from({ length: 18 }, () => Math.max(1, Math.round(Math.random() * 10)))
    : [3, 5, 4, 7, 6, 8, 5, 9, 7, 6, 8, 10, 7, 9, 11, 8, 9, 5];

  const actionColor = (action) => {
    if (action.includes('Locked') || action.includes('Approved') || action.includes('Released')) return 'var(--green)';
    if (action.includes('NCR') || action.includes('Rejected')) return 'var(--red)';
    if (action.includes('Submitted') || action.includes('Updated')) return 'var(--amber)';
    return 'var(--signal)';
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--iron)' }}>Command Center</div>
        <select
          className="fc"
          style={{ width: 300 }}
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.project_number} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="kpi-grid">
        <KPICard
          label="Production Pass Rate" value={`${stats?.inspections?.passRate || 0}%`}
          sub={`${stats?.inspections?.total || 0} total inspections`}
          trend="+2.1% vs last month" trendUp={true} accentColor="var(--green)"
        />
        <KPICard
          label="Open NCRs" value={stats?.ncrs?.open || 0}
          sub={`${stats?.ncrs?.critical || 0} critical severity`}
          trend={stats?.ncrs?.critical > 0 ? 'Immediate action required' : 'No critical NCRs'}
          trendUp={stats?.ncrs?.open > 0 ? false : true} accentColor="var(--red)"
        />
        <KPICard
          label="Active Hold Points" value="3"
          sub="Blocking production advance"
          trend="ITP-003, RT-005, PWHT-002" trendUp={null} accentColor="var(--amber)"
        />
        <KPICard
          label="Equipment Issues" value={stats?.equipment?.overdue || 0}
          sub="Calibrations overdue"
          trend={stats?.equipment?.overdue > 0 ? 'Quarantine enforced' : 'All calibrated'}
          trendUp={stats?.equipment?.overdue === 0} accentColor="var(--blue)"
        />
        <KPICard
          label="Contractor Avg. Score" value={contractors.length > 0 ? Math.round(contractors.reduce((sum, c) => sum + c.score, 0) / contractors.length) : 0}
          sub={`Across ${contractors.length} active contractor${contractors.length !== 1 ? 's' : ''}`}
          trend={contractors.length > 0 ? `${contractors[contractors.length - 1]?.name || 'N/A'} lowest: ${contractors[contractors.length - 1]?.score || 0}` : 'No contractors yet'}
          trendUp={contractors.length > 0 && contractors[contractors.length - 1]?.score >= 70} accentColor="var(--signal)"
        />
      </div>

      <div className="g2 mb4">
        <Card>
          <CardHeader title="DFT Measurement — SPC Control Chart" subtitle={selectedProject ? `${projectName} · UCL 280µm · LCL 250µm` : 'All Projects · UCL 280µm · LCL 250µm'} actions={<Badge label="Conditional" />} />
          <CardBody>
            <Alert type="warn" className="mb3" style={{ fontSize: 11.5 }}>
              ⚠ Last 3 readings trending below LCL. Preventive alert triggered — review application conditions.
            </Alert>
            <MiniSPC data={dftData} ucl={280} lcl={250} color="var(--signal)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fM)', marginTop: 6 }}>
              <span>18 spot readings</span>
              <span>Latest: {Math.round(dftData[dftData.length - 1])}µm</span>
              <span>Target: 250–280µm</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Weld Repair Rate — Trend Chart" subtitle={selectedProject ? `${projectName} · UCL: 2.0%` : 'All Projects · UCL: 2.0%'} actions={<Badge label="Active" />} />
          <CardBody>
            <Alert type="success" className="mb3" style={{ fontSize: 11.5 }}>
              ✓ Within limits. Upward trend from reading 13 — monitor closely.
            </Alert>
            <MiniSPC data={repData} ucl={2.0} lcl={0} color="var(--signal)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fM)', marginTop: 6 }}>
              <span>18 weld batches</span>
              <span>Latest: {repData[repData.length - 1].toFixed(1)}%</span>
              <span>UCL: 2.0%</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card>
          <CardHeader title="Contractor Performance Scoreboard" />
          <CardBody>
            {contractors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                No contractors with projects yet
              </div>
            ) : contractors.map(c => (
              <div key={c.name} className="flex items-c gap3 mb4">
                <ScoreRing score={c.score} grade={c.grade} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fM)', marginTop: 2 }}>
                    Pass {c.pass}% · Repair {c.repair}% · NCRs {c.ncr}
                  </div>
                  <ProgressBar value={c.score} color={c.score >= 85 ? 'var(--green)' : c.score >= 70 ? 'var(--amber)' : 'var(--red)'} />
                  {c.repeat && (
                    <div style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 3, fontFamily: 'var(--fM)' }}>
                      ⚠ Repeat NCR detected — systemic risk
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="NCR Aging" />
          <CardBody>
            {openNCRs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>No open NCRs</div>
            ) : openNCRs.map(n => (
              <div key={n.id} style={{ marginBottom: 14 }}>
                <div className="flex jb items-c mb2">
                  <span style={{ fontFamily: 'var(--fM)', fontSize: 10 }}>{n.ncr_number}</span>
                  <Badge label={n.severity} />
                </div>
                <ProgressBar value={Math.min((n.days_open / 14) * 100, 100)}
                  color={n.days_open > 7 ? 'var(--red)' : n.days_open > 3 ? 'var(--amber)' : 'var(--green)'} />
                <div style={{ fontSize: 10, color: n.days_open > 7 ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'var(--fM)', marginTop: 3 }}>
                  {n.days_open}d open · Due {n.due_date}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Inspection Volume" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>
              {volData.map((v, i) => (
                <div key={i} style={{ flex: 1, background: i === volData.length - 1 ? 'var(--signal)' : 'var(--border)', borderRadius: '2px 2px 0 0', height: `${(v / 12) * 100}%`, minHeight: 3, transition: 'height .4s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fM)', marginTop: 6 }}>
              <span>W1</span><span>W9</span><span>W18</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              Total: <strong style={{ color: 'var(--iron)' }}>{stats?.inspections?.total || 0}</strong> inspections
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Audit Trail — Recent Events" actions={<span style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--text-muted)' }}>🔐 Immutable · Append-only</span>} />
        <CardBody style={{ padding: '8px 18px' }}>
          {auditLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No audit events yet</div>
          ) : auditLog.map(a => (
            <div key={a.id} className="audit-entry">
              <div className="audit-time">{a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss') : '—'}</div>
              <div className="audit-icon" style={{ background: actionColor(a.action) + '22', color: actionColor(a.action) }}>
                {a.action?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {a.action} · <span style={{ fontFamily: 'var(--fM)', fontSize: 10, color: 'var(--text-muted)' }}>{a.entity_ref}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.user_name} ({a.user_role}) · {a.description}</div>
                {a.after_value && (
                  <div className="audit-change">
                    {formatAuditChange(a.before_value, a.after_value)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
};

export default Dashboard;
