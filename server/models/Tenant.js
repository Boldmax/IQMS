const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * TENANT MODEL — Core of the multi-tenant SaaS architecture.
 *
 * Every resource in the system is scoped to a tenant_id. This model
 * represents one paying customer organisation (e.g. "Chevron Nigeria",
 * "Total E&P"). All users, projects, inspections, NCRs, etc. belong to
 * exactly one tenant.
 *
 * Plan tiers gate feature access and resource limits:
 *   starter  → 5 users, 3 projects, core QC features only
 *   pro      → 25 users, unlimited projects, full feature set
 *   enterprise → unlimited, white-label, SSO, API access
 */
const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Human-readable slug used in URLs: app.iqms.io/acme-energy
  slug: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    validate: {
      is: /^[a-z0-9-]+$/i,
      len: [2, 60],
    },
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  // Industry vertical for onboarding personalisation
  industry: {
    type: DataTypes.ENUM(
      'oil_gas', 'fabrication', 'ndt', 'construction',
      'mining', 'power', 'marine', 'other'
    ),
    defaultValue: 'oil_gas',
  },
  plan: {
    type: DataTypes.ENUM('trial', 'starter', 'pro', 'enterprise'),
    defaultValue: 'trial',
  },
  plan_status: {
    type: DataTypes.ENUM('active', 'past_due', 'cancelled', 'suspended'),
    defaultValue: 'active',
  },
  // Stripe customer + subscription IDs (null until payment added)
  stripe_customer_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  stripe_subscription_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  // Trial management
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Soft limits enforced at API layer
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 5, // trial/starter default; overridden on upgrade
  },
  max_projects: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  // Feature flags — controlled by plan
  features: {
    type: DataTypes.JSONB,
    defaultValue: {
      inspections: true,
      ncr: true,
      itp: true,
      punch_list: true,
      materials: false,      // pro+
      documents: false,      // pro+
      welders: false,        // pro+
      equipment: false,      // pro+
      audit_trail: false,    // pro+
      spc_charts: false,     // pro+
      api_access: false,     // enterprise only
      white_label: false,    // enterprise only
      sso: false,            // enterprise only
    },
  },
  // Branding (enterprise white-label)
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  primary_colour: {
    type: DataTypes.STRING(7), // hex
    defaultValue: '#0ea5e9',
  },
  // Contact info
  owner_email: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  owner_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Usage counters (updated by triggers / background job)
  current_users: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  current_projects: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Metadata
  onboarding_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      timezone: 'Africa/Lagos',
      date_format: 'DD/MM/YYYY',
      default_standards: ['API 1104', 'ASME B31.3'],
      notification_email: true,
    },
  },
}, {
  tableName: 'tenants',
});

// ── PLAN LIMIT HELPERS ────────────────────────────────────────────────────────
Tenant.PLAN_DEFAULTS = {
  trial: {
    max_users: 5,
    max_projects: 3,
    trial_days: 14,
    features: {
      inspections: true, ncr: true, itp: true, punch_list: true,
      materials: false, documents: false, welders: false, equipment: false,
      audit_trail: false, spc_charts: false, api_access: false,
      white_label: false, sso: false,
    },
  },
  starter: {
    max_users: 10,
    max_projects: 5,
    features: {
      inspections: true, ncr: true, itp: true, punch_list: true,
      materials: true, documents: true, welders: false, equipment: false,
      audit_trail: true, spc_charts: false, api_access: false,
      white_label: false, sso: false,
    },
  },
  pro: {
    max_users: 25,
    max_projects: 999,
    features: {
      inspections: true, ncr: true, itp: true, punch_list: true,
      materials: true, documents: true, welders: true, equipment: true,
      audit_trail: true, spc_charts: true, api_access: false,
      white_label: false, sso: false,
    },
  },
  enterprise: {
    max_users: 9999,
    max_projects: 9999,
    features: {
      inspections: true, ncr: true, itp: true, punch_list: true,
      materials: true, documents: true, welders: true, equipment: true,
      audit_trail: true, spc_charts: true, api_access: true,
      white_label: true, sso: true,
    },
  },
};

Tenant.prototype.isFeatureEnabled = function (feature) {
  return !!(this.features && this.features[feature]);
};

Tenant.prototype.isAtUserLimit = function () {
  return this.current_users >= this.max_users;
};

Tenant.prototype.isAtProjectLimit = function () {
  return this.current_projects >= this.max_projects;
};

Tenant.prototype.isTrialExpired = function () {
  if (this.plan !== 'trial') return false;
  if (!this.trial_ends_at) return false;
  return new Date() > new Date(this.trial_ends_at);
};

module.exports = Tenant;
