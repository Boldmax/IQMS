const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inspection = sequelize.define('Inspection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // This field was missing entirely even though the controller layer
  // (req.tenantScope / req.tenantCreate) already assumed it existed on
  // every query. Without it, creating or listing inspections throws
  // "column tenant_id does not exist" — this is the actual cause of the
  // Inspections page buttons failing.
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  report_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    // NOTE: uniqueness is enforced per-tenant via a composite index in
    // this file's options block below, not globally here. A global unique
    // constraint would cause every tenant's first inspection to collide
    // on IR-2026-0001 and throw a SequelizeUniqueConstraintError.
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  inspection_type: {
    type: DataTypes.ENUM(
      'Weld Visual', 'RT Examination', 'UT Examination',
      'MT Examination', 'PT Examination', 'DFT Measurement',
      'Holiday Test', 'Dimensional Check', 'Hydrostatic Test',
      'Material Receiving', 'Coating Inspection', 'Other'
    ),
    allowNull: false,
  },
  component: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  inspector_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  inspector_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  inspection_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  procedure_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  acceptance_criteria: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  result: {
    type: DataTypes.ENUM('Accepted', 'Conditional', 'Rejected', 'Pending'),
    defaultValue: 'Pending',
  },
  severity: {
    type: DataTypes.ENUM('Minor', 'Major', 'Critical'),
    allowNull: true,
  },
  findings: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  measurements: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  code_violations: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  locked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  locked_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Rejected'),
    defaultValue: 'Draft',
  },
  itp_item_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'inspections',
  indexes: [
    { unique: true, fields: ['tenant_id', 'report_number'] },
  ],
  hooks: {
    beforeUpdate: (inspection) => {
      if (inspection.is_locked && !inspection.changed('is_locked')) {
        throw new Error('Cannot modify a locked inspection record');
      }
    },
  },
});

module.exports = Inspection;
