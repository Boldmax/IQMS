const { Inspection, Project, User, AuditLog } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');
const { Op } = require('sequelize');

// Code-aware acceptance validation
const validateMeasurements = (type, measurements) => {
  const violations = [];
  if (!measurements || Object.keys(measurements).length === 0) return violations;

  if (type === 'Weld Visual') {
    if (measurements.undercut !== undefined && measurements.undercut_limit !== undefined) {
      if (parseFloat(measurements.undercut) > parseFloat(measurements.undercut_limit)) {
        violations.push({
          parameter: 'Undercut depth',
          measured: measurements.undercut,
          limit: measurements.undercut_limit,
          standard: 'API 1104 Cl.9.3.2',
          pass: false,
        });
      }
    }
    if (measurements.porosity_diameter !== undefined) {
      if (parseFloat(measurements.porosity_diameter) > 3.2) {
        violations.push({
          parameter: 'Porosity diameter',
          measured: measurements.porosity_diameter,
          limit: 3.2,
          standard: 'API 1104 Cl.9.3.3',
          pass: false,
        });
      }
    }
  }

  if (type === 'DFT Measurement') {
    if (measurements.dft_min !== undefined && measurements.dft_required !== undefined) {
      if (parseFloat(measurements.dft_min) < parseFloat(measurements.dft_required)) {
        violations.push({
          parameter: 'DFT Minimum',
          measured: measurements.dft_min,
          limit: measurements.dft_required,
          unit: 'µm',
          standard: 'NACE SP0188 / Project QCP',
          pass: false,
        });
      }
    }
    if (measurements.spots_below !== undefined && measurements.spots_below > 0) {
      violations.push({
        parameter: 'Spots below minimum DFT',
        measured: measurements.spots_below,
        limit: 0,
        standard: 'QCP-COAT-002',
        pass: false,
      });
    }
  }

  if (type === 'Holiday Test') {
    if (measurements.holidays !== undefined && measurements.holidays > 0) {
      violations.push({
        parameter: 'Holiday count',
        measured: measurements.holidays,
        limit: 0,
        standard: 'NACE SP0188',
        pass: false,
      });
    }
  }

  return violations;
};

const generateReportNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  // Must be scoped per tenant. Unscoped, two tenants' first inspection of
  // the year both compute IR-2026-0001 — the second one to insert throws
  // a unique constraint violation. This was the actual cause of the
  // "New Inspection" button failing.
  const count = await Inspection.count({
    where: { tenant_id: tenantId, report_number: { [Op.like]: `IR-${year}-%` } },
  });
  return `IR-${year}-${String(count + 1).padStart(4, '0')}`;
};

exports.getAll = async (req, res) => {
  try {
    const { project_id, result, type, inspector_id, search, limit = 50, offset = 0 } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    if (result) where.result = result;
    if (type) where.inspection_type = type;
    if (inspector_id) where.inspector_id = inspector_id;
    if (search) {
      where[Op.or] = [
        { component: { [Op.iLike]: `%${search}%` } },
        { inspection_type: { [Op.iLike]: `%${search}%` } },
        { remarks: { [Op.iLike]: `%${search}%` } },
        { reference_code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: inspections, count } = await Inspection.findAndCountAll({
      where,
      order: [['inspection_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });

    res.json({ success: true, data: inspections, count, total: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    // findByPk has no way to add a tenant filter — a valid inspection ID
    // from any tenant could be read by a user from a different tenant.
    const inspection = await Inspection.findOne({
      where: { id: req.params.id, ...req.tenantScope },
      include: [{ model: Project, as: 'project', attributes: ['project_number', 'name'] }],
    });
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found.' });
    res.json({ success: true, data: inspection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      project_id, inspection_type, component, location,
      inspection_date, procedure_reference, acceptance_criteria,
      result, severity, findings, measurements, itp_item_id,
    } = req.body;

    const report_number = await generateReportNumber(req.tenant.id);
    const code_violations = validateMeasurements(inspection_type, measurements);

    // Auto-flag result based on violations
    let finalResult = result;
    if (code_violations.length > 0 && result === 'Accepted') {
      finalResult = 'Conditional';
    }

    const inspection = await Inspection.create({ ...req.tenantCreate,
      report_number, project_id, inspection_type, component, location,
      inspector_id: req.user.id, inspector_name: req.user.name,
      inspection_date, procedure_reference, acceptance_criteria,
      result: finalResult, severity, findings,
      measurements: measurements || {}, code_violations,
      status: 'Submitted', itp_item_id,
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Inspection Submitted', entityType: 'inspection',
      entityId: inspection.id, entityRef: report_number,
      description: `${inspection_type} submitted for ${component}`,
      afterValue: { report_number, result: finalResult, violations: code_violations.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: inspection,
      warnings: code_violations.length > 0 ? `${code_violations.length} code violation(s) auto-detected` : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const inspection = await Inspection.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!inspection) return res.status(404).json({ success: false, message: 'Not found.' });
    if (inspection.is_locked) return res.status(400).json({ success: false, message: 'Record already locked.' });

    await inspection.update({
      status: 'Approved',
      approved_by: req.user.id,
      approved_at: new Date(),
      is_locked: true,
      locked_at: new Date(),
      locked_by: req.user.id,
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Record Locked', entityType: 'inspection',
      entityId: inspection.id, entityRef: inspection.report_number,
      description: `Approved and locked by ${req.user.name}`,
      beforeValue: { status: 'Submitted', is_locked: false },
      afterValue: { status: 'Approved', is_locked: true },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: inspection, message: 'Inspection approved and record locked.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const inspections = await Inspection.findAll({ where: req.tenantScope, attributes: ['result', 'inspection_type'] });
    const byResult = inspections.reduce((acc, i) => {
      acc[i.result] = (acc[i.result] || 0) + 1;
      return acc;
    }, {});
    const byType = inspections.reduce((acc, i) => {
      acc[i.inspection_type] = (acc[i.inspection_type] || 0) + 1;
      return acc;
    }, {});
    const total = inspections.length;
    res.json({
      success: true,
      data: {
        total, byResult, byType,
        passRate: total ? Math.round((byResult.Accepted || 0) / total * 100) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
