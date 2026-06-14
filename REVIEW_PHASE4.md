# Phase 4 代码审查意见

> 审查对象：`backend/src/routes/messages.ts`、`backend/src/socket/*`、`backend/src/db/rooms.ts`、`backend/src/types/*`、`backend/src/index.ts`  
> 审查结果：**通过，建议修复 3 个小问题后再进入 Phase 5**

---

## 一、总体评价

Phase 4 实现质量很高，核心功能全部到位：

- 消息历史分页查询正确，含 sender/file 联表
- 已读接口正确更新 `last_read_at`
- Socket.IO 鉴权、房间、消息、在线状态、正在输入全部实现
- 多人在线状态聚合逻辑正确
- `socket.to(roomId)` 广播策略符合设计（发送者从 callback 拿 message）
- 文件归属校验已加上
- `npm run typecheck` 通过
- `npm run build` 通过

---

## 二、建议修改的问题

### 🟡 问题 1：`void io;` 无意义代码需要删除

**文件**：
- `backend/src/socket/handlers/message.ts` 第 142 行
- `backend/src/socket/handlers/typing.ts` 第 30、43 行

**当前代码**：
```ts
} catch (err) {
  // ...
  cb({ ok: false, error: 'SEND_FAILED', message, code: 'SEND_FAILED' });
  void io;
}
```

**问题**：`void io;` 只是为了绕过 TypeScript 未使用参数检查，影响代码整洁性。

**修改建议**：

1. 在 `registerMessageHandlers(socket: Socket, io: AppIo)` 和 `registerTypingHandlers(socket: Socket, io: AppIo)` 中，把不需要的 `io` 参数改成 `_io`：

```ts
export function registerMessageHandlers(socket: Socket, _io: AppIo): void {
  // ...
}

export function registerTypingHandlers(socket: Socket, _io: AppIo): void {
  // ...
}
```

2. 删除所有 `void io;`。

TypeScript 会忽略以 `_` 开头的未使用参数，`noUnusedParameters` 不会报错。

---

### 🟡 问题 2：`message:send` 错误处理没有区分业务错误

**文件**：`backend/src/socket/handlers/message.ts`

**当前代码**：
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : 'failed to send message';
  logger.warn({ err, userId, payload: raw }, 'message:send failed');
  cb({ ok: false, error: 'SEND_FAILED', message, code: 'SEND_FAILED' });
}
```

**问题**：如果是 `requireMember` 抛出的 `Forbidden('not a member of this room', 'NOT_MEMBER')`，客户端收到的会是 `error: 'SEND_FAILED'`，而不是更准确的 `NOT_MEMBER`。

**修改建议**：区分 `AppError` 业务错误和未知错误：

```ts
import { AppError } from '../../utils/errors';

} catch (err) {
  logger.warn({ err, userId, payload: raw }, 'message:send failed');
  if (err instanceof AppError) {
    cb({ ok: false, error: err.message, code: err.code ?? 'SEND_FAILED' });
    return;
  }
  const message = err instanceof Error ? err.message : 'failed to send message';
  cb({ ok: false, error: 'SEND_FAILED', message, code: 'SEND_FAILED' });
}
```

同理，`room:join` 的 catch 里已经在区分错误码，但也可以统一使用 `AppError` 判断。

---

### 🟢 问题 3：共享模块文件名与设计文档不一致

**文件**：`backend/src/db/rooms.ts`

**设计文档**：`PHASE4_DESIGN.md` 中写的是 `backend/src/db/roomAccess.ts`

**当前情况**：代码中实际文件名为 `backend/src/db/rooms.ts`，导出 `fetchRoomMembers`、`fetchRoomMembersBatch`、`requireMember`。

**影响**：功能完全正确，不影响运行，但设计文档与实际代码不一致。

**修改建议（二选一）**：

方案 A（推荐，改动小）：把 `PHASE4_DESIGN.md` 中所有 `db/roomAccess.ts` 改为 `db/rooms.ts`。

方案 B：把 `backend/src/db/rooms.ts` 重命名为 `backend/src/db/roomAccess.ts`，并更新所有 import。

> 注意：如果后续还要加更多房间相关 DB 方法，`db/rooms.ts` 这个名字其实比 `roomAccess.ts` 更自然，所以建议改设计文档。

---

## 三、可选优化（不改也能通过）

### 1. `socket/server.ts` 中 `io!` 非空断言

当前代码：
```ts
io!.emit('presence:update', { userId, online: true });
```

可以用 `getIO()` 替代，语义更清晰：
```ts
getIO().emit('presence:update', { userId, online: true });
```

但不是必须。

### 2. `room:join` catch 中的日志字段

当前：
```ts
logger.warn({ err, userId: socket.data.user.userId, roomId: data?.roomId }, 'room:join failed');
```

`data?.roomId` 在 payload 校验失败时可能不是 string，日志字段类型不统一。可以改为：
```ts
logger.warn(
  { err, userId: socket.data.user.userId, roomId: typeof data?.roomId === 'string' ? data.roomId : undefined },
  'room:join failed',
);
```

### 3. `typing` 事件不校验成员

按设计文档执行，v1 可以接受。如果担心用户收到非成员房间的 typing，可以后续加校验。

---

## 四、验证结果

```bash
cd backend
npm run typecheck   # ✅ 通过
npm run build       # ✅ 通过
```

---

## 五、Phase 4 验收 Checklist

- [ ] `GET /api/rooms/:id/messages?before=&limit=` 返回正确分页
- [ ] `GET /api/rooms/:id/messages` 返回 sender、file（若存在）
- [ ] `POST /api/rooms/:id/read` 更新 `last_read_at`
- [ ] Socket.IO 无 token / 无效 token 拒绝连接
- [ ] `room:join` 校验成员，非成员返回错误 callback
- [ ] `message:send` 后，同房间其他客户端收到 `message:new`
- [ ] `message:send` 发送者从 callback 拿到完整 message
- [ ] 多端在线：首连广播 online，全断广播 offline
- [ ] `typing:start/stop` 同房间广播（不含发送者）
- [ ] `message:send` 用他人 fileId 返回 `FILE_NOT_OWNED`
- [ ] `tsc --noEmit` 干净
- [ ] `tsc` build 干净

---

## 六、下一步：Phase 5 文件上传

Phase 5 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `backend/src/storage/files.ts` | 文件存储抽象（本地磁盘） |
| `backend/src/routes/files.ts` | `POST /api/files/upload`、`GET /api/files/:id` |
| `backend/src/index.ts` | 挂载 `/api/files` 路由 |

详细接口定义见 `DETAIL_PLAN.md` 第四章。
