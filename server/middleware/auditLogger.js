const { AuditLog } = require('../models');

/**
 * createAuditLog — unchanged API from v1, but now requires tenant_id.
 * The tenant_id is pulled from the caller (controller has req.tenant.id).
 */
const createAuditLog = async ({
  tenantId, userId, userName, userRole,
  action, entityType, entityId, entityRef,
  description, beforeValue, afterValue, ipAddress, metadata,
}) => {
  try {
    await AuditLog.create({
      tenant_id:    tenantId,
      user_id:      userId,
      user_name:    userName,
      user_role:    userRole,
      action,
      entity_type:  entityType,
      entity_id:    entityId,
      entity_ref:   entityRef,
      description,
      before_value: beforeValue,
      after_value:  afterValue,
      ip_address:   ipAddress,
      metadata:     metadata || {},
    });
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[AuditLog] Failed to write:', err.message);
  }
};

/**
 * auditMiddleware — Express middleware that auto-logs any mutating request.
 * Mount after protect + tenantScope.
 */
const auditMiddleware = (action, entityType) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && req.tenant) {
      createAuditLog({
        tenantId:   req.tenant.id,
        userId:     req.user?.id,
        userName:   req.user?.name,
        userRole:   req.user?.role,
        action,
        entityType,
        entityId:   req.params?.id || body?.data?.id,
        entityRef:  req.params?.id,
        description: `${action} by ${req.user?.name}`,
        ipAddress:  req.ip,
      });
    }
    return originalJson(body);
  };
  next();
};

module.exports = { createAuditLog, auditMiddleware };
