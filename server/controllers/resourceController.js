const { ITPItem, Material, Document, Welder, Equipment, AuditLog, Project, Inspection, NCR, User, Blaster, Painter } = require('../models');
const { createAuditLog } = require('../middleware/auditLogger');
const { Op } = require('sequelize');

// ── ITP CONTROLLER ────────────────────────────────────────────────────────────
exports.itpGetAll = async (req, res) => {
  try {
    const { project_id } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    const items = await ITPItem.findAll({ where, order: [['sequence', 'ASC']] });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.itpCreate = async (req, res) => {
  try {
    const item = await ITPItem.create({ ...req.tenantCreate, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.itpUpdate = async (req, res) => {
  try {
    const item = await ITPItem.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'ITP item not found.' });
    if (item.status === 'Complete') return res.status(400).json({ success: false, message: 'Cannot update completed items.' });

    const before = { activity: item.activity, acceptance_criteria: item.acceptance_criteria, responsibility: item.responsibility, is_hold_point: item.is_hold_point, is_witness_point: item.is_witness_point };
    const { activity, acceptance_criteria, responsibility, is_hold_point, is_witness_point } = req.body;
    const updates = {};
    if (activity !== undefined) updates.activity = activity;
    if (acceptance_criteria !== undefined) updates.acceptance_criteria = acceptance_criteria;
    if (responsibility !== undefined) updates.responsibility = responsibility;
    if (is_hold_point !== undefined) updates.is_hold_point = is_hold_point;
    if (is_witness_point !== undefined) updates.is_witness_point = is_witness_point;

    await item.update(updates);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'ITP Item Updated', entityType: 'itp',
      entityId: item.id, entityRef: item.activity,
      description: `ITP item updated: ${item.activity}`,
      beforeValue: before,
      afterValue: updates,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item, message: 'ITP item updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.itpSignOff = async (req, res) => {
  try {
    // Scoped findOne instead of findByPk — findByPk has no way to add a
    // tenant filter, so a valid ITP item ID from ANY tenant could be signed
    // off by a user from a different tenant. This was a cross-tenant write bug.
    const item = await ITPItem.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'ITP item not found.' });
    if (item.status === 'Complete') return res.status(400).json({ success: false, message: 'Already signed off.' });

    // Check upstream gates
    const upstream = await ITPItem.findAll({
      where: { ...req.tenantScope, project_id: item.project_id, sequence: { [Op.lt]: item.sequence } },
    });
    const blocked = upstream.some(u => u.is_hold_point && u.status !== 'Complete');
    if (blocked) return res.status(400).json({ success: false, message: 'Cannot sign off — upstream hold point not cleared.' });

    const { inspection_ref, sign_off_remarks } = req.body;
    await item.update({
      status: 'Complete',
      completed_date: new Date().toISOString().split('T')[0],
      completed_by: req.user.id,
      completed_by_name: req.user.name,
      inspection_ref,
      sign_off_remarks,
    });

    // Update downstream statuses
    const downstream = await ITPItem.findAll({
      where: { ...req.tenantScope, project_id: item.project_id, sequence: { [Op.gt]: item.sequence }, status: 'Blocked' },
    });
    for (const d of downstream) {
      if (!d.is_hold_point) await d.update({ status: 'Pending' });
    }

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Hold Point Released', entityType: 'itp',
      entityId: item.id, entityRef: item.activity,
      description: `Hold point released: ${item.activity} — ref: ${inspection_ref}`,
      beforeValue: { status: 'In Progress' }, afterValue: { status: 'Complete', signed_by: req.user.name },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item, message: 'Hold point released. Downstream steps unlocked.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── MATERIAL CONTROLLER ───────────────────────────────────────────────────────
exports.materialGetAll = async (req, res) => {
  try {
    const { project_id, status } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    if (status) where.status = status;
    const materials = await Material.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.materialCreate = async (req, res) => {
  try {
    // Material IDs must be unique per tenant, so the running count used to
    // generate the next ID also has to be scoped — otherwise tenant #2's
    // first material could collide with tenant #1's MAT-001.
    const count = await Material.count({ where: req.tenantScope });
    const material_id = `MAT-${String(count + 1).padStart(3, '0')}`;
    const material = await Material.create({
      ...req.tenantCreate,
      ...req.body, material_id,
      receiving_inspector_id: req.user.id,
    });
    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Material Registered', entityType: 'material',
      entityId: material.id, entityRef: material_id,
      description: `Material registered: ${req.body.grade} Heat# ${req.body.heat_number}`,
      afterValue: { material_id, grade: req.body.grade, status: 'Pending' },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.materialUpdateStatus = async (req, res) => {
  try {
    const material = await Material.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!material) return res.status(404).json({ success: false, message: 'Material not found.' });
    const before = { status: material.status };
    await material.update({ status: req.body.status, hold_reason: req.body.hold_reason });
    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Material Status Changed', entityType: 'material',
      entityId: material.id, entityRef: material.material_id,
      description: `Status changed from ${before.status} to ${req.body.status}`,
      beforeValue: before, afterValue: { status: req.body.status },
      ipAddress: req.ip,
    });
    res.json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DOCUMENT CONTROLLER ───────────────────────────────────────────────────────
exports.docGetAll = async (req, res) => {
  try {
    const { project_id, status, doc_type } = req.query;
    const where = { ...req.tenantScope };
    if (project_id) where.project_id = project_id;
    if (status) where.status = status;
    if (doc_type) where.doc_type = doc_type;
    const docs = await Document.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.docCreate = async (req, res) => {
  try {
    const doc = await Document.create({
      ...req.tenantCreate,
      ...req.body,
      author_id: req.user.id,
      author_name: req.user.name,
    });
    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Document Registered', entityType: 'document',
      entityId: doc.id, entityRef: doc.doc_number,
      description: `Document registered: ${doc.doc_number} ${doc.revision}`,
      afterValue: { doc_number: doc.doc_number, revision: doc.revision, status: 'Draft' },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.docApprove = async (req, res) => {
  try {
    const doc = await Document.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (doc.status === 'Approved') return res.status(400).json({ success: false, message: 'Already approved.' });

    await doc.update({
      status: 'Approved',
      approved_by_id: req.user.id,
      approved_by_name: req.user.name,
      approved_date: new Date().toISOString().split('T')[0],
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Document Approved', entityType: 'document',
      entityId: doc.id, entityRef: doc.doc_number,
      description: `${doc.doc_number} ${doc.revision} approved`,
      beforeValue: { status: 'Under Review' }, afterValue: { status: 'Approved' },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.docNewRevision = async (req, res) => {
  try {
    const original = await Document.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!original) return res.status(404).json({ success: false, message: 'Document not found.' });

    await original.update({ status: 'Superseded' });

    const revNum = parseInt(original.revision.replace('Rev ', '')) + 1;
    const newDoc = await Document.create({
      ...req.tenantCreate,
      doc_number: original.doc_number,
      title: original.title,
      doc_type: original.doc_type,
      project_id: original.project_id,
      revision: `Rev ${revNum}`,
      status: 'Draft',
      author_id: req.user.id,
      author_name: req.user.name,
      superseded_by: null,
      is_controlled: original.is_controlled,
      ...req.body,
    });

    await original.update({ superseded_by: newDoc.id });

    res.status(201).json({ success: true, data: newDoc, message: `New revision Rev ${revNum} created. Original superseded.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── WELDER CONTROLLER ─────────────────────────────────────────────────────────
exports.welderGetAll = async (req, res) => {
  try {
    const welders = await Welder.findAll({ where: req.tenantScope, order: [['name', 'ASC']] });
    const today = new Date();
    const enriched = welders.map(w => {
      const expiry = new Date(w.expiry_date);
      const daysToExpiry = Math.floor((expiry - today) / 86400000);
      return {
        ...w.toJSON(),
        days_to_expiry: daysToExpiry,
        expiry_alert: daysToExpiry <= 30 && daysToExpiry > 0 ? 'warning' : daysToExpiry <= 0 ? 'expired' : null,
      };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.welderCreate = async (req, res) => {
  try {
    const count = await Welder.count({ where: req.tenantScope });
    const welder_id = `W-${String(count + 1).padStart(3, '0')}`;
    const welder = await Welder.create({ ...req.tenantCreate, ...req.body, welder_id });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Welder Registered', entityType: 'welder',
      entityId: welder.id, entityRef: welder.stamp,
      description: `Welder registered: ${welder.name} (${welder.stamp})`,
      afterValue: { stamp: welder.stamp, process: welder.process, status: welder.status },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: welder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/welders/:id
 * Updates a welder's qualification record — used for:
 *  - Re-qualification (new wpq_reference, new expiry_date, status back to Active)
 *  - Status changes (Active → Suspended/Expired/Inactive)
 *  - Weld count / repair rate updates as new welds are logged elsewhere
 */
exports.welderUpdate = async (req, res) => {
  try {
    const welder = await Welder.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!welder) return res.status(404).json({ success: false, message: 'Welder not found.' });

    const before = { status: welder.status, expiry_date: welder.expiry_date, wpq_reference: welder.wpq_reference };

    // Whitelist updatable fields — never allow tenant_id or welder_id to be overwritten
    const {
      name, process, wpq_reference, status, expiry_date, total_welds, repair_rate, project_ids,
      // Process Qualification Test Parameters
      test_pipe_dia, test_plate_thk, test_position, test_filler_aws_no, test_filler_f_no,
      test_material_p_no, test_material_spec,
      // Qualified Parameter Range
      qual_process, qual_dia_thk, qual_f_no, qual_p_no, qual_position,
    } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (process !== undefined) updates.process = process;
    if (wpq_reference !== undefined) updates.wpq_reference = wpq_reference;
    if (status !== undefined) updates.status = status;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date;
    if (total_welds !== undefined) updates.total_welds = total_welds;
    if (repair_rate !== undefined) updates.repair_rate = repair_rate;
    if (project_ids !== undefined) updates.project_ids = project_ids;
    if (test_pipe_dia !== undefined) updates.test_pipe_dia = test_pipe_dia;
    if (test_plate_thk !== undefined) updates.test_plate_thk = test_plate_thk;
    if (test_position !== undefined) updates.test_position = test_position;
    if (test_filler_aws_no !== undefined) updates.test_filler_aws_no = test_filler_aws_no;
    if (test_filler_f_no !== undefined) updates.test_filler_f_no = test_filler_f_no;
    if (test_material_p_no !== undefined) updates.test_material_p_no = test_material_p_no;
    if (test_material_spec !== undefined) updates.test_material_spec = test_material_spec;
    if (qual_process !== undefined) updates.qual_process = qual_process;
    if (qual_dia_thk !== undefined) updates.qual_dia_thk = qual_dia_thk;
    if (qual_f_no !== undefined) updates.qual_f_no = qual_f_no;
    if (qual_p_no !== undefined) updates.qual_p_no = qual_p_no;
    if (qual_position !== undefined) updates.qual_position = qual_position;

    await welder.update(updates);

    const isRequalification = wpq_reference && wpq_reference !== before.wpq_reference;

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: isRequalification ? 'Welder Re-qualified' : 'Welder Updated',
      entityType: 'welder',
      entityId: welder.id, entityRef: welder.stamp,
      description: isRequalification
        ? `${welder.name} (${welder.stamp}) re-qualified — new WPQ ${wpq_reference}, expires ${expiry_date}`
        : `${welder.name} (${welder.stamp}) updated`,
      beforeValue: before,
      afterValue: updates,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: welder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── EQUIPMENT CONTROLLER ──────────────────────────────────────────────────────
exports.equipmentGetAll = async (req, res) => {
  try {
    const equipment = await Equipment.findAll({ where: req.tenantScope, order: [['name', 'ASC']] });
    const today = new Date();
    const enriched = equipment.map(e => {
      const calDue = new Date(e.calibration_due);
      const daysUntilDue = Math.floor((calDue - today) / 86400000);
      let status = e.status;
      if (daysUntilDue < 0) status = 'Overdue';
      else if (daysUntilDue <= 14) status = 'Due Soon';
      return { ...e.toJSON(), status, days_until_cal_due: daysUntilDue };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/equipment
 * Registers a new piece of inspection/test equipment into the calibration
 * register. This endpoint did not exist before — the register was read-only.
 */
exports.equipmentCreate = async (req, res) => {
  try {
    const count = await Equipment.count({ where: req.tenantScope });
    const equipment_id = `EQ-${String(count + 1).padStart(3, '0')}`;

    const equipment = await Equipment.create({
      ...req.tenantCreate,
      ...req.body,
      equipment_id,
      status: req.body.status || 'Calibrated',
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Equipment Registered', entityType: 'equipment',
      entityId: equipment.id, entityRef: equipment_id,
      description: `Equipment registered: ${equipment.name} (S/N ${equipment.serial_number || 'N/A'})`,
      afterValue: { equipment_id, name: equipment.name, calibration_due: equipment.calibration_due },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/equipment/:id/calibrate
 * Records a new calibration event — sets last_calibration to today,
 * advances calibration_due, attaches the cert reference, and resets
 * status to 'Calibrated'. This is the primary way the register gets
 * updated day-to-day (vs. equipmentUpdate for editing other fields).
 */
exports.equipmentCalibrate = async (req, res) => {
  try {
    const equipment = await Equipment.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!equipment) return res.status(404).json({ success: false, message: 'Equipment not found.' });

    const { calibration_due, calibration_cert } = req.body;
    if (!calibration_due) {
      return res.status(400).json({ success: false, message: 'calibration_due (next due date) is required.' });
    }

    const before = { status: equipment.status, calibration_due: equipment.calibration_due };

    await equipment.update({
      last_calibration: new Date().toISOString().split('T')[0],
      calibration_due,
      calibration_cert: calibration_cert || equipment.calibration_cert,
      status: 'Calibrated',
    });

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Equipment Calibrated', entityType: 'equipment',
      entityId: equipment.id, entityRef: equipment.equipment_id,
      description: `${equipment.name} (${equipment.equipment_id}) calibrated — next due ${calibration_due}`,
      beforeValue: before,
      afterValue: { status: 'Calibrated', calibration_due },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: equipment, message: 'Calibration recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/equipment/:id
 * General field updates — assignment to a project, utilisation, status
 * (e.g. manually marking 'Quarantined' if damaged outside the cal cycle).
 */
exports.equipmentUpdate = async (req, res) => {
  try {
    const equipment = await Equipment.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!equipment) return res.status(404).json({ success: false, message: 'Equipment not found.' });

    const before = { status: equipment.status };
    const { name, equipment_type, serial_number, status, assigned_project_id, utilisation_pct } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (equipment_type !== undefined) updates.equipment_type = equipment_type;
    if (serial_number !== undefined) updates.serial_number = serial_number;
    if (status !== undefined) updates.status = status;
    if (assigned_project_id !== undefined) updates.assigned_project_id = assigned_project_id;
    if (utilisation_pct !== undefined) updates.utilisation_pct = utilisation_pct;

    await equipment.update(updates);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Equipment Updated', entityType: 'equipment',
      entityId: equipment.id, entityRef: equipment.equipment_id,
      description: `${equipment.name} (${equipment.equipment_id}) updated`,
      beforeValue: before, afterValue: updates,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BLASTER CONTROLLER ─────────────────────────────────────────────────────────
exports.blasterGetAll = async (req, res) => {
  try {
    const items = await Blaster.findAll({ where: req.tenantScope });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.blasterCreate = async (req, res) => {
  try {
    const item = await Blaster.create({ ...req.tenantCreate, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.blasterUpdate = async (req, res) => {
  try {
    const item = await Blaster.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'Blaster not found.' });

    const before = { name: item.name, status: item.status };
    const { name, stamp, process, qualification_reference, status, expiry_date, test_abrasive_type, test_surface_preparation, test_blast_profile, test_material_spec, qual_abrasive_type, qual_surface_preparation, qual_blast_profile, qual_material_spec } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (stamp !== undefined) updates.stamp = stamp;
    if (process !== undefined) updates.process = process;
    if (qualification_reference !== undefined) updates.qualification_reference = qualification_reference;
    if (status !== undefined) updates.status = status;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date;
    if (test_abrasive_type !== undefined) updates.test_abrasive_type = test_abrasive_type;
    if (test_surface_preparation !== undefined) updates.test_surface_preparation = test_surface_preparation;
    if (test_blast_profile !== undefined) updates.test_blast_profile = test_blast_profile;
    if (test_material_spec !== undefined) updates.test_material_spec = test_material_spec;
    if (qual_abrasive_type !== undefined) updates.qual_abrasive_type = qual_abrasive_type;
    if (qual_surface_preparation !== undefined) updates.qual_surface_preparation = qual_surface_preparation;
    if (qual_blast_profile !== undefined) updates.qual_blast_profile = qual_blast_profile;
    if (qual_material_spec !== undefined) updates.qual_material_spec = qual_material_spec;

    await item.update(updates);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Blaster Updated', entityType: 'blaster',
      entityId: item.id, entityRef: item.stamp,
      description: `Blaster updated: ${item.name}`,
      beforeValue: before, afterValue: updates,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PAINTER CONTROLLER ─────────────────────────────────────────────────────────
exports.painterGetAll = async (req, res) => {
  try {
    const items = await Painter.findAll({ where: req.tenantScope });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.painterCreate = async (req, res) => {
  try {
    const item = await Painter.create({ ...req.tenantCreate, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.painterUpdate = async (req, res) => {
  try {
    const item = await Painter.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!item) return res.status(404).json({ success: false, message: 'Painter not found.' });

    const before = { name: item.name, status: item.status };
    const { name, stamp, process, qualification_reference, status, expiry_date, test_coating_system, test_application_method, test_dft_range, test_material_spec, qual_coating_system, qual_application_method, qual_dft_range, qual_material_spec } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (stamp !== undefined) updates.stamp = stamp;
    if (process !== undefined) updates.process = process;
    if (qualification_reference !== undefined) updates.qualification_reference = qualification_reference;
    if (status !== undefined) updates.status = status;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date;
    if (test_coating_system !== undefined) updates.test_coating_system = test_coating_system;
    if (test_application_method !== undefined) updates.test_application_method = test_application_method;
    if (test_dft_range !== undefined) updates.test_dft_range = test_dft_range;
    if (test_material_spec !== undefined) updates.test_material_spec = test_material_spec;
    if (qual_coating_system !== undefined) updates.qual_coating_system = qual_coating_system;
    if (qual_application_method !== undefined) updates.qual_application_method = qual_application_method;
    if (qual_dft_range !== undefined) updates.qual_dft_range = qual_dft_range;
    if (qual_material_spec !== undefined) updates.qual_material_spec = qual_material_spec;

    await item.update(updates);

    await createAuditLog({
      tenantId: req.tenant.id,
      userId: req.user.id, userName: req.user.name, userRole: req.user.role,
      action: 'Painter Updated', entityType: 'painter',
      entityId: item.id, entityRef: item.stamp,
      description: `Painter updated: ${item.name}`,
      beforeValue: before, afterValue: updates,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── AUDIT LOG CONTROLLER ──────────────────────────────────────────────────────
exports.auditGetAll = async (req, res) => {
  try {
    const { entity_type, user_id, action, limit = 100, offset = 0 } = req.query;
    const where = { ...req.tenantScope };
    if (entity_type) where.entity_type = entity_type;
    if (user_id) where.user_id = user_id;
    if (action) where.action = { [Op.iLike]: `%${action}%` };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ success: true, data: rows, total: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DASHBOARD CONTROLLER ──────────────────────────────────────────────────────
exports.dashboardStats = async (req, res) => {
  try {
    const { PunchList } = require('../models');
    const { project_id } = req.query;

    // Every query here MUST be scoped to req.tenantScope. Without it, the
    // dashboard aggregates data across every tenant in the database — this
    // was the root cause of newly created projects/records appearing to
    // "not show up" correctly: the totals were a blend of all tenants, so a
    // single new project barely moved numbers that included other companies'
    // data, and worse, it leaked one tenant's record counts to another.

    // If project_id is provided, filter by project as well
    const projectScope = project_id ? { ...req.tenantScope, project_id } : req.tenantScope;

    const [projects, inspections, ncrs, welders, equipment, docs, punchItems] = await Promise.all([
      Project.findAll({ where: projectScope, attributes: ['id', 'status', 'completion_pct'] }),
      Inspection.findAll({ where: projectScope, attributes: ['result', 'inspection_type', 'project_id', 'created_at'] }),
      NCR.findAll({ where: projectScope, attributes: ['status', 'severity', 'raised_date', 'due_date', 'is_repeat'] }),
      Welder.findAll({ where: req.tenantScope, attributes: ['status', 'expiry_date', 'repair_rate'] }),
      Equipment.findAll({ where: req.tenantScope, attributes: ['status', 'calibration_due', 'utilisation_pct'] }),
      Document.findAll({ where: projectScope, attributes: ['status'] }),
      PunchList.findAll({ where: projectScope, attributes: ['status', 'category', 'milestone', 'due_date'] }),
    ]);

    const total = inspections.length;
    const accepted = inspections.filter(i => i.result === 'Accepted').length;
    const openNCRs = ncrs.filter(n => n.status !== 'Closed');
    const today = new Date();

    const overdueNCRs = openNCRs.filter(n => n.due_date && new Date(n.due_date) < today);
    const overdueEq = equipment.filter(e => {
      const d = new Date(e.calibration_due);
      return d < today;
    });

    res.json({
      success: true,
      data: {
        projects: {
          total: projects.length,
          active: projects.filter(p => p.status === 'Active').length,
          onHold: projects.filter(p => p.status === 'On Hold').length,
        },
        inspections: {
          total,
          passRate: total ? Math.round(accepted / total * 100) : 0,
          accepted,
          rejected: inspections.filter(i => i.result === 'Rejected').length,
          conditional: inspections.filter(i => i.result === 'Conditional').length,
        },
        ncrs: {
          total: ncrs.length,
          open: openNCRs.length,
          critical: openNCRs.filter(n => n.severity === 'Critical').length,
          overdue: overdueNCRs.length,
          repeatCount: ncrs.filter(n => n.is_repeat).length,
        },
        welders: {
          total: welders.length,
          active: welders.filter(w => w.status === 'Active').length,
          expired: welders.filter(w => w.status === 'Expired' || w.status === 'Suspended').length,
          avgRepairRate: welders.length
            ? (welders.reduce((s, w) => s + parseFloat(w.repair_rate || 0), 0) / welders.length).toFixed(2)
            : 0,
        },
        equipment: {
          total: equipment.length,
          calibrated: equipment.filter(e => new Date(e.calibration_due) > today).length,
          overdue: overdueEq.length,
        },
        documents: {
          total: docs.length,
          approved: docs.filter(d => d.status === 'Approved').length,
          underReview: docs.filter(d => d.status === 'Under Review').length,
        },
        punch: {
          total: punchItems.length,
          open: punchItems.filter(p => !['Accepted', 'Closed'].includes(p.status)).length,
          accepted: punchItems.filter(p => p.status === 'Accepted').length,
          catA_open: punchItems.filter(p => p.category === 'A' && !['Accepted', 'Closed'].includes(p.status)).length,
          catB_open: punchItems.filter(p => p.category === 'B' && !['Accepted', 'Closed'].includes(p.status)).length,
          mcBlocking: punchItems.filter(p => p.category === 'A' && p.milestone === 'MC' && !['Accepted', 'Closed'].includes(p.status)).length,
          completionPct: punchItems.length ? Math.round(punchItems.filter(p => p.status === 'Accepted').length / punchItems.length * 100) : 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── USERS (used by routes/index.js re-export, kept for completeness) ─────────
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: req.tenantScope,
      attributes: { exclude: ['password', 'invite_token'] },
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── INSPECTOR WORKLOAD CAPACITY ───────────────────────────────────────────────
// Role-based default max concurrent active inspections, used whenever a user
// doesn't have an explicit max_active_inspections override set by an admin.
const ROLE_DEFAULT_CAPACITY = {
  system_admin: 6,
  quality_manager: 8,
  qa_engineer: 7,
  qc_inspector: 6,
  welding_inspector: 8,
  ndt_technician: 7,
  document_controller: 6,
  client_representative: 6,
};

const ROLE_LABELS = {
  system_admin: 'System Administrator',
  quality_manager: 'Quality Manager',
  qa_engineer: 'QA Engineer',
  qc_inspector: 'QC Inspector',
  welding_inspector: 'Welding Inspector',
  ndt_technician: 'NDT Technician',
  document_controller: 'Document Controller',
  client_representative: 'Client Representative',
};

// Roles that actually carry inspection workload — client reps and document
// controllers don't get assigned inspections, so they're excluded from the
// capacity board entirely rather than showing a meaningless 0%.
const WORKLOAD_ROLES = [
  'qc_inspector', 'welding_inspector', 'ndt_technician', 'qa_engineer', 'quality_manager',
];

// Inspection statuses that represent work still in the inspector's queue.
// Approved/Rejected reports are closed out and no longer occupy capacity.
const ACTIVE_INSPECTION_STATUSES = ['Draft', 'Submitted'];

exports.getInspectorWorkload = async (req, res) => {
  try {
    const inspectors = await User.findAll({
      where: { ...req.tenantScope, is_active: true, role: { [Op.in]: WORKLOAD_ROLES } },
      attributes: ['id', 'name', 'role', 'initials', 'max_active_inspections'],
      order: [['name', 'ASC']],
    });

    // Single grouped query for active inspection counts per inspector, instead
    // of one COUNT per inspector — keeps this endpoint fast regardless of team size.
    const counts = await Inspection.findAll({
      where: {
        ...req.tenantScope,
        inspector_id: { [Op.in]: inspectors.map(i => i.id) },
        status: { [Op.in]: ACTIVE_INSPECTION_STATUSES },
      },
      attributes: ['inspector_id'],
      raw: true,
    });
    const activeCountByInspector = {};
    counts.forEach(c => {
      activeCountByInspector[c.inspector_id] = (activeCountByInspector[c.inspector_id] || 0) + 1;
    });

    const data = inspectors.map(i => {
      const active = activeCountByInspector[i.id] || 0;
      const max = i.max_active_inspections || ROLE_DEFAULT_CAPACITY[i.role] || 6;
      const load = max > 0 ? Math.round((active / max) * 100) : 0;
      return {
        id: i.id,
        name: i.name,
        role: i.role,
        roleLabel: ROLE_LABELS[i.role] || i.role,
        init: i.initials || i.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3),
        active,
        max,
        load,
        overloaded: load >= 90,
        nearCapacity: load >= 75 && load < 90,
      };
    }).sort((a, b) => b.load - a.load);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.setUserCapacity = async (req, res) => {
  try {
    const { max_active_inspections } = req.body;
    if (max_active_inspections !== null && (!Number.isInteger(max_active_inspections) || max_active_inspections < 1)) {
      return res.status(400).json({ success: false, message: 'max_active_inspections must be a positive integer or null to use the role default.' });
    }
    const user = await User.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await user.update({ max_active_inspections });
    res.json({ success: true, data: user.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
