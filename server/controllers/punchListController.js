const { PunchList, Project } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');
const { Op } = require('sequelize');

const generatePunchNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  // Scoped per tenant — an unscoped count caused two tenants' first punch
  // item to both compute PL-2026-0001, which throws a unique constraint
  // violation the moment the second tenant tries to create one.
  const count = await PunchList.count({
    where: { tenant_id: tenantId, punch_number: { [Op.like]: `PL-${year}-%` } },
  });
  return `PL-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ── GET ALL ───────────────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { project_id, status, category, discipline, system, milestone, priority } = req.query;
    const where = { ...req.tenantScope };
    if (project_id)  where.project_id  = project_id;
    if (status)      where.status      = status;
    if (category)    where.category    = category;
    if (discipline)  where.discipline  = discipline;
    if (system)       where.system      = system;
    if (milestone)   where.milestone   = milestone;
    if (priority)    where.priority    = priority;

    const items = await PunchList.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['priority', 'ASC'],
        ['raised_date', 'DESC'],
      ],
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });

    // Enrich with days open
    const enriched = items.map(i => {
      const end = i.closed_date ? new Date(i.closed_date) : new Date();
      const days_open = Math.floor((end - new Date(i.raised_date)) / 86400000);
      return { ...i.toJSON(), days_open };
    });

    res.json({ success: true, data: enriched, count: enriched.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ONE ───────────────────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    // findByPk has no way to add a tenant filter — switched to a
    // tenant-scoped findOne so a punch item ID from another tenant
    // can't be read.
    const item = await PunchList.findOne({
      where: { id: req.params.id, ...req.tenantScope },
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });
    if (!item) return res.status(404).json({ success: false, message: 'Punch item not found.' });
    const days_open = Math.floor(
      (item.closed_date ? new Date(item.closed_date) : new Date() - new Date(item.raised_date)) / 86400000
    );
    res.json({ success: true, data: { ...item.toJSON(), days_open } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      project_id, system, subsystem, area_location, discipline,
      category, description, reference_drawing, reference_spec,
      priority, responsible_contractor, responsible_person,
      due_date, milestone, walkdown_ref, tags,
    } = req.body;

    if (!project_id || !description) {
      return res.status(400).json({ success: false, message: 'Project and description are required.' });
    }

    const punch_number = await generatePunchNumber(req.tenant.id);

    const item = await PunchList.create({
      ...req.tenantCreate,
      punch_number, project_id, system, subsystem, area_location,
      discipline, category: category || 'A', description,
      reference_drawing, reference_spec, priority: priority || 'Medium',
      responsible_contractor, responsible_person, due_date,
      milestone: milestone || 'MC', walkdown_ref, tags: tags || [],
      raised_by: req.user.id,
      raised_by_name: req.user.name,
      raised_date: new Date().toISOString().split('T')[0],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Punch Item Raised', entityType: 'punch_list',
      entityId: item.id, entityRef: punch_number,
      description: `Category ${category} punch item raised: ${description.slice(0, 80)}`,
      afterValue: { punch_number, category, discipline, milestone },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const item = await PunchList.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'Punch item not found.' });
    if (item.status === 'Accepted') {
      return res.status(400).json({ success: false, message: 'Client-accepted items cannot be modified.' });
    }

    const before = { status: item.status, category: item.category };
    await item.update(req.body);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Punch Item Updated', entityType: 'punch_list',
      entityId: item.id, entityRef: item.punch_number,
      description: `${item.punch_number} updated`,
      beforeValue: before, afterValue: req.body,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── SUBMIT CLOSURE ────────────────────────────────────────────────────────────
exports.submitClosure = async (req, res) => {
  try {
    const item = await PunchList.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'Punch item not found.' });
    if (item.status === 'Accepted' || item.status === 'Closed') {
      return res.status(400).json({ success: false, message: 'Item already closed or accepted.' });
    }

    const { closure_comments, closure_evidence } = req.body;

    await item.update({
      status: 'Pending Verification',
      closure_comments,
      closure_evidence: closure_evidence || [],
      closed_by: req.user.id,
      closed_by_name: req.user.name,
      closed_date: new Date().toISOString().split('T')[0],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Closure Submitted', entityType: 'punch_list',
      entityId: item.id, entityRef: item.punch_number,
      description: `Closure submitted for ${item.punch_number} — pending client verification`,
      beforeValue: { status: item.status }, afterValue: { status: 'Pending Verification' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item, message: 'Closure submitted. Pending client verification.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ACCEPT / REJECT CLOSURE (client or QA manager) ───────────────────────────
exports.acceptClosure = async (req, res) => {
  try {
    const item = await PunchList.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'Punch item not found.' });

    const { accepted, rejection_reason } = req.body;

    if (accepted) {
      await item.update({
        status: 'Accepted',
        client_accepted: true,
        client_accepted_by: req.user.name,
        client_accepted_date: new Date().toISOString().split('T')[0],
      });
      await createAuditLog({
        tenantId: req.tenant.id,
        userId: req.user.id, userName: req.user.name, userRole: req.user.role,
        action: 'Closure Accepted', entityType: 'punch_list',
        entityId: item.id, entityRef: item.punch_number,
        description: `${item.punch_number} closure accepted by ${req.user.name}`,
        beforeValue: { status: 'Pending Verification' }, afterValue: { status: 'Accepted' },
        ipAddress: req.ip,
      });
    } else {
      await item.update({
        status: 'Rejected Closure',
        closure_comments: rejection_reason
          ? `${item.closure_comments || ''}\n[REJECTED by ${req.user.name}: ${rejection_reason}]`
          : item.closure_comments,
        client_accepted: false,
        closed_date: null,
      });
      await createAuditLog({
        tenantId: req.tenant.id,
        userId: req.user.id, userName: req.user.name, userRole: req.user.role,
        action: 'Closure Rejected', entityType: 'punch_list',
        entityId: item.id, entityRef: item.punch_number,
        description: `Closure rejected: ${rejection_reason || 'No reason given'}`,
        beforeValue: { status: 'Pending Verification' }, afterValue: { status: 'Rejected Closure' },
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── STATS ─────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { project_id } = req.query;
    // Was completely unscoped before — leaked every tenant's punch list
    // stats into every dashboard. Now always starts from req.tenantScope.
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;

    const items = await PunchList.findAll({ where });
    const today = new Date();

    const total      = items.length;
    const open       = items.filter(i => !['Accepted', 'Closed'].includes(i.status));
    const catA_open  = open.filter(i => i.category === 'A').length;
    const catB_open  = open.filter(i => i.category === 'B').length;
    const catC_open  = open.filter(i => i.category === 'C').length;
    const accepted   = items.filter(i => i.status === 'Accepted').length;
    const overdue    = open.filter(i => i.due_date && new Date(i.due_date) < today).length;
    const mcBlocking = items.filter(i => i.category === 'A' && i.milestone === 'MC' && !['Accepted','Closed'].includes(i.status)).length;

    // By discipline
    const byDiscipline = items.reduce((acc, i) => {
      acc[i.discipline] = acc[i.discipline] || { open: 0, closed: 0 };
      if (['Accepted', 'Closed'].includes(i.status)) acc[i.discipline].closed++;
      else acc[i.discipline].open++;
      return acc;
    }, {});

    // By system
    const bySystem = items.reduce((acc, i) => {
      const sys = i.system || 'Unassigned';
      acc[sys] = acc[sys] || { total: 0, open: 0, pct: 0 };
      acc[sys].total++;
      if (!['Accepted','Closed'].includes(i.status)) acc[sys].open++;
      acc[sys].pct = Math.round(((acc[sys].total - acc[sys].open) / acc[sys].total) * 100);
      return acc;
    }, {});

    // Completion percentage
    const completionPct = total ? Math.round((accepted / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        total, open: open.length, accepted, overdue,
        catA_open, catB_open, catC_open,
        mcBlocking, completionPct,
        byDiscipline, bySystem,
        mcClearance: catA_open === 0 ? 'CLEAR' : 'BLOCKED',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
