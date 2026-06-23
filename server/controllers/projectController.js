const { Project, Inspection, NCR, ITPItem } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');
const { Op } = require('sequelize');

// Tenant-scoped project number (PRJ-001 per tenant, not globally)
const generateProjectNumber = async (tenantId) => {
  const count = await Project.count({ where: { tenant_id: tenantId } });
  return `PRJ-${String(count + 1).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = { ...req.tenantScope };
    if (status) where.status = status;
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const projects = await Project.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: projects, count: projects.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, ...req.tenantScope },
      include: [
        { model: Inspection, as: 'inspections', limit: 10, order: [['created_at', 'DESC']] },
        { model: NCR, as: 'ncrs', where: { status: { [Op.ne]: 'Closed' } }, required: false },
        { model: ITPItem, as: 'itp_items', order: [['sequence', 'ASC']] },
      ],
    });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    // Enforce project limit
    if (req.tenant.isAtProjectLimit()) {
      return res.status(402).json({
        success: false,
        code: 'PROJECT_LIMIT_REACHED',
        message: `Your plan allows up to ${req.tenant.max_projects} projects. Upgrade to create more.`,
        upgrade_url: `${process.env.CLIENT_URL}/billing/upgrade`,
      });
    }

    const { name, client, contractor, location, start_date, end_date, standards, description } = req.body;
    const project_number = await generateProjectNumber(req.tenant.id);

    const project = await Project.create({
      ...req.tenantCreate,
      project_number, name, client, contractor, location,
      start_date, end_date, standards: standards || [],
      description, created_by: req.user.id,
    });

    // Increment tenant project counter
    await req.tenant.increment('current_projects');

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Project Created', entityType: 'project',
      entityId: project.id, entityRef: project.project_number,
      description: `Created project: ${name}`,
      afterValue: { project_number, name, status: 'Active' },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const before = { status: project.status, completion_pct: project.completion_pct };
    await project.update(req.body);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Project Updated', entityType: 'project',
      entityId: project.id, entityRef: project.project_number,
      description: `Updated project ${project.project_number}`,
      beforeValue: before, afterValue: req.body, ipAddress: req.ip,
    });

    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;
    // Verify project belongs to this tenant
    const project = await Project.findOne({ where: { id, ...req.tenantScope } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const [inspections, ncrs, itpItems] = await Promise.all([
      Inspection.findAll({ where: { project_id: id, ...req.tenantScope } }),
      NCR.findAll({ where: { project_id: id, ...req.tenantScope } }),
      ITPItem.findAll({ where: { project_id: id, ...req.tenantScope } }),
    ]);

    const total = inspections.length;
    const accepted = inspections.filter(i => i.result === 'Accepted').length;
    const rejected = inspections.filter(i => i.result === 'Rejected').length;

    res.json({
      success: true,
      data: {
        inspections: { total, accepted, rejected, passRate: total ? Math.round(accepted / total * 100) : 0 },
        ncrs: { total: ncrs.length, open: ncrs.filter(n => n.status !== 'Closed').length },
        itp: { total: itpItems.length, complete: itpItems.filter(i => i.status === 'Complete').length },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
