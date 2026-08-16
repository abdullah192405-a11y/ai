import jwt from 'jsonwebtoken';
import { env } from '../config.js';

// Verifies the dashboard JWT and attaches req.user = { userId, tenantId, websiteId, email }.
export function jwtAuth(req, res, next) {
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.type === 'platform_admin') {
      return res.status(403).json({ message: 'استخدم لوحة المستخدم وليس لوحة المشرف' });
    }
    if (!payload.userId || !payload.tenantId) {
      return res.status(401).json({ message: 'جلسة غير صالحة' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'جلسة غير صالحة' });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}
