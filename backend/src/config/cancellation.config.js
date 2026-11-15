/**
 * Centralized booking cancellation and refund business configuration
 */
export const CANCELLATION_CONFIG = {
  // Cutoff in hours before show start time after which cancellation is strictly rejected
  CUTOFF_HOURS: parseInt(process.env.CANCELLATION_CUTOFF_HOURS || '2', 10),

  // Refund policy percentage for cancellations completed prior to cutoff
  REFUND_PERCENTAGE: 100,
};

/**
 * Generate cryptographically distinct, human-readable refund reference
 * Format: REF-YYYYMMDD-XXXX (e.g. REF-20261115-9K3L)
 */
export const generateRefundReference = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${dateStr}-${randomSuffix}`;
};
