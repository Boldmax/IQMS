const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const Project = require('./Project');
const Inspection = require('./Inspection');
const NCR = require('./NCR');
const PunchList = require('./PunchList');
const QualityPlan = require('./QualityPlan');

// ── ADD tenant_id TO ALL SECONDARY MODELS ────────────────────────────────────
// Rather than editing every model file, we inject tenant_id as a column
// on models that were originally single-tenant. This keeps model files clean
// while guaranteeing every row has a tenant scope.
const TENANT_COL = {
  tenant_id: { type: DataTypes.UUID, allowNull: false },
};

// ── MATERIAL ─────────────────────────────────────────────────────────────────
const Material = sequelize.define('Material', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  material_id: { type: DataTypes.STRING(20), allowNull: false },
  grade: { type: DataTypes.STRING(100), allowNull: false },
  heat_number: { type: DataTypes.STRING(50), allowNull: false },
  certificate_ref: { type: DataTypes.STRING(100), allowNull: true },
  manufacturer: { type: DataTypes.STRING(150), allowNull: true },
  supplier: { type: DataTypes.STRING(150), allowNull: true },
  received_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('Pending', 'Released', 'Hold', 'Rejected'), defaultValue: 'Pending' },
  receiving_inspector_id: { type: DataTypes.UUID, allowNull: true },
  project_id: { type: DataTypes.UUID, allowNull: true },
  dimensions: { type: DataTypes.STRING(200), allowNull: true },
  used_in: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  cert_checklist: { type: DataTypes.JSONB, defaultValue: {} },
  hold_reason: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'materials',
  indexes: [{ unique: true, fields: ['tenant_id', 'material_id'] }],
});

// ── DOCUMENT ──────────────────────────────────────────────────────────────────
const Document = sequelize.define('Document', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  doc_number: { type: DataTypes.STRING(50), allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false },
  doc_type: {
    type: DataTypes.ENUM(
      'WPS', 'PQR', 'ITP', 'Quality Plan', 'NDT Procedure',
      'Coating Procedure', 'Inspection Report', 'Certificate',
      'Datasheet', 'Drawing', 'Manual', 'Other'
    ),
    allowNull: false,
  },
  project_id: { type: DataTypes.UUID, allowNull: true },
  revision: { type: DataTypes.STRING(10), defaultValue: 'Rev 0' },
  status: {
    type: DataTypes.ENUM('Draft', 'Under Review', 'Approved', 'Superseded', 'Obsolete'),
    defaultValue: 'Draft',
  },
  file_path: { type: DataTypes.STRING(500), allowNull: true },
  file_size: { type: DataTypes.STRING(20), allowNull: true },
  file_type: { type: DataTypes.STRING(10), allowNull: true },
  author_id: { type: DataTypes.UUID, allowNull: true },
  author_name: { type: DataTypes.STRING(100), allowNull: true },
  approved_by_id: { type: DataTypes.UUID, allowNull: true },
  approved_by_name: { type: DataTypes.STRING(100), allowNull: true },
  approved_date: { type: DataTypes.DATEONLY, allowNull: true },
  superseded_by: { type: DataTypes.UUID, allowNull: true },
  is_controlled: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'documents' });

// ── ITP ITEM ──────────────────────────────────────────────────────────────────
const ITPItem = sequelize.define('ITPItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  project_id: { type: DataTypes.UUID, allowNull: false },
  sequence: { type: DataTypes.INTEGER, allowNull: false },
  activity: { type: DataTypes.STRING(200), allowNull: false },
  inspection_description: { type: DataTypes.TEXT, allowNull: true },
  method: { type: DataTypes.STRING(200), allowNull: true },
  acceptance_criteria: { type: DataTypes.TEXT, allowNull: true },
  responsibility: { type: DataTypes.STRING(100), allowNull: true },
  is_hold_point: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_witness_point: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_review_point: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: {
    type: DataTypes.ENUM('Pending', 'In Progress', 'Complete', 'Blocked', 'Waived'),
    defaultValue: 'Pending',
  },
  completed_date: { type: DataTypes.DATEONLY, allowNull: true },
  completed_by: { type: DataTypes.UUID, allowNull: true },
  completed_by_name: { type: DataTypes.STRING(100), allowNull: true },
  sign_off_remarks: { type: DataTypes.TEXT, allowNull: true },
  inspection_ref: { type: DataTypes.STRING(30), allowNull: true },
}, { tableName: 'itp_items' });

// ── WELDER ────────────────────────────────────────────────────────────────────
const Welder = sequelize.define('Welder', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  welder_id: { type: DataTypes.STRING(20), allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  stamp: { type: DataTypes.STRING(10), allowNull: false },
  process: { type: DataTypes.STRING(50), allowNull: true },
  wpq_reference: { type: DataTypes.STRING(50), allowNull: true },
  status: {
    type: DataTypes.ENUM('Active', 'Expired', 'Suspended', 'Inactive'),
    defaultValue: 'Active',
  },
  expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
  total_welds: { type: DataTypes.INTEGER, defaultValue: 0 },
  repair_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  project_ids: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
  // Process Qualification Test Parameters
  test_pipe_dia: { type: DataTypes.STRING(20), allowNull: true },
  test_plate_thk: { type: DataTypes.STRING(20), allowNull: true },
  test_position: { type: DataTypes.STRING(20), allowNull: true },
  test_filler_aws_no: { type: DataTypes.STRING(20), allowNull: true },
  test_filler_f_no: { type: DataTypes.STRING(10), allowNull: true },
  test_material_p_no: { type: DataTypes.STRING(10), allowNull: true },
  test_material_spec: { type: DataTypes.STRING(50), allowNull: true },
  // Qualified Parameter Range
  qual_process: { type: DataTypes.STRING(50), allowNull: true },
  qual_dia_thk: { type: DataTypes.STRING(50), allowNull: true },
  qual_f_no: { type: DataTypes.STRING(10), allowNull: true },
  qual_p_no: { type: DataTypes.STRING(10), allowNull: true },
  qual_position: { type: DataTypes.STRING(20), allowNull: true },
}, {
  tableName: 'welders',
  indexes: [
    { unique: true, fields: ['tenant_id', 'welder_id'] },
    { unique: true, fields: ['tenant_id', 'stamp'] },
  ],
});

// ── EQUIPMENT ─────────────────────────────────────────────────────────────────
const Equipment = sequelize.define('Equipment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  equipment_id: { type: DataTypes.STRING(20), allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  equipment_type: { type: DataTypes.STRING(100), allowNull: true },
  serial_number: { type: DataTypes.STRING(100), allowNull: true },
  calibration_due: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('Calibrated', 'Due Soon', 'Overdue', 'In Service', 'Quarantined'),
    defaultValue: 'Calibrated',
  },
  assigned_project_id: { type: DataTypes.UUID, allowNull: true },
  utilisation_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_calibration: { type: DataTypes.DATEONLY, allowNull: true },
  calibration_cert: { type: DataTypes.STRING(100), allowNull: true },
}, {
  tableName: 'equipment',
  indexes: [{ unique: true, fields: ['tenant_id', 'equipment_id'] }],
});

// ── BLASTER ───────────────────────────────────────────────────────────────────
const Blaster = sequelize.define('Blaster', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  blaster_id: { type: DataTypes.STRING(20), allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  stamp: { type: DataTypes.STRING(10), allowNull: false },
  process: { type: DataTypes.STRING(50), allowNull: true },
  qualification_reference: { type: DataTypes.STRING(50), allowNull: true },
  status: {
    type: DataTypes.ENUM('Active', 'Expired', 'Suspended', 'Inactive'),
    defaultValue: 'Active',
  },
  expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
  // Process Qualification Test Parameters
  test_abrasive_type: { type: DataTypes.STRING(50), allowNull: true },
  test_surface_preparation: { type: DataTypes.STRING(50), allowNull: true },
  test_blast_profile: { type: DataTypes.STRING(20), allowNull: true },
  test_material_spec: { type: DataTypes.STRING(50), allowNull: true },
  // Qualified Parameter Range
  qual_abrasive_type: { type: DataTypes.STRING(50), allowNull: true },
  qual_surface_preparation: { type: DataTypes.STRING(50), allowNull: true },
  qual_blast_profile: { type: DataTypes.STRING(50), allowNull: true },
  qual_material_spec: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: 'blasters',
  indexes: [
    { unique: true, fields: ['tenant_id', 'blaster_id'] },
    { unique: true, fields: ['tenant_id', 'stamp'] },
  ],
});

// ── PAINTER ───────────────────────────────────────────────────────────────────
const Painter = sequelize.define('Painter', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  painter_id: { type: DataTypes.STRING(20), allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  stamp: { type: DataTypes.STRING(10), allowNull: false },
  process: { type: DataTypes.STRING(50), allowNull: true },
  qualification_reference: { type: DataTypes.STRING(50), allowNull: true },
  status: {
    type: DataTypes.ENUM('Active', 'Expired', 'Suspended', 'Inactive'),
    defaultValue: 'Active',
  },
  expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
  // Process Qualification Test Parameters
  test_coating_system: { type: DataTypes.STRING(100), allowNull: true },
  test_application_method: { type: DataTypes.STRING(50), allowNull: true },
  test_dft_range: { type: DataTypes.STRING(50), allowNull: true },
  test_material_spec: { type: DataTypes.STRING(50), allowNull: true },
  // Qualified Parameter Range
  qual_coating_system: { type: DataTypes.STRING(100), allowNull: true },
  qual_application_method: { type: DataTypes.STRING(50), allowNull: true },
  qual_dft_range: { type: DataTypes.STRING(50), allowNull: true },
  qual_material_spec: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: 'painters',
  indexes: [
    { unique: true, fields: ['tenant_id', 'painter_id'] },
    { unique: true, fields: ['tenant_id', 'stamp'] },
  ],
});

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ...TENANT_COL,
  user_id: { type: DataTypes.UUID, allowNull: true },
  user_name: { type: DataTypes.STRING(100), allowNull: true },
  user_role: { type: DataTypes.STRING(50), allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  entity_type: { type: DataTypes.STRING(50), allowNull: false },
  entity_id: { type: DataTypes.STRING(100), allowNull: true },
  entity_ref: { type: DataTypes.STRING(50), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  before_value: { type: DataTypes.JSONB, allowNull: true },
  after_value: { type: DataTypes.JSONB, allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
});

// ── ASSOCIATIONS ──────────────────────────────────────────────────────────────
// Tenant → everything
Tenant.hasMany(User,      { foreignKey: 'tenant_id', as: 'users' });
User.belongsTo(Tenant,    { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Project,   { foreignKey: 'tenant_id', as: 'projects' });
Project.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Direct tenant associations for the transactional models — these were
// missing along with the tenant_id column itself. Project-level scoping
// alone isn't sufficient for queries that filter inspections/NCRs/punch
// items directly without joining through Project.
Tenant.hasMany(Inspection, { foreignKey: 'tenant_id', as: 'tenantInspections' });
Inspection.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(NCR, { foreignKey: 'tenant_id', as: 'tenantNcrs' });
NCR.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(PunchList, { foreignKey: 'tenant_id', as: 'tenantPunchItems' });
PunchList.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Project → children (same as v1, but all scoped via tenant too)
Project.hasMany(Inspection, { foreignKey: 'project_id', as: 'inspections' });
Inspection.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(NCR, { foreignKey: 'project_id', as: 'ncrs' });
NCR.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(ITPItem, { foreignKey: 'project_id', as: 'itp_items' });
ITPItem.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(Material, { foreignKey: 'project_id', as: 'materials' });
Material.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(Document, { foreignKey: 'project_id', as: 'documents' });
Document.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(QualityPlan, { foreignKey: 'project_id', as: 'quality_plans' });
QualityPlan.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

User.hasMany(Inspection, { foreignKey: 'inspector_id', as: 'inspections' });
Inspection.belongsTo(User, { foreignKey: 'inspector_id', as: 'inspector' });

Project.hasMany(PunchList, { foreignKey: 'project_id', as: 'punch_items' });
PunchList.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

module.exports = {
  sequelize,
  Tenant, User, Project, Inspection, NCR,
  Material, Document, ITPItem, Welder, Equipment, AuditLog, PunchList,
  Blaster, Painter, QualityPlan,
};
