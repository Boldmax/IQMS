const { QualityPlan, Project } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');

const generatePlanNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  const count = await QualityPlan.count({
    where: { tenant_id: tenantId, plan_number: { [require('sequelize').Op.like]: `QP-${year}-%` } },
  });
  return `QP-${year}-${String(count + 1).padStart(3, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { project_id, status } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    if (status) where.status = status;

    const plans = await QualityPlan.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const plan = await QualityPlan.findOne({
      where: { id: req.params.id, ...req.tenantScope },
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });
    if (!plan) return res.status(404).json({ success: false, message: 'Quality Plan not found.' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      project_id, plan_name, quality_objectives, scope_of_work,
      applicable_standards, document_references, inspection_requirements,
      acceptance_criteria, roles_responsibilities, qc_procedures,
      testing_requirements, notes,
    } = req.body;

    if (!plan_name || !plan_name.trim()) {
      return res.status(400).json({ success: false, message: 'Plan name is required.' });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!project_id || !UUID_RE.test(project_id)) {
      return res.status(400).json({ success: false, message: 'A valid project must be selected.' });
    }

    // Verify project belongs to tenant
    const project = await Project.findOne({ where: { id: project_id, ...req.tenantScope } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const plan_number = await generatePlanNumber(req.tenant.id);
    const plan = await QualityPlan.create({
      ...req.tenantCreate,
      plan_number,
      project_id,
      plan_name,
      quality_objectives,
      scope_of_work,
      applicable_standards: applicable_standards || [],
      document_references: document_references || {},
      inspection_requirements: inspection_requirements || [],
      acceptance_criteria,
      roles_responsibilities: roles_responsibilities || {},
      qc_procedures: qc_procedures || [],
      testing_requirements: testing_requirements || [],
      notes,
      prepared_by: req.user.id,
      prepared_by_name: req.user.name,
      prepared_date: new Date().toISOString().split('T')[0],
      revision_history: [{
        version: '1.0',
        date: new Date().toISOString().split('T')[0],
        changed_by: req.user.name,
        changes: 'Initial creation',
      }],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Quality Plan Created', entityType: 'quality_plan',
      entityId: plan.id, entityRef: plan_number,
      description: `Quality Plan created: ${plan_name}`,
      afterValue: { plan_number, status: 'Draft' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const plan = await QualityPlan.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!plan) return res.status(404).json({ success: false, message: 'Quality Plan not found.' });

    const beforeValue = plan.toJSON();
    const newVersion = incrementVersion(plan.version);

    const updatedPlan = await plan.update({
      ...req.body,
      version: newVersion,
      revision_history: [
        ...plan.revision_history,
        {
          version: newVersion,
          date: new Date().toISOString().split('T')[0],
          changed_by: req.user.name,
          changes: 'Plan updated',
        },
      ],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Quality Plan Updated', entityType: 'quality_plan',
      entityId: plan.id, entityRef: plan.plan_number,
      description: `Quality Plan updated to version ${newVersion}`,
      beforeValue,
      afterValue: { version: newVersion, status: updatedPlan.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updatedPlan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const plan = await QualityPlan.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!plan) return res.status(404).json({ success: false, message: 'Quality Plan not found.' });
    if (plan.status === 'Approved') return res.status(400).json({ success: false, message: 'Plan already approved.' });

    const updatedPlan = await plan.update({
      status: 'Approved',
      reviewed_by: req.user.id,
      reviewed_by_name: req.user.name,
      reviewed_date: new Date().toISOString().split('T')[0],
      approved_by: req.user.id,
      approved_by_name: req.user.name,
      approved_date: new Date().toISOString().split('T')[0],
      effective_date: new Date().toISOString().split('T')[0],
      revision_history: [
        ...plan.revision_history,
        {
          version: plan.version,
          date: new Date().toISOString().split('T')[0],
          changed_by: req.user.name,
          changes: 'Plan approved',
        },
      ],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Quality Plan Approved', entityType: 'quality_plan',
      entityId: plan.id, entityRef: plan.plan_number,
      description: `Quality Plan approved by ${req.user.name}`,
      beforeValue: { status: plan.status },
      afterValue: { status: 'Approved' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updatedPlan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const plan = await QualityPlan.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!plan) return res.status(404).json({ success: false, message: 'Quality Plan not found.' });
    if (plan.status === 'Approved') return res.status(400).json({ success: false, message: 'Cannot delete approved plan.' });

    await plan.destroy();

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Quality Plan Deleted', entityType: 'quality_plan',
      entityId: plan.id, entityRef: plan.plan_number,
      description: `Quality Plan deleted: ${plan.plan_name}`,
      beforeValue: { plan_number: plan.plan_number, status: plan.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Quality Plan deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function incrementVersion(version) {
  const parts = version.split('.');
  const minor = parseInt(parts[1] || 0) + 1;
  return `${parts[0]}.${minor}`;
}
