import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { Unauthorized } from '../utils/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(Unauthorized('Missing or malformed Authorization header', 'NO_TOKEN'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(Unauthorized('Empty token', 'NO_TOKEN'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    next(Unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
    void err;
  }
}
