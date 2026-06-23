const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * QUALITY PLAN MODEL
 * 
 * Quality Plans are comprehensive documents that define the quality requirements,
 * inspection activities, and acceptance criteria for a project. They serve as the
 * master quality control document that references ITPs, WPS, PQR, and other
 * quality-related documents.
 */
const QualityPlan = sequelize.define('QualityPlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  plan_number: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  plan_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  version: {
    type: DataTypes.STRING(20),
    defaultValue: '1.0',
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Under Review', 'Approved', 'Superseded', 'Withdrawn'),
    defaultValue: 'Draft',
  },
  // Quality Objectives
  quality_objectives: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Scope of Work
  scope_of_work: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Applicable Standards
  applicable_standards: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  // Document References (WPS, PQR, etc.)
  document_references: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  // Inspection Requirements
  inspection_requirements: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  // Acceptance Criteria
  acceptance_criteria: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Roles and Responsibilities
  roles_responsibilities: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  // Quality Control Procedures
  qc_procedures: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  // Testing Requirements
  testing_requirements: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  // Approval Workflow
  prepared_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  prepared_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reviewed_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approved_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  // Dates
  prepared_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  reviewed_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  approved_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  effective_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  // Revision History
  revision_history: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  // Additional Notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Superseded By (if this plan is replaced)
  superseded_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'quality_plans',
  indexes: [
    { unique: true, fields: ['tenant_id', 'plan_number'] },
    { fields: ['project_id'] },
    { fields: ['status'] },
  ],
});

module.exports = QualityPlan;
