import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Schema, Document } from 'mongoose';
import { UserRole, User } from '@polar-ops/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'polar-ops-secret-key-47';

export interface IUserDoc extends Document {
  name: string;
  email: string;
  role: UserRole;
  station?: string;
  passwordHash?: string;
}

const UserSchema = new Schema<IUserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, required: true, enum: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER', 'SCIENTIST'] },
  station: { type: String, default: 'GOA_HQ' },
  passwordHash: { type: String }
}, { timestamps: true });

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);

export function signToken(user: { id: string; email: string; role: UserRole; name: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For easy testing/demo, if no header provided, use default mock admin
    req.user = {
      id: 'usr-admin-demo',
      email: 'admin@ncpor.res.in',
      role: 'ADMIN',
      name: 'Dr. S. K. Roy (NCPOR Operations)'
    };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      data: null,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' }
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        data: null,
        error: {
          message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
          code: 'FORBIDDEN'
        }
      });
    }
    next();
  };
}
