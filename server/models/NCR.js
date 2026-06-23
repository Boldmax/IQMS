const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NCR = sequelize.define('NCR', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Missing entirely even though ncrController already assumed it existed
  // via req.tenantScope / req.tenantCreate on every query. This is the
  // actual cause of the NCR page buttons throwing errors on click — every
  // create/list call hit "column tenant_id does not exist" at the DB level.
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  ncr_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    // Uniqueness enforced per-tenant via composite index in this file's
    // options block below. A global constraint would collide across tenants.
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  inspection_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  inspection_ref: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('Minor', 'Major', 'Critical'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Open', 'Under Review', 'Pending Verification', 'Closed'),
    defaultValue: 'Open',
  },
  responsible_party: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  root_cause: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  corrective_action: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  preventive_action: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  raised_by: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  raised_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  raised_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  closed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  closed_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  closure_evidence: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  verification_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_repeat: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'ncrs',
  indexes: [
    { unique: true, fields: ['tenant_id', 'ncr_number'] },
  ],
});

module.exports = NCR;
