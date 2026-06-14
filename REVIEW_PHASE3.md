# Phase 3 代码审查意见

> 审查对象：`backend/src/routes/users.ts`、`backend/src/routes/rooms.ts`、`backend/src/routes/direct.ts`、`backend/src/types/models.ts`、`backend/src/index.ts`  
> 审查结果：**通过，建议修复 3 个优化项后再进入 Phase 4**

---

## 一、总体评价

Phase 3 房间与用户模块实现得非常扎实：

- 用户搜索、群聊 CRUD、成员管理、私聊创建全部实现
- 权限校验正确（成员可见、admin 可操作）
- 使用了数据库事务处理房间创建
- 未读数统计已实现
- 类型定义清晰，`Room`、`RoomMember`、`RoomListItem` 区分合理
- `index.ts` 正确挂载了 `/api/users`、`/api/rooms`、`/api/direct`
- `npm run typecheck` 通过
- `npm run build` 通过

整体代码质量高，可以直接进入 Phase 4，但建议先处理下面 3 个优化项。

---

## 二、建议修改的问题

### 🟡 问题 1：`direct.ts` 和 `rooms.ts` 中存在重复的成员查询代码

**文件**：`backend/src/routes/direct.ts`、`backend/src/routes/rooms.ts`

**当前情况**：两个文件都定义了类似的成员查询函数：
- `rooms.ts`：`fetchMembers()`、`fetchMembersForOneRoom()`
- `direct.ts`：`fetchMembersForRoom()`

**问题**：重复代码不利于维护，且类型转换逻辑分散。

**修改建议**：在 `backend/src/types/models.ts` 或新建 `backend/src/db/rooms.ts` 中统一提供查询函数。

推荐在 `types/models.ts` 末尾增加：

```ts
export async function fetchRoomMembers(pool: Pool, roomId: string): Promise<RoomMember[]> {
  const result = await pool.query<RoomMemberRow>(
    `SELECT rm.room_id, rm.user_id, rm.role, rm.joined_at, rm.last_read_at,
            u.username, u.avatar_color
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1`,
    [roomId],
  );
  return result.rows.map(rowToRoomMember);
}

export async function fetchRoomMembersBatch(
  pool: Pool,
  roomIds: string[],
): Promise<Map<string, RoomMember[]>> {
  if (roomIds.length === 0) return new Map();
  const result = await pool.query<RoomMemberRow>(
    `SELECT rm.room_id, rm.user_id, rm.role, rm.joined_at, rm.last_read_at,
            u.username, u.avatar_color
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = ANY($1::uuid[])`,
    [roomIds],
  );
  return groupMembersByRoom(result.rows);
}
```

然后在 `rooms.ts` 和 `direct.ts` 中删除各自的私有函数，统一调用这两个函数。

> 注意：这会引入 `Pool` 的 import，需要确认 `pg` 已安装（已安装）。

---

### 🟡 问题 2：`rooms.created_by` 数据库约束与 DTO 默认值不一致

**文件**：`backend/src/db/migrations/002_rooms.sql`、`backend/src/types/models.ts`

**当前情况**：
```sql
-- 002_rooms.sql
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100),
  is_direct       BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),   -- 没有 NOT NULL
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

```ts
// models.ts
export function roomRowToDto(...) {
  const base = {
    // ...
    createdBy: row.created_by ?? '',  // 用空字符串兜底
    // ...
  };
}
```

**问题**：数据库允许 `created_by` 为 NULL，但业务上所有房间都应该有创建者。DTO 中用空字符串兜底不够严谨。

**修改建议**：在迁移文件中给 `created_by` 加 `NOT NULL`：

```sql
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100),
  is_direct       BOOLEAN DEFAULT FALSE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

然后修改 `RoomRow` 和 `roomRowToDto`：

```ts
export interface RoomRow {
  id: string;
  name: string | null;
  is_direct: boolean;
  created_by: string;   // 去掉 null
  created_at: Date;
}

export function roomRowToDto(...): Room | RoomListItem {
  const base = {
    // ...
    createdBy: row.created_by,   // 不需要 ?? ''
    // ...
  };
  // ...
}
```

> 注意：修改迁移文件后，如果已经创建过表，需要删除旧数据库重新迁移，或者用 ALTER TABLE 修改。

---

### 🟢 问题 3：`RoomListItem` 类型可以用 `extends` 简化

**文件**：`backend/src/types/models.ts`

**当前代码**：
```ts
export interface Room {
  id: string;
  name: string | null;
  isDirect: boolean;
  createdBy: string;
  createdAt: string;
  members: RoomMember[];
}

export interface RoomListItem {
  id: string;
  name: string | null;
  isDirect: boolean;
  createdBy: string;
  createdAt: string;
  members: RoomMember[];
  unreadCount: number;
}
```

**修改建议**：
```ts
export interface RoomListItem extends Room {
  unreadCount: number;
}
```

这样更简洁，也避免未来加字段时两处都要改。

---

## 三、可选优化（不改也能通过）

### 1. `roomRowToDto` 返回类型不够精确

当前：
```ts
export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount?: number,
): Room | RoomListItem
```

调用方无法从类型上确定返回的是 `Room` 还是 `RoomListItem`。可以改为函数重载：

```ts
export function roomRowToDto(row: RoomRow, members: RoomMember[]): Room;
export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount: number,
): RoomListItem;
export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount?: number,
): Room | RoomListItem {
  // ...
}
```

这样 TypeScript 可以根据参数个数推断返回类型。

### 2. 私聊成员删除的边界情况

当前私聊双方都是 `admin`，理论上可以通过 `DELETE /api/rooms/:id/members/:userId` 把对方踢出，导致私聊变成单人群。这个逻辑在 v1 不影响功能，但 v2 群聊密钥分发时需要注意。可以在 `DELETE /api/rooms/:id/members/:userId` 中禁止删除私聊成员：

```ts
const roomResult = await pool.query<{ is_direct: boolean }>(
  `SELECT is_direct FROM rooms WHERE id = $1`,
  [roomId],
);
if (roomResult.rows[0]?.is_direct) {
  throw BadRequest('cannot remove members from a direct chat', 'DIRECT_CHAT_MEMBER');
}
```

这个可以放到 v2 时处理。

### 3. 查询房间列表的性能

`GET /api/rooms` 使用了 correlated subquery 计算未读数和排序。数据量小时没问题，量大时需要优化。v1 不需要改。

---

## 四、验证结果

```bash
cd backend
npm run typecheck   # ✅ 通过
npm run build       # ✅ 通过
```

---

## 五、Phase 3 验收 Checklist

- [ ] `GET /api/users?q=xxx` 可搜索用户（排除自己）
- [ ] `GET /api/rooms` 返回当前用户的房间列表，含未读数
- [ ] `POST /api/rooms` 可创建群聊并拉成员
- [ ] `GET /api/rooms/:id` 返回房间详情和成员列表
- [ ] `POST /api/rooms/:id/members` 仅 admin 可拉人
- [ ] `DELETE /api/rooms/:id/members/:userId` 仅 admin 可踢人，不能踢自己
- [ ] `GET /api/direct/:userId` 可获取/创建私聊房间
- [ ] 非成员无法查看房间详情
- [ ] 数据库事务正确（创建失败回滚）

---

## 六、下一步：Phase 4 消息历史与 Socket.IO

Phase 4 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `backend/src/routes/messages.ts` | `GET /api/rooms/:id/messages` 分页历史、`POST /api/rooms/:id/read` 已读 |
| `backend/src/socket/auth.ts` | Socket.IO token 认证中间件 |
| `backend/src/socket/server.ts` | Socket.IO 挂载、在线状态管理 |
| `backend/src/socket/handlers/message.ts` | `message:send` 事件处理 |
| `backend/src/socket/handlers/presence.ts` | 在线状态广播 |
| `backend/src/socket/handlers/typing.ts` | 正在输入广播 |
| `backend/src/socket/handlers/rooms.ts` | `room:join` / `room:leave` |
| `backend/src/types/models.ts` 扩展 | `Message`、`FileMeta` 类型 |

详细接口定义见 `DETAIL_PLAN.md` 第四章。
