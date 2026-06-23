const { Op } = require('sequelize');
const crypto = require('crypto');
const { Tenant, User } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');

/**
 * POST /api/onboard
 * Public endpoint — creates a new tenant + owner account in one shot.
 * This is the SaaS signup flow entry point.
 */
exports.onboard = async (req, res) => {
  try {
    const { company_name, industry, owner_name, owner_email, password, country } = req.body;

    if (!company_name || !owner_name || !owner_email || !password) {
      return res.status(400).json({ success: false, message: 'company_name, owner_name, owner_email, and password are required.' });
    }

    // Derive slug from company name
    let slug = company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 55);

    // Ensure slug uniqueness
    const existing = await Tenant.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;

    // Check email not already used (global uniqueness for owner logins)
    const existingUser = await User.findOne({ where: { email: owner_email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const planDefaults = Tenant.PLAN_DEFAULTS.trial;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // Create tenant
    const tenant = await Tenant.create({
      slug,
      name: company_name,
      industry: industry || 'oil_gas',
      plan: 'trial',
      plan_status: 'active',
      trial_ends_at: trialEnd,
      max_users: planDefaults.max_users,
      max_projects: planDefaults.max_projects,
      features: planDefaults.features,
      owner_email: owner_email.toLowerCase(),
      owner_name,
      country: country || null,
    });

    // Create owner user
    const owner = await User.create({
      tenant_id: tenant.id,
      name: owner_name,
      email: owner_email.toLowerCase(),
      password,
      role: 'quality_manager',
      is_tenant_owner: true,
    });

    // Update tenant user count
    await tenant.update({ current_users: 1 });

    await createAuditLog({
      tenantId: tenant.id,
      userId: owner.id,
      userName: owner.name,
      userRole: owner.role,
      action: 'Tenant Created',
      entityType: 'tenant',
      entityRef: tenant.slug,
      description: `New tenant "${tenant.name}" onboarded. Trial ends ${trialEnd.toDateString()}.`,
    });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: owner.id, role: owner.role, tenant_id: tenant.id },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.status(201).json({
      success: true,
      message: `Welcome to IQMS, ${owner_name}! Your 14-day trial has started.`,
      token,
      user: owner.toJSON(),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
        features: tenant.features,
        max_users: tenant.max_users,
        max_projects: tenant.max_projects,
      },
    });
  } catch (err) {
    console.error('[onboard]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/tenant/me
 * Returns the current tenant's settings, plan, and usage stats.
 */
exports.getMyTenant = async (req, res) => {
  try {
    const tenant = req.tenant;
    const userCount = await User.count({ where: { tenant_id: tenant.id, is_active: true } });

    res.json({
      success: true,
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        industry: tenant.industry,
        plan: tenant.plan,
        plan_status: tenant.plan_status,
        trial_ends_at: tenant.trial_ends_at,
        trial_days_remaining: tenant.plan === 'trial' && tenant.trial_ends_at
          ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000))
          : null,
        features: tenant.features,
        limits: {
          max_users: tenant.max_users,
          max_projects: tenant.max_projects,
          current_users: userCount,
          current_projects: tenant.current_projects,
        },
        settings: tenant.settings,
        logo_url: tenant.logo_url,
        primary_colour: tenant.primary_colour,
        owner_email: tenant.owner_email,
        onboarding_completed: tenant.onboarding_completed,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/tenant/settings
 * Update tenant name, settings, branding. Owner only.
 */
exports.updateSettings = async (req, res) => {
  try {
    const { name, settings, logo_url, primary_colour } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (settings) updates.settings = { ...req.tenant.settings, ...settings };
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (primary_colour) updates.primary_colour = primary_colour;

    if (logo_url && !req.tenant.isFeatureEnabled('white_label')) {
      return res.status(402).json({
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'Custom branding is available on the Enterprise plan.',
        required_plan: 'enterprise',
      });
    }

    await req.tenant.update(updates);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'Tenant Settings Updated',
      entityType: 'tenant',
      entityRef: req.tenant.slug,
      description: `Settings updated by ${req.user.name}`,
    });

    res.json({ success: true, data: req.tenant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/tenant/invite
 * Invite a new user to the tenant by email. Owner / QM only.
 * Generates a secure token; in production this triggers an email.
 */
exports.inviteUser = async (req, res) => {
  try {
    const { email, role, name } = req.body;
    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'email and role are required.' });
    }

    // Enforce user limit
    if (req.tenant.isAtUserLimit()) {
      return res.status(402).json({
        success: false,
        code: 'USER_LIMIT_REACHED',
        message: `Your plan allows up to ${req.tenant.max_users} users. Upgrade to add more.`,
        upgrade_url: `${process.env.CLIENT_URL}/billing/upgrade`,
      });
    }

    const existing = await User.findOne({
      where: { tenant_id: req.tenant.id, email: email.toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This email is already a member of your workspace.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = await User.create({
      tenant_id: req.tenant.id,
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: null,
      role,
      is_active: false, // activated on invite acceptance
      invite_token: token,
      invite_expires_at: expires,
    });

    await req.tenant.increment('current_users');

    // In production: send email with link = CLIENT_URL/accept-invite?token=...
    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'User Invited',
      entityType: 'user',
      entityRef: email,
      description: `${req.user.name} invited ${email} as ${role}`,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}.`,
      data: { user: user.toJSON(), invite_url: inviteUrl }, // invite_url for dev visibility
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/accept-invite
 * Public — accepts an invite token and activates the user account.
 */
exports.acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'token and password are required.' });
    }

    const user = await User.findOne({
      where: {
        invite_token: token,
        invite_expires_at: { [Op.gt]: new Date() },
        is_active: false,
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invite link.' });
    }

    await user.update({
      password,
      is_active: true,
      invite_token: null,
      invite_expires_at: null,
      invite_accepted_at: new Date(),
    });

    const jwt = require('jsonwebtoken');
    const jwtToken = jwt.sign(
      { id: user.id, role: user.role, tenant_id: user.tenant_id },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Account activated. Welcome aboard!',
      token: jwtToken,
      user: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/tenant/upgrade
 * Simulates a plan upgrade. In production, wire this to Stripe webhooks.
 */
exports.upgradePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: `plan must be one of: ${validPlans.join(', ')}` });
    }

    const defaults = Tenant.PLAN_DEFAULTS[plan];
    await req.tenant.update({
      plan,
      plan_status: 'active',
      trial_ends_at: null,
      max_users: defaults.max_users,
      max_projects: defaults.max_projects,
      features: defaults.features,
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'Plan Upgraded',
      entityType: 'tenant',
      entityRef: req.tenant.slug,
      description: `Plan upgraded to ${plan} by ${req.user.name}`,
    });

    res.json({
      success: true,
      message: `Successfully upgraded to the ${plan} plan.`,
      data: {
        plan,
        features: defaults.features,
        max_users: defaults.max_users,
        max_projects: defaults.max_projects,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
