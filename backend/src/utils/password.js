import crypto from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, expected] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const derived = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function opaqueToken(email, role) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'stocksense-dev-secret')
    .update(`${email}:${role}`)
    .digest('hex')
    .slice(0, 32);
}
