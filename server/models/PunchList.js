const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PunchList = sequelize.define('PunchList', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // This field was missing entirely in the original SaaS migration, even
  // though the controller layer already assumed it existed (req.tenantScope /
  // req.tenantCreate). Without it, every Punch List query/insert would throw
  // "column tenant_id does not exist" at the database level.
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  punch_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
    // Uniqueness enforced per-tenant via composite index in models/index.js
    // (added below in this file's options block). See NCR/Inspection models
    // for the same fix — a global constraint collides across tenants.
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // System/Subsystem breakdown (key for commissioning)
  system: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  subsystem: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  area_location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  // Discipline
  discipline: {
    type: DataTypes.ENUM(
      'Civil/Structural', 'Piping', 'Mechanical', 'Electrical',
      'Instrumentation', 'Coating/Painting', 'Insulation',
      'Welding', 'NDT', 'Safety', 'Process', 'Other'
    ),
    allowNull: false,
    defaultValue: 'Piping',
  },
  // Category determines handover gate blocking
  category: {
    type: DataTypes.ENUM('A', 'B', 'C'),
    allowNull: false,
    defaultValue: 'A',
    // A = Must clear before MC/handover (HARD BLOCK)
    // B = Can clear after handover within agreed timeframe
    // C = Deferred / minor / observation only
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  reference_drawing: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  reference_spec: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Open', 'In Progress', 'Pending Verification', 'Closed', 'Accepted', 'Rejected Closure'),
    defaultValue: 'Open',
  },
  priority: {
    type: DataTypes.ENUM('Critical', 'High', 'Medium', 'Low'),
    defaultValue: 'Medium',
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
  },
  responsible_contractor: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  responsible_person: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // Milestone this item blocks (MC = Mechanical Completion, RFSU = Ready For Start-Up)
  milestone: {
    type: DataTypes.ENUM('MC', 'RFSU', 'Handover', 'Final Acceptance', 'None'),
    defaultValue: 'MC',
  },
  // Closure workflow
  closure_comments: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  closure_evidence: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  closed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  closed_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  closed_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // Client acceptance of closure
  client_accepted: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  client_accepted_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  client_accepted_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // Walk-down reference
  walkdown_ref: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
}, {
  tableName: 'punch_list',
  indexes: [
    { unique: true, fields: ['tenant_id', 'punch_number'] },
  ],
  hooks: {
    beforeUpdate: (item) => {
      // Auto-set closed_date when status changes to Closed
      if (item.changed('status') && item.status === 'Closed' && !item.closed_date) {
        item.closed_date = new Date().toISOString().split('T')[0];
      }
    },
  },
});

module.exports = PunchList;
