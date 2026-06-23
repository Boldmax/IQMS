const { NCR, Project, Inspection } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');
const { Op } = require('sequelize');

const generateNCRNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  // Must be scoped per tenant — otherwise NCR-2026-001 from one tenant
  // blocks/collides with another tenant's numbering sequence.
  const count = await NCR.count({
    where: { tenant_id: tenantId, ncr_number: { [Op.like]: `NCR-${year}-%` } },
  });
  return `NCR-${year}-${String(count + 1).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { project_id, status, severity, search } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { ncr_number: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const ncrs = await NCR.findAll({
      where,
      order: [['raised_date', 'DESC']],
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });

    // Calculate days open
    const enriched = ncrs.map(n => {
      const days = n.status !== 'Closed'
        ? Math.floor((new Date() - new Date(n.raised_date)) / 86400000)
        : Math.floor((new Date(n.closed_date) - new Date(n.raised_date)) / 86400000);
      return { ...n.toJSON(), days_open: days };
    });

    res.json({ success: true, data: enriched, count: enriched.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const ncr = await NCR.findOne({
      where: { id: req.params.id, ...req.tenantScope },
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });
    if (!ncr) return res.status(404).json({ success: false, message: 'NCR not found.' });
    const days_open = ncr.status !== 'Closed'
      ? Math.floor((new Date() - new Date(ncr.raised_date)) / 86400000)
      : Math.floor((new Date(ncr.closed_date) - new Date(ncr.raised_date)) / 86400000);
    res.json({ success: true, data: { ...ncr.toJSON(), days_open } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      project_id, inspection_id, inspection_ref, description,
      severity, responsible_party, root_cause, corrective_action,
      preventive_action, due_date,
    } = req.body;

    // Check for repeat NCR on same project/root cause pattern.
    // Must be scoped to the current tenant — otherwise this leaks another
    // tenant's NCR history (root causes, severities) into this tenant's
    // "repeat NCR" detection, and in the worst case can throw if project_id
    // belongs to a different tenant than expected.
    const existingClosed = await NCR.findAll({
      where: { ...req.tenantScope, project_id, status: 'Closed', severity },
    });
    const is_repeat = existingClosed.some(n =>
      root_cause && n.root_cause &&
      n.root_cause.toLowerCase().includes(root_cause.toLowerCase().slice(0, 20))
    );

    const ncr_number = await generateNCRNumber(req.tenant.id);
    const ncr = await NCR.create({ ...req.tenantCreate,
      ncr_number, project_id, inspection_id, inspection_ref,
      description, severity, responsible_party, root_cause,
      corrective_action, preventive_action, due_date,
      raised_by: req.user.id, raised_by_name: req.user.name,
      raised_date: new Date().toISOString().split('T')[0],
      is_repeat,
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'NCR Raised', entityType: 'ncr',
      entityId: ncr.id, entityRef: ncr_number,
      description: `NCR raised: ${description.slice(0, 80)}`,
      afterValue: { ncr_number, severity, status: 'Open', is_repeat },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true, data: ncr,
      warning: is_repeat ? 'Repeat NCR detected — same root cause pattern found in closed NCRs on this project.' : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const ncr = await NCR.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!ncr) return res.status(404).json({ success: false, message: 'NCR not found.' });
    if (ncr.status === 'Closed') return res.status(400).json({ success: false, message: 'Closed NCRs cannot be modified.' });

    const before = { status: ncr.status, root_cause: ncr.root_cause };
    await ncr.update(req.body);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'NCR Updated', entityType: 'ncr',
      entityId: ncr.id, entityRef: ncr.ncr_number,
      description: `NCR ${ncr.ncr_number} updated`,
      beforeValue: before, afterValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: ncr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.close = async (req, res) => {
  try {
    const ncr = await NCR.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!ncr) return res.status(404).json({ success: false, message: 'NCR not found.' });
    if (ncr.status === 'Closed') return res.status(400).json({ success: false, message: 'Already closed.' });

    const { closure_evidence } = req.body;
    await ncr.update({
      status: 'Closed',
      closed_by: req.user.id,
      closed_date: new Date().toISOString().split('T')[0],
      closure_evidence: closure_evidence || ncr.closure_evidence,
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'NCR Closed', entityType: 'ncr',
      entityId: ncr.id, entityRef: ncr.ncr_number,
      description: `NCR ${ncr.ncr_number} closed by ${req.user.name}`,
      beforeValue: { status: 'Open' }, afterValue: { status: 'Closed', closed_by: req.user.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: ncr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const ncrs = await NCR.findAll({ where: req.tenantScope });
    const open = ncrs.filter(n => n.status !== 'Closed');
    const avgAge = open.length
      ? Math.round(open.reduce((s, n) => s + Math.floor((new Date() - new Date(n.raised_date)) / 86400000), 0) / open.length)
      : 0;
    res.json({
      success: true,
      data: {
        total: ncrs.length,
        open: open.length,
        closed: ncrs.filter(n => n.status === 'Closed').length,
        critical: ncrs.filter(n => n.severity === 'Critical' && n.status !== 'Closed').length,
        avgAgeOpen: avgAge,
        repeatCount: ncrs.filter(n => n.is_repeat).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
