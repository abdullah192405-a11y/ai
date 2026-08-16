import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import { signToken } from './jwtAuth.js';

export function signAdminToken(admin) {
  return signToken({
    type: 'platform_admin',
    adminId: admin.id,
    email: admin.email,
    fullName: admin.full_name,
  });
}

export function adminAuth(req, res, next) {
  const token = (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول' });
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.type !== 'platform_admin' || !payload.adminId) {
      return res.status(403).json({ message: 'صلاحيات غير كافية' });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'جلسة غير صالحة' });
  }
}
