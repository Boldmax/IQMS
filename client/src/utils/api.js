import axios from 'axios';

// Always use a relative baseURL so Create React App's dev proxy
// (set to http://localhost:5000 in package.json) handles the forwarding.
// This means the browser never makes a cross-origin request during development —
// all /api/* calls go to the same origin (localhost:3000) and CRA proxies them.
// In production the React build is served by Express itself, so /api is also same-origin.
const api = axios.create({
  baseURL:process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('iqms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally — but NOT during the initial bootstrap /auth/me check.
// If we redirected on every 401 /auth/me response, a missing/expired token on
// cold load would immediately bounce the user before AuthContext can decide
// what to do (e.g. show the login page cleanly vs. a redirect loop).
let _isBootstrapping = true;
setTimeout(() => { _isBootstrapping = false; }, 3000); // give auth context 3s to init

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const is401      = error.response?.status === 401;
    const isAuthMe   = error.config?.url?.includes('/auth/me');

    if (is401 && !(isAuthMe && _isBootstrapping)) {
      // Clear stale credentials and redirect, but only if we're past boot
      // and this isn't the first /auth/me probe from AuthContext
      localStorage.removeItem('iqms_token');
      localStorage.removeItem('iqms_user');
      localStorage.removeItem('iqms_tenant');
      // Avoid redirect loop if already on login/signup
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/signup') &&
          !window.location.pathname.startsWith('/accept-invite')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.patch('/auth/profile', data);

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const getDashboardStats = (params) => api.get('/dashboard/stats', { params });
export const getInspectorWorkload = () => api.get('/inspector-workload');

// ── AI FEATURES ──────────────────────────────────────────────────────────────
// Longer timeout than the default 15s — model calls (especially document
// extraction) routinely take longer than a normal CRUD request.
export const aiNCRAssist = (data) => api.post('/ai/ncr-assist', data, { timeout: 45000 });

export const aiExtractWelderDoc = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/ai/welder-extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
};

// ── PROJECTS ──────────────────────────────────────────────────────────────────
// ── PROJECTS ──────────────────────────────────────────────────────────────────
export const getProjects     = (params)    => api.get('/projects', { params });
export const getProject      = (id)        => api.get(`/projects/${id}`);
export const createProject   = (data)      => api.post('/projects', data);
export const updateProject   = (id, data)  => api.patch(`/projects/${id}`, data);
export const getProjectStats = (id)        => api.get(`/projects/${id}/stats`);

// ── INSPECTIONS ───────────────────────────────────────────────────────────────
export const getInspections = (params) => api.get('/inspections', { params });
export const getInspection = (id) => api.get(`/inspections/${id}`);
export const createInspection = (data) => api.post('/inspections', data);
export const approveInspection = (id) => api.post(`/inspections/${id}/approve`);
export const getInspectionStats = () => api.get('/inspections/stats');

// ── NCRs ──────────────────────────────────────────────────────────────────────
export const getNCRs = (params) => api.get('/ncrs', { params });
export const getNCR = (id) => api.get(`/ncrs/${id}`);
export const createNCR = (data) => api.post('/ncrs', data);
export const updateNCR = (id, data) => api.patch(`/ncrs/${id}`, data);
export const closeNCR = (id, data) => api.post(`/ncrs/${id}/close`, data);
export const getNCRStats = () => api.get('/ncrs/stats');

// ── QUALITY PLANS ──────────────────────────────────────────────────────────────
export const getQualityPlans   = (params)   => api.get('/quality-plans', { params });
export const getQualityPlan    = (id)       => api.get(`/quality-plans/${id}`);
export const createQualityPlan = (data)     => api.post('/quality-plans', data);
export const updateQualityPlan = (id, data) => api.patch(`/quality-plans/${id}`, data);
export const approveQualityPlan = (id)      => api.post(`/quality-plans/${id}/approve`);
export const deleteQualityPlan = (id)       => api.delete(`/quality-plans/${id}`);

// ── ATTACHMENTS ────────────────────────────────────────────────────────────────
export const getAttachments = (entityType, entityId) =>
  api.get('/attachments', { params: { entity_type: entityType, entity_id: entityId } });

export const uploadAttachment = (entityType, entityId, file, onProgress) => {
  const formData = new FormData();
  formData.append('entity_type', entityType);
  formData.append('entity_id', entityId);
  formData.append('file', file);
  return api.post('/attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
    onUploadProgress: onProgress
      ? (evt) => onProgress(Math.round((evt.loaded * 100) / (evt.total || evt.loaded)))
      : undefined,
  });
};

export const deleteAttachment = (id) => api.delete(`/attachments/${id}`);

// Triggers a browser download of the (decompressed) original file.
export const downloadAttachment = async (id, fileName) => {
  const res = await api.get(`/attachments/${id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ── ITP ───────────────────────────────────────────────────────────────────────
export const getITPItems = (params) => api.get('/itp', { params });
export const createITPItem = (data) => api.post('/itp', data);
export const updateITPItem = (id, data) => api.patch(`/itp/${id}`, data);
export const signOffITP = (id, data) => api.post(`/itp/${id}/signoff`, data);

// ── MATERIALS ─────────────────────────────────────────────────────────────────
export const getMaterials = (params) => api.get('/materials', { params });
export const createMaterial = (data) => api.post('/materials', data);
export const updateMaterialStatus = (id, data) => api.patch(`/materials/${id}/status`, data);

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
export const getDocuments = (params) => api.get('/documents', { params });
export const createDocument = (data) => api.post('/documents', data);
export const approveDocument = (id) => api.post(`/documents/${id}/approve`);
export const newDocRevision = (id, data) => api.post(`/documents/${id}/new-revision`, data);

// ── WELDERS ───────────────────────────────────────────────────────────────────
export const getWelders = () => api.get('/welders');
export const createWelder = (data) => api.post('/welders', data);
export const updateWelder = (id, data) => api.patch(`/welders/${id}`, data);

// ── BLASTERS ─────────────────────────────────────────────────────────────────
export const getBlasters = () => api.get('/blasters');
export const createBlaster = (data) => api.post('/blasters', data);
export const updateBlaster = (id, data) => api.patch(`/blasters/${id}`, data);

// ── PAINTERS ─────────────────────────────────────────────────────────────────
export const getPainters = () => api.get('/painters');
export const createPainter = (data) => api.post('/painters', data);
export const updatePainter = (id, data) => api.patch(`/painters/${id}`, data);

// ── EQUIPMENT ─────────────────────────────────────────────────────────────────
export const getEquipment = () => api.get('/equipment');
export const createEquipment = (data) => api.post('/equipment', data);
export const updateEquipment = (id, data) => api.patch(`/equipment/${id}`, data);
export const calibrateEquipment = (id, data) => api.post(`/equipment/${id}/calibrate`, data);

// ── AUDIT ─────────────────────────────────────────────────────────────────────
export const getAuditLog = (params) => api.get('/audit', { params });

// ── PUNCH LIST ────────────────────────────────────────────────────────────────
export const getPunchItems    = (params) => api.get('/punch', { params });
export const getPunchItem     = (id)     => api.get(`/punch/${id}`);
export const createPunchItem  = (data)   => api.post('/punch', data);
export const updatePunchItem  = (id, data) => api.patch(`/punch/${id}`, data);
export const submitPunchClose = (id, data) => api.post(`/punch/${id}/close`, data);
export const acceptPunchClose = (id, data) => api.post(`/punch/${id}/accept`, data);
export const getPunchStats    = (params) => api.get('/punch/stats', { params });

// ── USERS ─────────────────────────────────────────────────────────────────────
export const getUsers = () => api.get('/users');
export const toggleUser = (id) => api.patch(`/users/${id}/toggle`);
export const updateUserCapacity = (id, data) => api.patch(`/users/${id}/capacity`, data);

export default api;
