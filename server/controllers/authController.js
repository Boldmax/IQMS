const jwt = require('jsonwebtoken');
const { User, Tenant, sequelize } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');

const signToken = (id, role, tenantId) => jwt.sign(
  { id, role, tenant_id: tenantId },
  process.env.JWT_SECRET || 'dev_secret_change_me',
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
);

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    // Email can exist in multiple tenants — find the most recently active account.
    // sequelize.literal is required for NULLS LAST; Sequelize's array order syntax
    // does not support it and silently produces bad SQL when passed as a string.
    const user = await User.findOne({
      where: { email: email.toLowerCase(), is_active: true },
      include: [{ model: Tenant, as: 'tenant' }],
      order: [[sequelize.literal('"User"."last_login" DESC NULLS LAST')]],
    });

    if (!user) {
      console.log(`[login] No active user found for: ${email.toLowerCase()}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`[login] Password mismatch for: ${user.email} (id: ${user.id})`);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const tenant = user.tenant;
    if (!tenant || !tenant.is_active) {
      return res.status(403).json({ success: false, message: 'Account not found or suspended.' });
    }

    await user.update({ last_login: new Date() });

    const token = signToken(user.id, user.role, tenant.id);

    await createAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'User Login',
      entityType: 'auth',
      entityRef: user.email,
      description: `${user.name} signed in`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: user.toJSON(),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        plan_status: tenant.plan_status,
        trial_ends_at: tenant.trial_ends_at,
        features: tenant.features,
        max_users: tenant.max_users,
        max_projects: tenant.max_projects,
        primary_colour: tenant.primary_colour,
        logo_url: tenant.logo_url,
        settings: tenant.settings,
      },
    });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user.toJSON(),
    tenant: {
      id: req.tenant.id,
      slug: req.tenant.slug,
      name: req.tenant.name,
      plan: req.tenant.plan,
      features: req.tenant.features,
      settings: req.tenant.settings,
    },
  });
};

exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    await req.user.update({ name });
    res.json({ success: true, user: req.user.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
