const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // ── MULTI-TENANCY ──────────────────────────────────────────────────────────
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false, // Every user belongs to exactly one tenant
  },
  // ── IDENTITY ───────────────────────────────────────────────────────────────
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true },
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: { isEmail: true },
    // NOTE: uniqueness is per-tenant, enforced via unique index below
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true, // null for SSO users
  },
  role: {
    type: DataTypes.ENUM(
      'system_admin', 'quality_manager', 'qa_engineer',
      'qc_inspector', 'welding_inspector', 'ndt_technician',
      'document_controller', 'client_representative'
    ),
    allowNull: false,
    defaultValue: 'qc_inspector',
  },
  // Whether this user is the billing owner of the tenant account
  is_tenant_owner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  initials: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  // Workload capacity: max number of concurrently open (Draft/Submitted)
  // inspections this user can carry before being flagged as overloaded.
  // null = fall back to the role-based default defined in resourceController.
  max_active_inspections: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // SSO support (enterprise)
  sso_provider: {
    type: DataTypes.STRING(30),
    allowNull: true, // e.g. 'google', 'azure_ad', 'okta'
  },
  sso_subject: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  // Invite flow
  invite_token: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  invite_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  invite_accepted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  indexes: [
    // Email unique WITHIN a tenant (different tenants can have same email)
    { unique: true, fields: ['tenant_id', 'email'] },
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
      if (!user.initials && user.name) {
        user.initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.invite_token;
  delete values.sso_subject;
  return values;
};

module.exports = User;
