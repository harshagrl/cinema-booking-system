import crypto from 'crypto';
import QRCode from 'qrcode';

const QR_SECRET = process.env.JWT_SECRET || 'cinema-booking-system-secure-qr-secret-salt-2026';

/**
 * Generate a cryptographically secure, high-entropy opaque verification token for a ticket.
 * Contains NO customer personal information or internal secrets.
 *
 * @param {string} ticketId - UUID of the Ticket
 * @param {string} ticketNumber - Human-readable unique Ticket Number
 * @returns {string} 64-character opaque hex token
 */
export const generateOpaqueToken = (ticketId, ticketNumber) => {
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${ticketId}:${ticketNumber}`)
    .digest('hex');
};

/**
 * Compute SHA-256 hash of an opaque QR token.
 * This hash is stored in PostgreSQL (unique index) for constant-time lookup.
 *
 * @param {string} token - Raw opaque QR token
 * @returns {string} SHA-256 hash in hex
 */
export const hashQrToken = (token) => {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

/**
 * Render a high-resolution base64 PNG Data URL from a verification token.
 *
 * @param {string} token - Opaque QR token payload
 * @returns {Promise<string>} Base64 Data URL (data:image/png;base64,...)
 */
export const generateQrDataUrl = async (token) => {
  return await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#020617', // slate-950
      light: '#ffffff',
    },
  });
};
