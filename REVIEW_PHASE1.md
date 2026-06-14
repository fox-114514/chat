# Phase 1 代码审查意见

> 审查对象：`backend/` 基础设施代码  
> 审查结果：**通过，但需先修复以下 5 项后再进入 Phase 2**

---

## 一、总体评价

Phase 1 基础设施代码整体质量合格：

- 目录结构符合 `DETAIL_PLAN.md`
- `package.json`、`tsconfig.json` 配置规范
- `npm run typecheck` 通过
- `npm run build` 通过
- 环境变量校验、数据库连接池、迁移执行、日志、错误处理、Express + Socket.IO 骨架均已到位

但存在几处可读性和严谨性问题，需要先修改。

---

## 二、需要修改的问题清单

### 🔴 问题 1：`index.ts` 中 `NotFoundError` 类定义在使用之后

**文件**：`backend/src/index.ts`

**当前代码**：
```ts
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
});

class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message, 'NOT_FOUND');
  }
}
```

**问题**：虽然 TypeScript 类提升可以编译，但可读性差，且与 `utils/errors.ts` 中已有的工厂函数风格不一致。

**修改建议**：删除 `NotFoundError` 类定义，直接使用 `utils/errors.ts` 中的 `NotFound` 工厂函数。

```ts
import { AppError, InternalError, NotFound } from './utils/errors';

// ...

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(NotFound(`Route not found: ${req.method} ${req.path}`, 'NOT_FOUND'));
});
```

---

### 🟡 问题 2：`httpServer.close()` 没有等待关闭完成

**文件**：`backend/src/index.ts`

**当前代码**：
```ts
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
```

**问题**：`httpServer.close()` 是异步操作，当前没有等待其完成就继续关闭 pool 并退出进程。极端情况下可能导致正在处理的请求被异常中断。

**修改建议**：等待 httpServer 真正关闭。

```ts
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  io.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  try {
    await closePool();
  } catch (err) {
    logger.error({ err }, 'error closing pg pool');
  }
  process.exit(0);
}
```

---

### 🟡 问题 3：全局错误处理中存在无意义变量

**文件**：`backend/src/index.ts`

**当前代码**：
```ts
const wrapped = err instanceof Error ? err : new Error(String(err));
res.status(500).json({ error: InternalError().message, code: 'INTERNAL_ERROR' });
void wrapped;
```

**问题**：`wrapped` 变量创建后没有任何实际用途，`void wrapped` 只是为了绕过未使用检查。

**修改建议**：直接删除这两行，改为：

```ts
res.status(500).json({ error: InternalError().message, code: 'INTERNAL_ERROR' });
```

---

### 🟢 问题 4：`messages.file_id` 缺少外键约束（建议加）

**文件**：`backend/src/db/migrations/003_messages.sql` 和 `backend/src/db/migrations/004_files.sql`

**当前代码**：
```sql
-- 003_messages.sql
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  type            VARCHAR(20) DEFAULT 'text',
  file_id         UUID,                         -- 缺少外键
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ
);
```

**问题**：`file_id` 应该关联 `files(id)`，否则删除文件后 messages 中会残留无效引用。

**修改建议**：在 `004_files.sql` 末尾追加外键（因为 files 表在 messages 之后创建）：

```sql
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_file
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;
```

注意：要加上 `IF NOT EXISTS` 判断或确保幂次执行安全。因为迁移每次启动都会跑，可以用：

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_file'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT fk_messages_file
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;
  END IF;
END
$$;
```

---

### 🟢 问题 5：`migrate.ts` 的 SQL 拆分正则未来可能不够健壮（当前可不修）

**文件**：`backend/src/db/migrate.ts`

**当前代码**：
```ts
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?=$|\n)/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}
```

**问题**：当前迁移文件都是简单 DDL，这个正则工作正常。但如果未来迁移包含 `CREATE FUNCTION ... $$ ... $$;` 这种块，会被错误拆分。

**修改建议（可选）**：当前阶段可以不修改，但要在代码注释中留说明。如果现在要改，可以改为把整个文件作为一个 statement 执行：

```ts
export async function runMigrations(): Promise<void> {
  const files = await readMigrationFiles();
  if (files.length === 0) {
    logger.warn('no migration files found');
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readMigration(file);
      logger.info({ file }, 'applying migration');
      await client.query(sql);   // 整个文件一次性执行
    }
    logger.info({ count: files.length }, 'migrations complete');
  } finally {
    client.release();
  }
}
```

> 提示：PostgreSQL 一次 `client.query()` 可以执行多个由分号分隔的语句，所以不需要手动拆分。

---

## 三、修改后的验证步骤

修复以上问题后，请在本地或目标服务器上执行：

```bash
cd backend
npm run typecheck   # 必须通过
npm run build       # 必须通过
```

如果本地有 PostgreSQL，再执行：

```bash
# 1. 确保 .env 已配置（可复制 .env.example）
cp .env.example .env

# 2. 启动 Postgres（如果没有，可用 docker）
# docker run -d -e POSTGRES_USER=chat -e POSTGRES_PASSWORD=chat -e POSTGRES_DB=chat -p 5432:5432 postgres:16-alpine

# 3. 启动服务
npm run dev

# 4. 测试 health 接口
curl http://localhost:3000/api/health
# 预期返回: {"status":"ok","uptime":...}

# 5. 检查数据库表是否创建
psql $DATABASE_URL -c "\dt"
# 预期看到: users, rooms, room_members, messages, files
```

---

## 四、进入 Phase 2 的前置条件

Phase 1 进入 Phase 2 之前，必须满足：

- [ ] 问题 1、2、3 已修复
- [ ] 问题 4 已修复（加外键）
- [ ] `npm run typecheck` 无报错
- [ ] `npm run build` 成功
- [ ] 服务能启动，`GET /api/health` 返回正常
- [ ] 数据库 5 张表已创建

问题 5 可选，不做强制要求，但建议加上注释说明。

---

## 五、下一步工作（Phase 2: 认证模块）

Phase 2 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `backend/src/auth/password.ts` | bcrypt 密码哈希/校验 |
| `backend/src/auth/jwt.ts` | JWT 签发与验证（access + refresh） |
| `backend/src/auth/middleware.ts` | Express 认证中间件，扩展 Request 类型 |
| `backend/src/types/express.d.ts` | 声明 `req.user` 类型 |
| `backend/src/routes/auth.ts` | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |

详细接口定义见 `DETAIL_PLAN.md` 第四章。
