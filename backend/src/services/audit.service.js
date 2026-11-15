import prisma from '../config/database.js';

// Keys that should never be stored in persistent audit logs
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'qrToken',
  'qrTokenHash',
  'creditCard',
  'cardNumber',
  'cvv',
  'authorization',
]);

/**
 * Recursively sanitize metadata to remove sensitive credentials
 */
export const sanitizeMetadata = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMetadata);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
};

/**
 * Format audit record for API serialization
 */
export const formatAuditLog = (log) => {
  if (!log) return null;
  return {
    id: log.id,
    actorId: log.userId,
    actor: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          role: log.user.role,
          email: log.user.email,
        }
      : null,
    action: log.action,
    entityType: log.entity,
    entityId: log.entityId,
    metadata: log.details,
    createdAt: log.createdAt,
  };
};

export class AuditService {
  /**
   * Log an audit event inside a transaction or standalone
   */
  static async log(clientOrTx, { actorId, action, entityType, entityId, metadata = {} }) {
    const client = clientOrTx || prisma;
    const cleanMetadata = sanitizeMetadata(metadata);

    return await client.auditLog.create({
      data: {
        userId: actorId || null,
        action,
        entity: entityType,
        entityId: entityId || null,
        details: cleanMetadata,
      },
    });
  }

  /**
   * Query paginated audit logs with administrative filters
   */
  static async getAuditLogs({
    page = 1,
    limit = 20,
    action,
    entityType,
    actorId,
    startDate,
    endDate,
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entity = entityType;
    }

    if (actorId) {
      where.userId = actorId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
      }),
    ]);

    return {
      data: logs.map(formatAuditLog),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }
}
