import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../auth/middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { rowToUser, UserRow } from '../types/models';

const router = Router();
const SEARCH_LIMIT = 20;

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const raw = typeof req.query.q === 'string' ? req.query.q : '';
    const q = raw.trim();

    if (q.length === 0) {
      res.json({ users: [] });
      return;
    }

    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, public_key, avatar_color, created_at, last_seen_at
       FROM users
       WHERE username ILIKE $1 AND id <> $2
       ORDER BY username
       LIMIT $3`,
      [`%${q}%`, req.user!.userId, SEARCH_LIMIT],
    );

    res.json({ users: result.rows.map(rowToUser) });
  }),
);

export default router;
