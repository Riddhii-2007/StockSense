import express from 'express';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, newOtp, generateToken } from '../utils/password.js';

const router = express.Router();

const OTP_TTL_MINUTES = 10;

// Demo affordance: there is no mail provider wired up, so the code is returned
// to the client in development so the flow can be demonstrated end to end.
// This must be removed before any real deployment.
const ECHO_OTP = process.env.ECHO_OTP !== 'false' && process.env.NODE_ENV !== 'production';

function publicUser(u) {
  return { id: u.id, email: u.email, fullName: u.full_name, role: u.role };
}

/** Expiry is computed in JS and stored as an ISO string, so it reads back
 *  identically on both drivers. SQLite's datetime() format is not parseable by
 *  Date without a fallback, and TIMESTAMPTZ comes back as a Date object. */
function otpExpiry() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
}

function toDate(value) {
  return value instanceof Date ? value : new Date(String(value));
}

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
  }
  return res.json({ success: true, user: publicUser(user), token: generateToken(user) });
});

/**
 * POST /api/auth/request-otp
 * Step 1 of the statement-mandated OTP password reset. Always answers the same
 * way so the endpoint cannot be used to discover which emails exist.
 */
router.post('/request-otp', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const user = await db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  const generic = {
    success: true,
    message: 'If that email is registered, a 6-digit code has been issued.',
  };

  if (!user) return res.json(generic);

  const code = newOtp();
  await db
    .prepare('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?')
    .run(code, otpExpiry(), user.id);

  return res.json({
    ...generic,
    ...(ECHO_OTP ? { demoOtp: code, note: 'Development only: no mail provider is configured.' } : {}),
  });
});

/** POST /api/auth/reset-password - verifies the OTP, then sets the new password. */
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body ?? {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'email, otp and newPassword are required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!user || !user.otp_code) {
    return res.status(400).json({ success: false, message: 'No active reset code for that email.' });
  }
  if (toDate(user.otp_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: 'Reset code has expired. Request a new one.' });
  }
  if (String(otp).trim() !== user.otp_code) {
    return res.status(400).json({ success: false, message: 'Incorrect reset code.' });
  }

  await db
    .prepare('UPDATE users SET password = ?, otp_code = NULL, otp_expires_at = NULL WHERE id = ?')
    .run(hashPassword(newPassword), user.id);
  return res.json({ success: true, message: 'Password updated. You can sign in now.' });
});

/** GET /api/auth/demo-users - listed on the sign-in screen for the demo. */
router.get('/demo-users', async (req, res) => {
  const users = await db.prepare('SELECT email, full_name, role FROM users ORDER BY id').all();
  res.json({ success: true, users });
});

export default router;
