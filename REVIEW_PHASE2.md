# Phase 2 代码审查意见

> 审查对象：`backend/src/auth/`、`backend/src/routes/auth.ts`、类型声明  
> 审查结果：**通过，建议修复 2 个小问题后再进入 Phase 3**

---

## 一、总体评价

Phase 2 认证模块实现完整、代码规范：

- 密码使用 bcrypt 哈希，cost 从环境变量读取
- JWT 双 token（access + refresh）签发与验证实现正确
- 认证中间件从 `Authorization: Bearer <token>` 提取并校验
- 注册/登录接口参数校验严格，错误码清晰
- `express.d.ts` 正确扩展了 `Request.user` 类型
- `npm run typecheck` 通过
- `npm run build` 通过

整体可以直接进入 Phase 3，但建议先处理下面 2 个非阻塞性改进。

---

## 二、建议修改的问题

### 🟡 问题 1：缺少 `/api/auth/refresh` 接口

**文件**：`backend/src/routes/auth.ts`

**当前情况**：注册和登录都会返回 `refreshToken`，但没有接口可以用 refreshToken 换取新的 `accessToken`。

**影响**：当前不影响功能，因为前端每次登录都会拿到新的 accessToken。但如果未来要实现"记住登录"或 token 续期，必须有这个接口。

**修改建议**：添加 `POST /api/auth/refresh`：

```ts
import { verifyRefreshToken } from '../auth/jwt';

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw Unauthorized('Missing refresh token', 'NO_REFRESH_TOKEN');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw Unauthorized('Empty refresh token', 'NO_REFRESH_TOKEN');
    }

    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw Unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, public_key, avatar_color, created_at, last_seen_at
       FROM users WHERE id = $1`,
      [payload.userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw Unauthorized('user not found', 'USER_NOT_FOUND');
    }

    const user = rowToUser(row);
    const tokens = issueTokens(user.id, user.username);
    res.json({ user, ...tokens });
  }),
);
```

> 备注：如果暂时不想做，可以在 `DETAIL_PLAN.md` 里标注"refresh 接口推迟到 Phase 7 或需要时实现"。但建议 Phase 2 就加上，因为改动很小。

---

### 🟢 问题 2：`requireAuth` 中 `void err` 不够优雅

**文件**：`backend/src/auth/middleware.ts`

**当前代码**：
```ts
} catch (err) {
  next(Unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
  void err;
}
```

**问题**：`void err` 只是为了绕过 TypeScript 的未使用变量检查。

**修改建议**：直接省略 `err` 参数，或记录日志。

方案 A（简洁）：
```ts
} catch {
  next(Unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
}
```

方案 B（记录原因，调试用）：
```ts
} catch (err) {
  logger.debug({ err }, 'token verification failed');
  next(Unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
}
```

> 注意：生产环境不要记录 token 本身，但可以记录错误类型。

---

## 三、可选优化（不改也能通过）

### 1. `jwt.ts` 中 `export type { JwtPayload }` 未使用

当前 `jwt.ts` 导出了 `JwtPayload` 但没有其它地方使用。可以删除这一行，保持文件干净。

```ts
// 删除
export type { JwtPayload };
```

### 2. 登录/注册成功后可以更新 `last_seen_at`

当前注册和登录没有更新 `users.last_seen_at`。可以在成功后执行：

```sql
UPDATE users SET last_seen_at = NOW() WHERE id = $1
```

这个也可以等到 Phase 4（presence/在线状态）再统一处理。

### 3. `User` 类型位置

目前 `User` / `UserRow` 定义在 `backend/src/types/models.ts`，而 `DETAIL_PLAN.md` 中 `models.ts` 原本规划在前端目录。后端有自己的类型文件是更好的实践，不需要改动。

---

## 四、验证结果

```bash
cd backend
npm run typecheck   # ✅ 通过
npm run build       # ✅ 通过
```

---

## 五、Phase 2 验收 Checklist

- [ ] `POST /api/auth/register` 可注册新用户
- [ ] 用户名重复返回 `409 USERNAME_TAKEN`
- [ ] 用户名/密码格式错误返回 `400`
- [ ] `POST /api/auth/login` 可登录
- [ ] 登录失败返回统一 `401 INVALID_CREDENTIALS`
- [ ] 登录/注册成功返回 `accessToken`、`refreshToken`、`user`
- [ ] `GET /api/auth/me` 需要 Bearer Token
- [ ] Token 无效返回 `401 INVALID_TOKEN`
- [ ] 数据库中 `password_hash` 是 bcrypt 密文，不是明文

---

## 六、下一步：Phase 3 房间与用户模块

Phase 3 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `backend/src/routes/users.ts` | `GET /api/users?q=` 搜索用户 |
| `backend/src/routes/rooms.ts` | 房间 CRUD、成员管理、私聊创建 |
| `backend/src/types/models.ts` 扩展 | `Room`、`RoomMember`、`Message` 等类型 |

详细接口定义见 `DETAIL_PLAN.md` 第四章。
