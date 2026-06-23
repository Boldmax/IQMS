/**
 * tenantScope middleware
 *
 * Injects `tenant_id` into every create/query operation automatically,
 * so controllers never need to manually pluck it from req.tenant.
 *
 * Pattern used throughout controllers:
 *   const where = { ...req.tenantScope, ...otherFilters };
 *   await Project.findAll({ where });
 *
 *   await Project.create({ ...req.body, ...req.tenantCreate });
 *
 * This prevents cross-tenant data leaks even if a controller forgets to
 * add a where clause — the scope is injected at the middleware layer.
 */
const tenantScope = (req, res, next) => {
  if (!req.tenant) {
    return res.status(500).json({ success: false, message: 'Tenant context missing.' });
  }

  // Use in WHERE clauses: Project.findAll({ where: req.tenantScope })
  req.tenantScope = { tenant_id: req.tenant.id };

  // Use in CREATE calls: Project.create({ ...req.body, ...req.tenantCreate })
  req.tenantCreate = { tenant_id: req.tenant.id };

  next();
};

module.exports = { tenantScope };
