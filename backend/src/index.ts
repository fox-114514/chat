import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env';
import { logger } from './utils/logger';
import { AppError, InternalError } from './utils/errors';
import { runMigrations } from './db/migrate';
import { closePool } from './db/pool';

const app = express();
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
});

class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message, 'NOT_FOUND');
  }
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, status: err.statusCode, msg: err.message }, 'request error');
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  logger.error({ err }, 'unhandled error');
  const wrapped = err instanceof Error ? err : new Error(String(err));
  res.status(500).json({ error: InternalError().message, code: 'INTERNAL_ERROR' });
  void wrapped;
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.debug({ sid: socket.id }, 'socket connected');
  socket.on('disconnect', (reason) => {
    logger.debug({ sid: socket.id, reason }, 'socket disconnected');
  });
});

async function start(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    logger.fatal({ err }, 'migration failed; aborting');
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening');
  });
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  io.close();
  httpServer.close();
  try {
    await closePool();
  } catch (err) {
    logger.error({ err }, 'error closing pg pool');
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandledRejection; aborting');
  void shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException; aborting');
  void shutdown('uncaughtException');
});

void start();
