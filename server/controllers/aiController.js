const { NCR } = require('../models');
const { Op } = require('sequelize');
const { getStructuredCompletion, AIConfigError } = require('../utils/anthropicClient');

// ── NCR ROOT-CAUSE & CORRECTIVE ACTION ASSISTANT ─────────────────────────────
// Given a fresh NCR description, this:
//  1. Pulls a handful of textually-similar past NCRs from this tenant's own
//     history (simple keyword overlap — no vector DB in this app yet, but
//     this is enough signal for Claude to ground its suggestion in real
//     precedent rather than generic textbook answers).
//  2. Asks Claude to classify the likely root-cause category and draft a
//     root cause / corrective action / preventive action, citing whether
//     this looks like a repeat of a past issue.
//
// The result is always a *draft* — the inspector raising the NCR reviews and
// edits before it's saved, exactly like every other field on the form.
exports.ncrAssist = async (req, res) => {
  try {
    const { description, severity, project_id } = req.body;
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Provide a fuller non-conformance description (at least 10 characters) before requesting AI assistance.' });
    }

    // Pull this tenant's closed NCRs to ground the suggestion in real precedent.
    // Capped at 200 most recent so this stays fast on large tenants.
    const pastNCRs = await NCR.findAll({
      where: { ...req.tenantScope, status: 'Closed', root_cause: { [Op.ne]: null } },
      attributes: ['ncr_number', 'description', 'severity', 'root_cause', 'corrective_action', 'preventive_action'],
      order: [['closed_date', 'DESC']],
      limit: 200,
    });

    // Cheap keyword-overlap ranking to find the most relevant precedent —
    // good enough without a vector store, and keeps the prompt small.
    const keywords = description.toLowerCase().match(/[a-z]{4,}/g) || [];
    const scored = pastNCRs.map(n => {
      const text = `${n.description} ${n.root_cause}`.toLowerCase();
      const score = keywords.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);
      return { n, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    const similarNCRs = scored.map(s => ({
      ncr_number: s.n.ncr_number,
      description: s.n.description,
      severity: s.n.severity,
      root_cause: s.n.root_cause,
      corrective_action: s.n.corrective_action,
    }));

    const system = `You are a senior QA/QC engineer specializing in oil & gas fabrication, welding, NDT, and coating inspection (ASME, AWS, API, ISO standards). 
You assist inspectors by drafting root cause analyses and corrective/preventive actions for Non-Conformance Reports (NCRs).
Be specific and technical, referencing the relevant code or standard clause where appropriate. Keep each field to 1-3 sentences — these are drafts the inspector will edit, not final reports.
Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "root_cause_category": "one short category, e.g. 'Procedural non-compliance', 'Material defect', 'Welder technique', 'Inadequate WPS', 'Equipment calibration'",
  "root_cause": "drafted root cause analysis text",
  "corrective_action": "drafted corrective action text",
  "preventive_action": "drafted preventive action text",
  "is_likely_repeat": true or false,
  "repeat_reasoning": "one sentence — why this looks/doesn't look like a repeat of past NCRs provided, or null if no past NCRs were provided"
}`;

    const userContent = `NEW NON-CONFORMANCE DESCRIPTION:
"${description}"
Severity: ${severity || 'Not specified'}

${similarNCRs.length > 0
  ? `SIMILAR PAST NCRS FROM THIS PROJECT'S HISTORY (for context — use these to spot repeat patterns):\n${similarNCRs.map(s => `- [${s.ncr_number}] ${s.description} | Root cause: ${s.root_cause} | Corrective action: ${s.corrective_action}`).join('\n')}`
  : 'No similar past NCRs found in this tenant\'s closed history.'}`;

    const result = await getStructuredCompletion({
      system,
      content: [{ type: 'text', text: userContent }],
      maxTokens: 800,
    });

    res.json({ success: true, data: { ...result, similar_ncrs: similarNCRs } });
  } catch (err) {
    if (err instanceof AIConfigError) return res.status(503).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── WELDER QUALIFICATION DOCUMENT EXTRACTION ─────────────────────────────────
// Accepts an uploaded WPQ/PQR document (image or PDF, sent as multipart
// form-data and forwarded to Claude as base64) and asks Claude to read it
// and extract structured fields matching the Welder model, so the
// qualification register can be populated from a scan instead of typed
// in by hand field-by-field.
exports.welderExtract = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document uploaded.' });
    }
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Upload a JPEG, PNG, WEBP image, or PDF of the WPQ/PQR document.' });
    }

    const base64 = req.file.buffer.toString('base64');
    const isPdf = req.file.mimetype === 'application/pdf';

    const system = `You are a QA/QC document-extraction assistant for welding inspection. You read Welder Performance Qualification (WPQ) or Procedure Qualification Record (PQR) documents and extract structured data per ASME IX / AWS D1.1 / API 1104 conventions.
If a field is not visible or not present in the document, use null — never guess or fabricate a value.
Respond with ONLY a JSON object, no other text, in this exact shape:
{
  "name": "welder's full name or null",
  "wpq_reference": "WPQ/qualification record number or null",
  "process": "one of SMAW, GTAW, GMAW, FCAW, SAW, PAW, or null",
  "expiry_date": "YYYY-MM-DD or null",
  "test_pipe_dia": "test pipe diameter in mm, as a string, or null",
  "test_plate_thk": "test plate thickness in mm, as a string, or null",
  "test_position": "tested position(s), e.g. '6G', or null",
  "test_filler_aws_no": "filler metal AWS classification, e.g. 'E7018', or null",
  "test_filler_f_no": "filler metal F-Number, or null",
  "test_material_p_no": "base material P-Number, or null",
  "test_material_spec": "base material specification, e.g. 'A106 Gr.B', or null",
  "qual_process": "qualified process(es), or null",
  "qual_dia_thk": "qualified diameter/thickness range, or null",
  "qual_f_no": "qualified F-Number range, or null",
  "qual_p_no": "qualified P-Number range, or null",
  "qual_position": "qualified position range, e.g. '1G-6G', or null",
  "extraction_notes": "one short sentence noting anything illegible, ambiguous, or worth the inspector double-checking — or null if the document was clear"
}`;

    const content = [
      {
        type: isPdf ? 'document' : 'image',
        source: { type: 'base64', media_type: req.file.mimetype, data: base64 },
      },
      { type: 'text', text: 'Extract the welder qualification data from this document per the schema in your instructions.' },
    ];

    const result = await getStructuredCompletion({ system, content, maxTokens: 1000 });

    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AIConfigError) return res.status(503).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
