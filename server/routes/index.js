const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const { protect, authorize, hasPermission, requireFeature, requireOwner } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');

const authCtrl    = require('../controllers/authController');
const tenantCtrl  = require('../controllers/tenantController');
const projectCtrl = require('../controllers/projectController');
const inspCtrl    = require('../controllers/inspectionController');
const ncrCtrl     = require('../controllers/ncrController');
const resCtrl     = require('../controllers/resourceController');
const plCtrl      = require('../controllers/punchListController');
const qpCtrl       = require('../controllers/qualityPlanController');
const aiCtrl      = require('../controllers/aiController');

// In-memory storage — files are forwarded straight to the Anthropic API as
// base64 and never written to disk. 10MB cap covers a scanned WPQ page comfortably.
const aiUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// AI features hit a paid external API per call — separate, tighter rate limit
// so a runaway client loop can't rack up API costs unnoticed.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many AI requests. Wait a moment and try again.' },
});

// Tighter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

// ── PUBLIC ────────────────────────────────────────────────────────────────────
// Signup / onboarding — creates tenant + owner in one shot
router.post('/onboard',       authLimiter, tenantCtrl.onboard);
router.post('/accept-invite', authLimiter, tenantCtrl.acceptInvite);
router.post('/auth/login',    authLimiter, authCtrl.login);

// ── PROTECTED BASELINE ────────────────────────────────────────────────────────
// All routes below require a valid JWT + active tenant
// tenantScope injects req.tenantScope and req.tenantCreate for DB queries

router.use(protect, tenantScope);

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.get('/auth/me',        authCtrl.getMe);
router.patch('/auth/profile', authCtrl.updateProfile);

// ── TENANT ────────────────────────────────────────────────────────────────────
router.get('/tenant/me',         tenantCtrl.getMyTenant);
router.patch('/tenant/settings', requireOwner, tenantCtrl.updateSettings);
router.post('/tenant/invite',    requireOwner, tenantCtrl.inviteUser);
router.post('/tenant/upgrade',   requireOwner, tenantCtrl.upgradePlan);

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
router.get('/dashboard/stats', resCtrl.dashboardStats);

// ── INSPECTOR WORKLOAD CAPACITY ────────────────────────────────────────────────
router.get('/inspector-workload', resCtrl.getInspectorWorkload);

// ── AI FEATURES ────────────────────────────────────────────────────────────────
router.post('/ai/ncr-assist', aiLimiter, aiCtrl.ncrAssist);
router.post('/ai/welder-extract', aiLimiter, aiUpload.single('file'), aiCtrl.welderExtract);

// ── PROJECTS ──────────────────────────────────────────────────────────────────
router.get('/projects',           projectCtrl.getAll);
router.post('/projects',          hasPermission('project', 'create'), projectCtrl.create);
router.get('/projects/:id',       projectCtrl.getOne);
router.patch('/projects/:id',     hasPermission('project', 'create'), projectCtrl.update);
router.get('/projects/:id/stats', projectCtrl.getStats);

// ── INSPECTIONS ───────────────────────────────────────────────────────────────
router.get('/inspections',              inspCtrl.getAll);
router.post('/inspections',             hasPermission('inspection', 'create'), inspCtrl.create);
router.get('/inspections/stats',        inspCtrl.getStats);
router.get('/inspections/:id',          inspCtrl.getOne);
router.post('/inspections/:id/approve', hasPermission('inspection', 'create'), inspCtrl.approve);

// ── NCRs ──────────────────────────────────────────────────────────────────────
router.get('/ncrs',            ncrCtrl.getAll);
router.post('/ncrs',           hasPermission('ncr', 'create'), ncrCtrl.create);
router.get('/ncrs/stats',      ncrCtrl.getStats);
router.get('/ncrs/:id',        ncrCtrl.getOne);
router.patch('/ncrs/:id',      hasPermission('ncr', 'create'), ncrCtrl.update);
router.post('/ncrs/:id/close', hasPermission('ncr', 'create'), ncrCtrl.close);

// ── ITP ───────────────────────────────────────────────────────────────────────
router.get('/itp',              resCtrl.itpGetAll);
router.post('/itp',             hasPermission('itp', 'create'), resCtrl.itpCreate);
router.patch('/itp/:id',        hasPermission('itp', 'create'), resCtrl.itpUpdate);
router.post('/itp/:id/signoff', hasPermission('itp', 'create'), resCtrl.itpSignOff);

// ── MATERIALS (starter+ only) ─────────────────────────────────────────────────
router.get('/materials',              requireFeature('materials'), resCtrl.materialGetAll);
router.post('/materials',             requireFeature('materials'), hasPermission('material', 'create'), resCtrl.materialCreate);
router.patch('/materials/:id/status', requireFeature('materials'), hasPermission('material', 'create'), resCtrl.materialUpdateStatus);

// ── DOCUMENTS (starter+ only) ─────────────────────────────────────────────────
router.get('/documents',                   requireFeature('documents'), resCtrl.docGetAll);
router.post('/documents',                  requireFeature('documents'), hasPermission('document', 'create'), resCtrl.docCreate);
router.post('/documents/:id/approve',      requireFeature('documents'), hasPermission('document', 'create'), resCtrl.docApprove);
router.post('/documents/:id/new-revision', requireFeature('documents'), hasPermission('document', 'create'), resCtrl.docNewRevision);

// ── WELDERS (pro+ only) ───────────────────────────────────────────────────────
router.get('/welders',      requireFeature('welders'), resCtrl.welderGetAll);
router.post('/welders',     requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.welderCreate);
router.patch('/welders/:id', requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.welderUpdate);

// ── BLASTERS (pro+ only) ─────────────────────────────────────────────────────
router.get('/blasters',     requireFeature('welders'), resCtrl.blasterGetAll);
router.post('/blasters',    requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.blasterCreate);
router.patch('/blasters/:id', requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.blasterUpdate);

// ── PAINTERS (pro+ only) ─────────────────────────────────────────────────────
router.get('/painters',     requireFeature('welders'), resCtrl.painterGetAll);
router.post('/painters',    requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.painterCreate);
router.patch('/painters/:id', requireFeature('welders'), hasPermission('welder', 'create'), resCtrl.painterUpdate);

// ── EQUIPMENT (pro+ only) ─────────────────────────────────────────────────────
router.get('/equipment',              requireFeature('equipment'), resCtrl.equipmentGetAll);
router.post('/equipment',             requireFeature('equipment'), hasPermission('equipment', 'create'), resCtrl.equipmentCreate);
router.patch('/equipment/:id',        requireFeature('equipment'), hasPermission('equipment', 'create'), resCtrl.equipmentUpdate);
router.post('/equipment/:id/calibrate', requireFeature('equipment'), hasPermission('equipment', 'create'), resCtrl.equipmentCalibrate);

// ── AUDIT LOG (starter+ only) ─────────────────────────────────────────────────
router.get('/audit', requireFeature('audit_trail'), hasPermission('audit', 'read'), resCtrl.auditGetAll);

// ── PUNCH LIST ────────────────────────────────────────────────────────────────
router.get('/punch',          plCtrl.getAll);
router.post('/punch',         hasPermission('inspection', 'create'), plCtrl.create);
router.get('/punch/stats',    plCtrl.getStats);
router.get('/punch/:id',      plCtrl.getOne);
router.patch('/punch/:id',    hasPermission('inspection', 'create'), plCtrl.update);
router.post('/punch/:id/close',  hasPermission('inspection', 'create'), plCtrl.submitClosure);
router.post('/punch/:id/accept', hasPermission('ncr', 'create'), plCtrl.acceptClosure);

// ── QUALITY PLANS ─────────────────────────────────────────────────────────────
router.get('/quality-plans',           qpCtrl.getAll);
router.post('/quality-plans',          hasPermission('quality_plan', 'create'), qpCtrl.create);
router.get('/quality-plans/:id',       qpCtrl.getOne);
router.patch('/quality-plans/:id',     hasPermission('quality_plan', 'create'), qpCtrl.update);
router.post('/quality-plans/:id/approve', hasPermission('quality_plan', 'create'), qpCtrl.approve);
router.delete('/quality-plans/:id',    hasPermission('quality_plan', 'create'), qpCtrl.delete);

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────
const { User } = require('../models');

router.get('/users', authorize('system_admin', 'quality_manager'), async (req, res) => {
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
});

router.patch('/users/:id/toggle', authorize('system_admin', 'quality_manager'), async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, ...req.tenantScope } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.is_tenant_owner) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate the account owner.' });
    }
    await user.update({ is_active: !user.is_active });
    res.json({ success: true, data: user.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/users/:id/capacity', authorize('system_admin', 'quality_manager'), resCtrl.setUserCapacity);

module.exports = router;
