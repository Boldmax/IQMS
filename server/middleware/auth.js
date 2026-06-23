const jwt = require('jsonwebtoken');
const { User, Tenant } = require('../models');

const ROLE_HIERARCHY = {
  system_admin: 8, quality_manager: 7, qa_engineer: 6, qc_inspector: 5,
  welding_inspector: 4, ndt_technician: 3, document_controller: 2, client_representative: 1,
};

const PERMISSIONS = {
  system_admin:         ['*'],
  // Quality Manager owns both registers — full create/update access, not just read
  quality_manager:      ['project:*', 'inspection:*', 'ncr:*', 'document:*', 'material:*', 'itp:*', 'welder:*', 'equipment:*', 'audit:read', 'user:read', 'quality_plan:*'],
  qa_engineer:          ['project:read', 'inspection:*', 'ncr:*', 'document:*', 'material:read', 'itp:*', 'welder:read', 'equipment:read', 'audit:read', 'quality_plan:*'],
  qc_inspector:         ['project:read', 'inspection:create', 'inspection:read', 'ncr:create', 'ncr:read', 'document:read', 'material:read', 'itp:read', 'equipment:read', 'quality_plan:read'],
  // Welding inspectors log calibrations/welder records day-to-day, so they
  // need create/update on both registers, not just read.
  welding_inspector:    ['project:read', 'inspection:create', 'inspection:read', 'ncr:create', 'ncr:read', 'document:read', 'welder:*', 'equipment:*', 'quality_plan:read'],
  ndt_technician:       ['project:read', 'inspection:create', 'inspection:read', 'ncr:create', 'ncr:read', 'document:read', 'equipment:*', 'quality_plan:read'],
  document_controller:  ['project:read', 'inspection:read', 'document:*', 'ncr:read', 'quality_plan:read'],
  client_representative:['project:read', 'inspection:read', 'ncr:read', 'document:read', 'itp:read', 'audit:read', 'quality_plan:read'],
};

/**
 * protect — validates JWT and loads user + tenant into req.
 *
 * SaaS addition: we now also load req.tenant so every downstream
 * middleware can check plan limits and feature flags without extra DB hits.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Tenant, as: 'tenant' }],
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    }

    const tenant = user.tenant;
    if (!tenant || !tenant.is_active) {
      return res.status(403).json({ success: false, message: 'Account suspended or not found.' });
    }

    // Block access if trial has expired and no paid plan
    if (tenant.plan === 'trial' && tenant.isTrialExpired()) {
      return res.status(402).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        message: 'Your 14-day trial has ended. Please upgrade to continue.',
        upgrade_url: `${process.env.CLIENT_URL}/billing/upgrade`,
      });
    }

    if (tenant.plan_status === 'suspended') {
      return res.status(402).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account is suspended due to a billing issue. Please update your payment method.',
        billing_url: `${process.env.CLIENT_URL}/billing`,
      });
    }

    req.user   = user;
    req.tenant = tenant;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/**
 * requireFeature — gates a route behind a plan feature flag.
 * Usage: router.post('/welders', protect, requireFeature('welders'), ...)
 */
const requireFeature = (featureName) => (req, res, next) => {
  if (!req.tenant.isFeatureEnabled(featureName)) {
    const planNeeded = Object.entries(Tenant.PLAN_DEFAULTS).find(([, cfg]) =>
      cfg.features[featureName]
    )?.[0] || 'pro';
    return res.status(402).json({
      success: false,
      code: 'FEATURE_NOT_AVAILABLE',
      message: `The "${featureName}" feature is not included in your current plan.`,
      required_plan: planNeeded,
      upgrade_url: `${process.env.CLIENT_URL}/billing/upgrade`,
    });
  }
  next();
};

/**
 * requireOwner — only the tenant owner (or system_admin) can perform
 * billing, tenant settings, or user invite operations.
 */
const requireOwner = (req, res, next) => {
  if (!req.user.is_tenant_owner && req.user.role !== 'system_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only the account owner can perform this action.',
    });
  }
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role) && !roles.includes('*')) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized for this action.`,
    });
  }
  next();
};

const hasPermission = (resource, action) => (req, res, next) => {
  const userPerms = PERMISSIONS[req.user.role] || [];
  const canDo = userPerms.includes('*') ||
    userPerms.includes(`${resource}:*`) ||
    userPerms.includes(`${resource}:${action}`);
  if (!canDo) {
    return res.status(403).json({
      success: false,
      message: `Insufficient permissions for ${action} on ${resource}.`,
    });
  }
  next();
};

module.exports = { protect, authorize, hasPermission, requireFeature, requireOwner, PERMISSIONS, ROLE_HIERARCHY };
