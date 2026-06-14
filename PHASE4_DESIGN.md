# Phase 4 设计文档 —— 消息历史 + Socket.IO 实时层

> 本文档是动手写代码前的设计稿,先对齐方向,再实现。
> 范围:消息 REST 接口 + Socket.IO 服务端(含 auth / rooms / presence / typing / message 事件)。
> v1 服务端只转发明文,不实现 E2EE。

---

## 一、本阶段目标

1. 客户端能**分页拉历史消息**(`GET /api/rooms/:id/messages`)
2. 客户端能**标记已读**(`POST /api/rooms/:id/read`)
3. 客户端能通过 **WebSocket 实时收发**消息
4. 客户端能感知**在线状态**和**正在输入**
5. 服务端**永远是明文透明的转发者**(v1,无 E2EE)

---

## 二、待交付文件清单

```
backend/src/
├── routes/
│   ├── rooms.ts                 (改)  挂载 /:id/messages 和 /:id/read
│   └── messages.ts              (新)  消息查询逻辑模块,**不被 index.ts 直接挂载**
├── db/
│   └── rooms.ts                 (已有) Phase 3 已有,本阶段继续用
│                                fetchRoomMembers / fetchRoomMembersBatch / requireMember
│                                (REST 和 socket 共用)
├── socket/
│   ├── server.ts                (新)  从 index.ts 抽出,挂中间件和 handlers
│   ├── auth.ts                  (新)  Socket.IO 鉴权中间件
│   ├── onlineUsers.ts           (新)  内存在线状态
│   └── handlers/
│       ├── rooms.ts             (新)  room:join / room:leave
│       ├── message.ts           (新)  message:send
│       └── typing.ts            (新)  typing:start / typing:stop
├── types/
│   ├── socket.ts                (新)  Socket.IO 事件类型 + SocketData
│   └── models.ts                (改)  加 Message / FileMeta / MessageRow / rowToMessage
└── index.ts                     (改)  不再直接创建 io,改调 socket/server.ts
```

> **注意**:没有 `socket.d.ts`。Socket.IO 4 用泛型参数指定 `SocketData`,不需要模块增强。

---

## 三、REST:消息历史

### 3.1 `GET /api/rooms/:id/messages?before=<id>&limit=20`

**挂载位置**:在 `routes/rooms.ts` 中:
```ts
import * as messageController from './messages';
router.get('/:id/messages', requireAuth, messageController.list);
router.post('/:id/read', requireAuth, messageController.markRead);
```

**权限**:需 `requireAuth` + 是该房间成员

**行为**:
- `before` 缺省 = 拉最新一页
- `limit` 缺省 20,硬上限 50,超过截断
- `before` 是消息 UUID,服务器查该消息的 `created_at`,再查 `< 该时间` 的 `limit` 条
- 按 `created_at DESC` 返回,前端自己反转
- JOIN `users` 取 sender 基本信息(`id, username, avatar_color`)
- LEFT JOIN `files` 取 `file_id` 对应的元数据(Phase 5 才会有真实数据,Phase 4 联表已就位)

**响应**:
```json
{
  "messages": [
    {
      "id": "uuid",
      "roomId": "uuid",
      "senderId": "uuid",
      "sender": { "id": "uuid", "username": "alice", "avatarColor": "#3b82f6" },
      "content": "hello",
      "type": "text",
      "file": null,
      "createdAt": "2026-06-14T10:00:00.000Z",
      "editedAt": null
    }
  ],
  "hasMore": true
}
```

`hasMore`:实际返回条数 == 请求 limit 视为可能还有更旧的,返回 `true`。**这是简化策略,可能让最后一页也返回 true,前端会再请求一次空列表,可接受。**

### 3.2 `POST /api/rooms/:id/read`

**权限**:需 `requireAuth` + 是该房间成员

**行为**:
```sql
UPDATE room_members
SET last_read_at = NOW()
WHERE room_id = $1 AND user_id = $2
```

响应: `{ ok: true }`。

不广播(已读状态不需要被其他人实时知道)。

---

## 四、Socket.IO 服务端

### 4.1 服务器搭建 `socket/server.ts`

从 `index.ts` 把 `new Server(...)` 抽过来,导出 `initSocket(httpServer) -> io`,在 `start()` 里调一次。

**CORS**:沿用 `env.CORS_ORIGIN`,与 HTTP 一致。

**注册顺序**:`io.use(authMiddleware)` → 各种 handlers。

**模块级单例模式**:
- `socket/server.ts` 导出 `initSocket(httpServer)`
- 内部创建 `io` 并存到模块级变量,导出 `getIO()` 给其他地方用
- `index.ts` 在 `httpServer.listen()` 前调 `initSocket(httpServer)`
- shutdown 时 `getIO().close()`

### 4.2 鉴权中间件 `socket/auth.ts`

```ts
import { verifyAccessToken } from '../auth/jwt';
import type { Socket } from 'socket.io';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string') {
    return next(new Error('NO_TOKEN'));
  }
  try {
    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
}
```

`handshake.auth` 是 Socket.IO 推荐的客户端传 token 方式,不会进 URL/header,干净。

### 4.3 在线状态 `socket/onlineUsers.ts`

```ts
export const onlineUsers = new Map<string, Set<string>>();
//                  userId  ->  Set<socketId>
```

**关键方法**:
- `add(userId, socketId)`:加 socket,如果该 userId 第一次有 socket,返回 `true`(表示"刚上线")
- `remove(userId, socketId)`:删 socket,如果该 userId 不再有 socket,返回 `true`(表示"刚下线")
- `isOnline(userId)`:查

**广播策略**:`io.emit('presence:update', ...)` 全局广播(简化实现)。
- 隐私权衡:任何已登录用户都能看到其他人的在线状态
- 缓解:v1 用户都是受邀请的,问题不大;v2 再考虑"只对同房间广播"
- 已在本文档**明确标注这个权衡**

### 4.4 共享成员查询 `db/rooms.ts`

REST 和 socket 共用,**已在 Phase 3 落地**,本阶段继续使用:

```ts
// fetchRoomMembers(pool, roomId) → RoomMember[]
//   单房间成员列表,含 username/avatar_color

// fetchRoomMembersBatch(pool, roomIds[]) → Map<roomId, RoomMember[]>
//   批量查,房间列表页用

// requireMember(pool, roomId, userId) → Promise<RoomRole>
//   校验成员身份,非成员抛 Forbidden('NOT_MEMBER')
//   返回 'admin' | 'member',REST 权限判断也用它
```

**调用约定**:所有函数显式接收 `pool` 参数(从 import `../db/pool` 传入),不依赖模块级单例。这样:
- 事务里可以传 `client` 而非 `pool`(v2 可能用到)
- 测试里可以注入 mock pool

`routes/rooms.ts` 的 `requireMembership` 在 Phase 3 fix 中**已合并到 `requireMember`**,REST 拿 `await requireMember(pool, ...)` 返回的 role 即可。

### 4.5 Handlers

#### `handlers/rooms.ts`

- `room:join { roomId }` → 校验成员 → `socket.join(roomId)`,callback `{ ok: true }`
- `room:leave { roomId }` → `socket.leave(roomId)`,无 callback
- 错误:非成员 callback `{ ok: false, error: 'NOT_MEMBER', message: '...' }`

#### `handlers/message.ts`

`message:send { roomId, content?, type?, fileId? }`,callback 必需:
1. 校验 `roomId` 是字符串
2. `type` 缺省 `'text'`,枚举 `'text' | 'file' | 'image'`
3. `text` 类型:`content` 必填,非空,长度 ≤ 4000
4. `file`/`image` 类型:`fileId` 必填,`content` 可选(如文件名)
5. 校验调用者是该房间成员
6. `type=file|image` 时,校验 `fileId` 存在且 `files.uploader_id === 当前用户`(防止用别人的文件发消息)
7. INSERT `messages`,RETURNING *
8. 拼装完整 `Message` 对象(含 sender、file 元数据)
9. `socket.to(roomId).emit('message:new', message)`(**只发给其他人,不含发送者**;发送者从 callback 拿到)
10. callback `{ ok: true, message }`

**为什么 socket.to() 而不是 io.to()?**
- 发送者已经从 callback 拿到 message,不需要再被 broadcast 一次
- 前端不用做去重,逻辑更清晰

#### `handlers/presence.ts`

Presence 是 socket 生命周期级逻辑,写在 `socket/server.ts` 的 `io.on('connection')` 和 `socket.on('disconnect')` 里,不单独拆文件。如果后续要加 `presence:query` 事件,再拆。

#### `handlers/typing.ts`

- `typing:start { roomId }` → `socket.to(roomId).emit('typing:update', { userId, roomId, isTyping: true })`
- `typing:stop { roomId }` → 同上,`isTyping: false`
- 不校验成员(成本/收益不匹配,信任已鉴权的客户端,反正只是状态信号不是数据)

### 4.6 错误处理约定

- 有 callback 的事件:始终 callback,error 时 `{ ok: false, error: 'CODE', message: 'human' }`
- 无 callback 的事件(`typing:*`, `room:leave`):错误只 `logger.warn`,不打扰客户端
- 异常未捕获:Socket.IO 自带保护,handler 抛异常不会让进程崩;但仍 `try/catch` 显式处理,日志清晰

---

## 五、类型系统

### 5.1 `types/socket.ts` —— Socket.IO 类型

```ts
import type { Message, FileMeta } from './models';

export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'typing:update': (data: { userId: string; roomId: string; isTyping: boolean }) => void;
  'presence:update': (data: { userId: string; online: boolean }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { roomId: string }, cb: (res: AckResponse) => void) => void;
  'room:leave': (data: { roomId: string }) => void;
  'message:send': (data: MessageSendPayload, cb: (res: MessageAckResponse) => void) => void;
  'typing:start': (data: { roomId: string }) => void;
  'typing:stop': (data: { roomId: string }) => void;
}

export interface MessageSendPayload {
  roomId: string;
  content?: string;
  type?: 'text' | 'file' | 'image';
  fileId?: string;
}

export interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  code?: string;
}

export interface MessageAckResponse {
  ok: boolean;
  message?: Message;
  error?: string;
  code?: string;
}

export interface InterServerEvents {
  // 暂无
}

export interface SocketData {
  user: { userId: string; username: string };
}
```

### 5.2 Socket.IO Server 泛型使用

```ts
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types/socket';

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  { cors: { ... } },
);
```

这样 `socket.data.user` 会自动推断出类型,**不需要 `socket.d.ts` 模块增强**。

### 5.3 `types/models.ts` 扩展

```ts
export type MessageType = 'text' | 'file' | 'image';

export interface FileMeta {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  url: string; // 相对路径 /api/files/:id
}

export interface MessageSender {
  id: string;
  username: string;
  avatarColor: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender: MessageSender;
  content: string;
  type: MessageType;
  file: FileMeta | null;
  createdAt: string;
  editedAt: string | null;
}

export interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: string;
  file_id: string | null;
  created_at: Date;
  edited_at: Date | null;
  // JOIN fields
  sender_username?: string;
  sender_avatar_color?: string;
  file_original_name?: string | null;
  file_size_bytes?: string | null; // pg bigint 默认以 string 返回
  file_mime_type?: string | null;
}
```

`rowToMessage(row)` 处理 bigint 转换、`Date.toISOString()`、构造 file url:

```ts
export function rowToMessage(row: MessageRow): Message {
  let file: FileMeta | null = null;
  if (row.file_id) {
    file = {
      id: row.file_id,
      originalName: row.file_original_name ?? 'unknown',
      sizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : 0,
      mimeType: row.file_mime_type ?? 'application/octet-stream',
      url: `/api/files/${row.file_id}`,
    };
  }

  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: row.sender_username ?? 'unknown',
      avatarColor: row.sender_avatar_color ?? '#3b82f6',
    },
    content: row.content,
    type: row.type as MessageType,
    file,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at?.toISOString() ?? null,
  };
}
```

---

## 六、关键流程

### 6.1 发消息

```
Client A (已连接)            Server                     Client B
  │                            │                            │
  │ message:send {            │                            │
  │   roomId, content,        │                            │
  │   type='text' }           │                            │
  │ ───────────────────────>  │                            │
  │                            │ 1. 校验 auth (中间件已过)  │
  │                            │ 2. isMember(roomId, A)     │
  │                            │ 3. INSERT messages         │
  │                            │ 4. SELECT full + JOIN      │
  │                            │ 5. socket.to(roomId)       │
  │                            │    .emit('message:new',    │
  │                            │         message)           │
  │                            │ ───────────────────────>  │
  │ <─ callback {ok, message}  │                            │
  │                            │                            │
  │ UI: 插入到本地 store       │                            │ UI: 插入到本地 store
```

### 6.2 断线

```
Client A 断开
  │
  v
socket.on('disconnect') in server.ts:
  1. onlineUsers.remove(userId, socket.id)
  2. 如果该 userId 没别的 socket:
     io.emit('presence:update', { userId, online: false })
```

### 6.3 同一用户多端

- 浏览器 A 连接 → `onlineUsers[alice] = {sid_A}` → 广播 `online: true`
- 浏览器 B 连接 → `onlineUsers[alice] = {sid_A, sid_B}` → **不广播**(已经 online)
- 浏览器 A 断开 → `onlineUsers[alice] = {sid_B}` → **不广播**(还有别的连接)
- 浏览器 B 断开 → `onlineUsers[alice] = {}` → 广播 `online: false`

---

## 七、与 Phase 1~3 现有代码的衔接

### 7.1 `index.ts` 改造

当前 `index.ts` 里直接 `new SocketIOServer(...)` 并在 `io.on('connection')` 里写了 placeholder 调试代码。

**改造**:
- 删除 `index.ts` 里的 `new Server(...)` 和 connection handler
- 改为 `import { initSocket, getIO } from './socket/server'`
- 在 `start()` 中 `runMigrations()` 之后、`httpServer.listen()` 之前调用 `initSocket(httpServer)`
- shutdown 中改为 `getIO().close()`

### 7.2 `socket/handlers/*` 复用 `db/rooms.ts`

- `socket/handlers/rooms.ts` 的 `room:join` 校验、`socket/handlers/message.ts` 的 `message:send` 校验都直接 `await requireMember(pool, ...)`
- 角色判断(目前 socket 不需要,但保留扩展性):也由 `requireMember` 返回值提供
- Phase 3 已建好 `db/rooms.ts`,**本阶段无需新建**

### 7.3 `routes/rooms.ts` 挂载消息路由

在 `routes/rooms.ts` 中增加:

```ts
import * as messageController from './messages';

router.get('/:id/messages', requireAuth, messageController.list);
router.post('/:id/read', requireAuth, messageController.markRead);
```

**`routes/messages.ts` 只导出控制器函数,不在 `index.ts` 中挂载。**

---

## 八、关键决策（已确认）

| # | 决策 | 选择 | 备注 |
|---|------|------|------|
| 1 | presence 广播范围 | **全局** v1 | 实现简单,私有受邀用户范围可控 |
| 2 | message:send 广播是否含发送者 | **不含** | 发送者从 callback 拿,前端无需去重 |
| 3 | typing 事件是否校验成员 | **不校验** | 状态信号,无安全成本 |
| 4 | message:send content 长度上限 | **4000 字符** | text 类型强制;file/image 可选 |
| 5 | 同一用户多端 presence | **聚合** | 首连接广播上线,全断开广播下线 |
| 6 | hasMore 计算 | **返回条数 == limit 则 true** | 简化策略,可能多查一次 |
| 7 | 共享成员查询模块 | **`db/rooms.ts`** (Phase 3 已有) | REST 和 socket 共用 |
| 8 | presence 逻辑位置 | **`socket/server.ts` 内联** | 跨 socket 生命周期 |
| 9 | room:join 后回放未送达消息 | **不做** | 用 REST 拉历史 |
| 10 | 断线时更新 last_seen_at | **暂不更新** | 推迟统一做 |

---

## 九、实现顺序（给执行用）

```
1. types/models.ts: 加 Message / FileMeta / MessageRow / rowToMessage
2. db/rooms.ts: 已有,本阶段无需改
3. routes/messages.ts: 控制器模块,导 list / markRead 函数
4. routes/rooms.ts: 加 import,挂载 /:id/messages 和 /:id/read
5. types/socket.ts: 事件类型 + SocketData
6. socket/onlineUsers.ts: 内存在线状态管理
7. socket/auth.ts: 鉴权中间件
8. socket/server.ts: initSocket / getIO + connection/disconnect 里的 presence 逻辑
9. socket/handlers/rooms.ts: room:join / room:leave
10. socket/handlers/typing.ts: typing:start / typing:stop
11. socket/handlers/message.ts: message:send
12. index.ts: 改用 initSocket,删旧 io 代码
13. typecheck + build
```

---

## 十、风险与缓解

| 风险 | 缓解 |
|------|------|
| `socket.data` 类型没生效,handler 里拿不到 user | 用 Socket.IO 4 的泛型 `Server<..., SocketData>`,在 `new Server` 处统一指定 |
| 多端在线聚合写错(重复广播/漏广播) | 自测:Node 脚本开 2 个 socket 模拟多端 |
| `files.size_bytes` bigint 转换 | `rowToMessage` 显式 `Number(row.file_size_bytes)` |
| 消息历史分页用 `created_at` 而非 `id` 排序,可能同毫秒遗漏 | v1 接受,实际消息量低 |
| Socket.IO handler 抛异常导致 socket 死掉 | 所有 handler try/catch,失败 callback 错误 |
| 进程重启 → 全员下线 | 接受,重新连接后恢复;不在 v1 范围 |
| 文件被非上传者引用 | `message:send` 时校验 `files.uploader_id === 当前用户` |

---

## 十一、验收清单

- [ ] `GET /api/rooms/:id/messages?before=&limit=` 返回正确分页
- [ ] `GET /api/rooms/:id/messages` 含 sender、file(若存在)
- [ ] `POST /api/rooms/:id/read` 更新 `last_read_at`
- [ ] Socket.IO 鉴权:无 token / 无效 token 拒绝连接
- [ ] `room:join` 校验成员,非成员 callback 错
- [ ] `message:send` 后,同房间其他客户端收到 `message:new`
- [ ] `message:send` 发送者从 callback 拿到完整 message
- [ ] 多个客户端连接同一用户 → presence 只在首连/末断时广播
- [ ] `typing:start/stop` 广播给同房间(不含发送者)
- [ ] `tsc --noEmit` 干净
- [ ] `tsc` build 干净
