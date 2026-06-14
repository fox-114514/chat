import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { hashPassword, comparePassword } from '../auth/password';
import { signAccessToken, signRefreshToken } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequest, Unauthorized, Conflict } from '../utils/errors';
import { rowToUser, UserRow } from '../types/models';
import { logger } from '../utils/logger';

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,50}$/;
const MIN_PASSWORD_LEN = 8;

interface RegisterBody {
  username?: unknown;
  password?: unknown;
}

function parseRegisterBody(body: unknown): { username: string; password: string } {
  const b = body as RegisterBody;
  const username = typeof b?.username === 'string' ? b.username.trim() : '';
  const password = typeof b?.password === 'string' ? b.password : '';
  if (!USERNAME_RE.test(username)) {
    throw BadRequest(
      'username must be 3-50 chars, alphanumeric or underscore',
      'INVALID_USERNAME',
    );
  }
  if (password.length < MIN_PASSWORD_LEN) {
    throw BadRequest(
      `password must be at least ${MIN_PASSWORD_LEN} characters`,
      'INVALID_PASSWORD',
    );
  }
  return { username, password };
}

function issueTokens(userId: string, username: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken({ userId, username }),
    refreshToken: signRefreshToken({ userId, username }),
  };
}

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { username, password } = parseRegisterBody(req.body);

    const passwordHash = await hashPassword(password);

    let row: UserRow;
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         RETURNING id, username, password_hash, public_key, avatar_color, created_at, last_seen_at`,
        [username, passwordHash],
      );
      row = result.rows[0]!;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        throw Conflict('username already exists', 'USERNAME_TAKEN');
      }
      throw err;
    }

    logger.info({ userId: row.id, username: row.username }, 'user registered');

    const user = rowToUser(row);
    const tokens = issueTokens(user.id, user.username);
    res.status(201).json({ user, ...tokens });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { username, password } = parseRegisterBody(req.body);

    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, public_key, avatar_color, created_at, last_seen_at
       FROM users
       WHERE username = $1`,
      [username],
    );
    const row = result.rows[0];

    if (!row) {
      throw Unauthorized('invalid username or password', 'INVALID_CREDENTIALS');
    }

    const ok = await comparePassword(password, row.password_hash);
    if (!ok) {
      throw Unauthorized('invalid username or password', 'INVALID_CREDENTIALS');
    }

    logger.info({ userId: row.id, username: row.username }, 'user logged in');

    const user = rowToUser(row);
    const tokens = issueTokens(user.id, user.username);
    res.json({ user, ...tokens });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, public_key, avatar_color, created_at, last_seen_at
       FROM users
       WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw Unauthorized('user not found', 'USER_NOT_FOUND');
    }
    res.json({ user: rowToUser(row) });
  }),
);

export default router;
