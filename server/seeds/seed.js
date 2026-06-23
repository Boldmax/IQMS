/**
 * IQMS SaaS Seed Script
 * Run: node seeds/seed.js
 *
 * Wipes the database and creates fresh demo data for two tenants.
 * IMPORTANT: Only run this in development — it drops all tables first.
 */
require('dotenv').config();
const {
  sequelize, Tenant, User, Project,
  Inspection, NCR, ITPItem, Welder, Equipment, PunchList,
} = require('../models');

const seed = async () => {
  // Wipe and recreate all tables from current model definitions
  await sequelize.sync({ force: true });
  console.log('✓ Database wiped and re-synced\n');
 
  // ── TENANT 1 — IQMS Demo Company (Pro plan) ───────────────────────────────
  // Uses simple, memorable credentials — easy to type at the login screen
  const proFeatures = Tenant.PLAN_DEFAULTS.pro.features;
  const chevron = await Tenant.create({
    slug: 'iqms-demo',
    name: 'IQMS Demo Company',
    industry: 'oil_gas',
    plan: 'pro',
    plan_status: 'active',
    max_users: 25,
    max_projects: 999,
    features: proFeatures,
    owner_email: 'admin@demo.iqms',
    owner_name: 'Olabode Fasanya',
    country: 'Nigeria',
    onboarding_completed: true,
    current_users: 6,
    current_projects: 2,
  });

  const [qm, weld, qc, ndt, dc, qa] = await Promise.all([
    User.create({ tenant_id: chevron.id, name: 'Olabode Fasanya',  email: 'admin@demo.iqms',    password: 'Demo1234!', role: 'quality_manager',   is_tenant_owner: true }),
    User.create({ tenant_id: chevron.id, name: 'Chukwuma Eze',     email: 'welder@demo.iqms',   password: 'Demo1234!', role: 'welding_inspector' }),
    User.create({ tenant_id: chevron.id, name: 'Amara Okonkwo',    email: 'qc@demo.iqms',       password: 'Demo1234!', role: 'qc_inspector' }),
    User.create({ tenant_id: chevron.id, name: 'Balogun Adeyemi',  email: 'ndt@demo.iqms',      password: 'Demo1234!', role: 'ndt_technician' }),
    User.create({ tenant_id: chevron.id, name: 'Ngozi Adaora',     email: 'docs@demo.iqms',     password: 'Demo1234!', role: 'document_controller' }),
    User.create({ tenant_id: chevron.id, name: 'Emeka Nwachukwu',  email: 'engineer@demo.iqms', password: 'Demo1234!', role: 'qa_engineer' }),
  ]);

  const p1 = await Project.create({
    tenant_id: chevron.id, project_number: 'PRJ-001',
    name: 'Escravos GTL Phase 3',
    client: 'Chevron Nigeria Ltd', contractor: 'Saipem Nigeria',
    location: 'Escravos, Delta State',
    start_date: '2024-06-01', end_date: '2025-12-31',
    status: 'Active', standards: ['API 1104', 'ASME B31.3', 'NACE SP0188'],
    completion_pct: 44, created_by: qm.id,
    description: 'Phase 3 expansion of the Escravos Gas-to-Liquids plant.',
  });

  const p2 = await Project.create({
    tenant_id: chevron.id, project_number: 'PRJ-002',
    name: 'Abiteye Flow Station Upgrade',
    client: 'Chevron Nigeria Ltd', contractor: 'Julius Berger Nigeria',
    location: 'Warri, Delta State',
    start_date: '2024-09-01', end_date: '2025-06-30',
    status: 'Active', standards: ['API 5L', 'ASME VIII'],
    completion_pct: 23, created_by: qm.id,
  });

  // Inspections
  // Fixed to match the real Inspection model schema:
  //  - report_number, component, and inspection_date are required (NOT NULL)
  //  - there is no "reference_code" column — it's procedure_reference
  //  - there is no "remarks" column — it's findings
  //  - approved_by is a UUID (the approving user's id), not their name
  const inspDate = '2026-02-10';
  await Promise.all([
    Inspection.create({ tenant_id: chevron.id, report_number: 'IR-2026-0001', project_id: p1.id, inspector_id: qc.id, inspector_name: qc.name, inspection_type: 'Weld Visual', component: 'Spool E-7 girth weld', inspection_date: inspDate, procedure_reference: 'API 1104', result: 'Accepted', findings: 'Full penetration confirmed. No undercut.', is_locked: true, approved_by: qm.id, approved_at: new Date(), status: 'Approved' }),
    Inspection.create({ tenant_id: chevron.id, report_number: 'IR-2026-0002', project_id: p1.id, inspector_id: ndt.id, inspector_name: ndt.name, inspection_type: 'RT Examination', component: 'Spool E-7 girth weld', inspection_date: inspDate, procedure_reference: 'API 1104 §11', result: 'Accepted', findings: 'RT film clear. No indications.', is_locked: true, approved_by: qm.id, approved_at: new Date(), status: 'Approved' }),
    Inspection.create({ tenant_id: chevron.id, report_number: 'IR-2026-0003', project_id: p1.id, inspector_id: qc.id, inspector_name: qc.name, inspection_type: 'DFT Measurement', component: 'Spool E-7 coating', inspection_date: inspDate, procedure_reference: 'NACE SP0188', result: 'Rejected', findings: 'DFT below 250µm min on 3 spots.', is_locked: false, status: 'Submitted' }),
    Inspection.create({ tenant_id: chevron.id, report_number: 'IR-2026-0004', project_id: p2.id, inspector_id: qc.id, inspector_name: qc.name, inspection_type: 'Weld Visual', component: 'Tie-in weld TW-12', inspection_date: inspDate, procedure_reference: 'API 1104', result: 'Accepted', findings: 'All welds satisfactory.', is_locked: true, approved_by: qm.id, approved_at: new Date(), status: 'Approved' }),
    Inspection.create({ tenant_id: chevron.id, report_number: 'IR-2026-0005', project_id: p2.id, inspector_id: ndt.id, inspector_name: ndt.name, inspection_type: 'Material Receiving', component: '316L SS plate batch', inspection_date: inspDate, procedure_reference: 'ASTM A751', result: 'Accepted', findings: 'Material confirmed 316L SS.', is_locked: true, approved_by: qm.id, approved_at: new Date(), status: 'Approved' }),
  ]);

  // NCRs
  // Fixed to match the real NCR model schema:
  //  - raised_by is a UUID (use the user's id, not their name)
  //  - there is no "title" column — description carries the full text
  //  - there is no "assigned_to" column — responsible_party (a string) is used instead
  //  - closure_evidence is an array of strings, not a single string
  //  - due_date is required for the open NCR so it can show up in dashboard "overdue" logic correctly
  const ncrDueDate = new Date();
  ncrDueDate.setDate(ncrDueDate.getDate() + 14);

  await NCR.create({
    tenant_id: chevron.id, project_id: p1.id,
    ncr_number: 'NCR-2026-001',
    description: 'Insufficient DFT coating on spool E-7. DFT measurements averaging 180µm against 250µm minimum per NACE SP0188.',
    severity: 'Major', status: 'Open',
    raised_by: qc.id, raised_by_name: qc.name,
    raised_date: new Date().toISOString().split('T')[0],
    due_date: ncrDueDate.toISOString().split('T')[0],
    responsible_party: qa.name,
    root_cause: 'Coating applicator error during Phase 2 application.',
  });

  await NCR.create({
    tenant_id: chevron.id, project_id: p1.id,
    ncr_number: 'NCR-2026-002',
    description: 'WPS not available at weld station 4. Welder commenced work without current approved WPS on site.',
    severity: 'Minor', status: 'Closed',
    raised_by: weld.id, raised_by_name: weld.name,
    raised_date: '2026-01-10',
    closed_by: dc.id,
    closed_date: '2026-01-18',
    responsible_party: dc.name,
    root_cause: 'Document distribution gap.',
    closure_evidence: ['Revised distribution matrix issued. All welders signed.'],
  });

  // Welders
  await Welder.create({ tenant_id: chevron.id, welder_id: 'WLD-001', name: 'Emeka Okafor', stamp: 'EO1', process: 'SMAW', wpq_reference: 'WPQ-2024-001', status: 'Active', expiry_date: '2025-12-31', total_welds: 84, repair_rate: 2.4, project_ids: [p1.id] });
  await Welder.create({ tenant_id: chevron.id, welder_id: 'WLD-002', name: 'Tunde Bakare',  stamp: 'TB2', process: 'GTAW', wpq_reference: 'WPQ-2024-002', status: 'Active', expiry_date: '2025-08-15', total_welds: 62, repair_rate: 1.6, project_ids: [p1.id, p2.id] });

  // ITP Items
  await Promise.all([
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 1, activity: 'Material Receiving Inspection', method: 'Visual + Cert Review',    acceptance_criteria: 'Mill certs match PO spec',            is_hold_point: true,    status: 'Complete', completed_by_name: qc.name }),
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 2, activity: 'Fit-Up Inspection',             method: 'Dimensional Check',        acceptance_criteria: 'Gap ≤ 1.6mm, Hi-Lo ≤ 0.8mm',         is_witness_point: true, status: 'Complete', completed_by_name: qc.name }),
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 3, activity: 'Preheat Verification',          method: 'Contact Thermometer',      acceptance_criteria: '>150°C per WPS',                      is_witness_point: true, status: 'Complete', completed_by_name: weld.name }),
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 4, activity: 'Weld Visual Inspection',        method: 'VT per API 1104',          acceptance_criteria: 'No cracks, undercut <0.4mm',          is_hold_point: true,    status: 'In Progress' }),
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 5, activity: 'NDT - Radiographic Test',       method: 'RT per API 1104 §11',      acceptance_criteria: 'No rejectable indications',            is_hold_point: true,    status: 'Pending' }),
    ITPItem.create({ tenant_id: chevron.id, project_id: p1.id, sequence: 6, activity: 'Hydrostatic Test',             method: 'Pressure test to 1.5x MAOP', acceptance_criteria: 'No leaks, stable for 4 hours',       is_hold_point: true,    status: 'Pending' }),
  ]);

  // ── TENANT 2 — StartupNDT (Trial, 8 days left) ────────────────────────────
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 8);

  const startup = await Tenant.create({
    slug: 'startupndt',
    name: 'StartupNDT Ltd',
    industry: 'ndt',
    plan: 'trial',
    plan_status: 'active',
    trial_ends_at: trialEnd,
    max_users: 5,
    max_projects: 3,
    features: Tenant.PLAN_DEFAULTS.trial.features,
    owner_email: 'admin@startupndt.demo',
    owner_name: 'Fatima Al-Hassan',
    country: 'Nigeria',
  });

  await User.create({
    tenant_id: startup.id,
    name: 'Fatima Al-Hassan',
    email: 'admin@startupndt.demo',
    password: 'Demo1234!',
    role: 'quality_manager',
    is_tenant_owner: true,
  });

  await Project.create({
    tenant_id: startup.id, project_number: 'PRJ-001',
    name: 'Tank Farm NDT Survey',
    client: 'NNPC Retail', contractor: 'StartupNDT Ltd',
    location: 'Port Harcourt',
    start_date: '2025-01-15', status: 'Active',
    standards: ['API 653'], completion_pct: 12,
  });

  console.log('\n✓ Seed complete!\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DEMO LOGIN CREDENTIALS                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  IQMS Demo Company  (Pro plan — all features unlocked)      ║');
  console.log('║                                                              ║');
  console.log('║  admin@demo.iqms       / Demo1234!  (Quality Manager) ★     ║');
  console.log('║  welder@demo.iqms      / Demo1234!  (Welding Inspector)     ║');
  console.log('║  qc@demo.iqms          / Demo1234!  (QC Inspector)          ║');
  console.log('║  ndt@demo.iqms         / Demo1234!  (NDT Technician)        ║');
  console.log('║  docs@demo.iqms        / Demo1234!  (Document Controller)   ║');
  console.log('║  engineer@demo.iqms    / Demo1234!  (QA Engineer)           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  StartupNDT Ltd  (Trial — 8 days remaining)                 ║');
  console.log('║                                                              ║');
  console.log('║  admin@startupndt.demo / Demo1234!  (Quality Manager)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await sequelize.close();
};

seed().catch(err => {
  console.error('\n[seed error]', err.message);
  process.exit(1);
});
