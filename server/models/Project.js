const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // ── MULTI-TENANCY ──────────────────────────────────────────────────────────
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // ── FIELDS (unchanged from v1) ─────────────────────────────────────────────
  project_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    // unique within a tenant; see index below
  },
  name: { type: DataTypes.STRING(200), allowNull: false },
  client: { type: DataTypes.STRING(150), allowNull: false },
  contractor: { type: DataTypes.STRING(150), allowNull: false },
  location: { type: DataTypes.STRING(200), allowNull: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('Active', 'On Hold', 'Completed', 'Cancelled'),
    defaultValue: 'Active',
  },
  standards: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  completion_pct: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0, max: 100 },
  },
  description: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'projects',
  indexes: [
    // project_number unique per tenant
    { unique: true, fields: ['tenant_id', 'project_number'] },
  ],
});

module.exports = Project;
