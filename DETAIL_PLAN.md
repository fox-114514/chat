# 私有聊天室 —— 详细开发执行文档

> 本文档供 AI 编码助手按步骤执行。所有目录、文件、接口、函数、数据流均已细化。
> 开发原则：**先做 MVP（无 E2EE，服务端存明文），验证全链路跑通后，再在 v2 叠加 E2EE。**

---

## 一、项目总览

### 1.1 目标
基于 Docker Compose 部署的私有聊天系统，部署在香港 4C4G 服务器。

### 1.2 版本策略
- **v1 MVP**：注册/登录、房间/私聊、消息收发、文件传输、在线状态、部署可用。**不实现 E2EE，服务端临时存明文。**
- **v2 E2EE**：在 v1 稳定后叠加 libsodium 端到端加密。

### 1.3 技术栈（固定不变）
| 层级 | 选型 |
|------|------|
| 后端 | Node.js 20 + TypeScript + Express + Socket.IO |
| 数据库 | PostgreSQL 16 + `pg` 驱动 |
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand |
| 实时通信 | Socket.IO（前后端一致） |
| 部署 | Docker + Docker Compose + Nginx |
| E2EE(v2) | libsodium-wrappers (X25519 + ChaCha20-Poly1305) |

### 1.4 关键约定
- 所有时间戳用 `TIMESTAMPTZ`，接口返回 ISO 8601 字符串。
- 主键统一用 UUID（`gen_random_uuid()`）。
- 密码哈希用 bcrypt，cost = 12。
- JWT 有效期：accessToken 15 分钟，refreshToken 7 天。
- 前端路由：`/login`、`/register`、`/chat/:roomId?`。
- 错误统一返回 `{ error: string, code?: string }`。

---

## 二、目录结构（必须严格按此创建）

```
chat-app/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
├── PLAN.md
├── DETAIL_PLAN.md          # 本文件
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts
│       ├── config/
│       │   └── env.ts
│       ├── db/
│       │   ├── pool.ts
│       │   ├── migrate.ts
│       │   └── migrations/
│       │       ├── 001_users.sql
│       │       ├── 002_rooms.sql
│       │       ├── 003_messages.sql
│       │       └── 004_files.sql
│       ├── auth/
│       │   ├── jwt.ts
│       │   ├── password.ts
│       │   └── middleware.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── users.ts
│       │   ├── rooms.ts
│       │   ├── messages.ts
│       │   └── files.ts
│       ├── socket/
│       │   ├── server.ts
│       │   ├── auth.ts
│       │   ├── middleware.ts
│       │   └── handlers/
│       │       ├── message.ts
│       │       ├── presence.ts
│       │       ├── typing.ts
│       │       └── rooms.ts
│       ├── storage/
│       │   └── files.ts
│       └── utils/
│           ├── logger.ts
│           ├── errors.ts
│           └── asyncHandler.ts
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       ├── api/
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── users.ts
│       │   ├── rooms.ts
│       │   ├── messages.ts
│       │   └── files.ts
│       ├── socket/
│       │   └── socket.ts
│       ├── auth/
│       │   ├── AuthContext.tsx
│       │   ├── useAuth.ts
│       │   ├── LoginPage.tsx
│       │   └── RegisterPage.tsx
│       ├── store/
│       │   ├── chatStore.ts
│       │   └── uiStore.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   └── Sidebar.tsx
│       │   ├── chat/
│       │   │   ├── ChatWindow.tsx
│       │   │   ├── MessageList.tsx
│       │   │   ├── MessageItem.tsx
│       │   │   ├── MessageInput.tsx
│       │   │   ├── FileUploadButton.tsx
│       │   │   └── TypingIndicator.tsx
│       │   ├── rooms/
│       │   │   ├── RoomList.tsx
│       │   │   ├── CreateRoomModal.tsx
│       │   │   └── UserSearchModal.tsx
│       │   └── common/
│       │       ├── Avatar.tsx
│       │       ├── Modal.tsx
│       │       └── Button.tsx
│       ├── hooks/
│       │   ├── useSocket.ts
│       │   ├── useMessages.ts
│       │   ├── usePresence.ts
│       │   └── useTyping.ts
│       ├── types/
│       │   ├── api.ts
│       │   ├── socket.ts
│       │   └── models.ts
│       ├── pages/
│       │   └── ChatPage.tsx
│       └── utils/
│           ├── format.ts
│           └── download.ts
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
│
└── deploy/
    ├── init.sh
    └── README.md
```

---

## 三、数据库设计（详细 Schema）

所有迁移文件放在 `backend/src/db/migrations/`，执行顺序按文件名前缀数字。

### 3.1 001_users.sql
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(50) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  public_key      TEXT,                         -- v2 E2EE 用，v1 可为 NULL
  avatar_color    VARCHAR(7) DEFAULT '#3b82f6',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
```

### 3.2 002_rooms.sql
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100),                 -- 群聊名称；私聊为 NULL
  is_direct       BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) DEFAULT 'member',
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members(user_id);
CREATE INDEX idx_room_members_room ON room_members(room_id);
```

> v1 决策：**所有聊天统一用 `rooms` 表**，私聊用 `is_direct = TRUE` 标识。不再单独建 `direct_conversations` 表，避免 messages 双外键问题。

### 3.3 003_messages.sql
```sql
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,                -- v1 明文；v2 时改为 ciphertext base64
  type            VARCHAR(20) DEFAULT 'text',   -- text | file | image
  file_id         UUID,                         -- 关联 files 表
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ
);

CREATE INDEX idx_messages_room_time ON messages(room_id, created_at DESC);
```

### 3.4 004_files.sql
```sql
CREATE TABLE IF NOT EXISTS files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id     UUID NOT NULL REFERENCES users(id),
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  storage_path    TEXT NOT NULL,
  original_name   TEXT,
  size_bytes      BIGINT NOT NULL,
  mime_type       VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 四、后端详细设计

### 4.1 公共工具模块

#### `backend/src/utils/logger.ts`
- 使用 `pino`。
- 导出 `logger` 实例。
- 配置：开发环境 pretty print，生产 JSON。

#### `backend/src/utils/errors.ts`
```ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message);
  }
}
```

#### `backend/src/utils/asyncHandler.ts`
```ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

### 4.2 环境配置 `backend/src/config/env.ts`
必须校验的环境变量：
```ts
interface Env {
  PORT: number;
  NODE_ENV: 'development' | 'production';
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  BCRYPT_ROUNDS: number;
  CORS_ORIGIN: string;
  FILE_UPLOAD_MAX_BYTES: number;
  STORAGE_PATH: string;
}
```
未设置必填项时进程直接退出并打印错误。

### 4.3 数据库连接 `backend/src/db/pool.ts`
- 用 `new Pool({ connectionString: env.DATABASE_URL })`。
- 导出 `pool`。

#### `backend/src/db/migrate.ts`
- 启动时执行：按文件名排序读取 `migrations/` 下所有 `.sql`，逐条用 `pool.query(sql)` 执行。
- 失败时进程退出。

### 4.4 认证模块

#### `backend/src/auth/password.ts`
```ts
import bcrypt from 'bcrypt';
import { env } from '../config/env';

export const hashPassword = (plain: string) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

#### `backend/src/auth/jwt.ts`
```ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload { userId: string; username: string; }

export const signAccessToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;

// refresh token 校验，用于后续 refresh 接口
export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
```

#### `backend/src/auth/middleware.ts`
- 从 `Authorization: Bearer <token>` 读取 accessToken。
- 验证失败返回 401。
- 成功后在 `req.user` 上挂载 `{ userId, username }`。
- 声明 `express.d.ts` 扩展 Request 类型。

### 4.5 REST 路由

#### `POST /api/auth/register`
请求体：
```json
{
  "username": "alice",
  "password": "min8chars"
}
```
逻辑：
1. 检查用户名是否已存在。
2. `hashPassword`。
3. 插入 users，返回 `{ id, username, created_at }`。
4. 生成 accessToken + refreshToken。
5. 返回 `{ user, accessToken, refreshToken }`。

#### `POST /api/auth/login`
请求体：
```json
{ "username": "alice", "password": "..." }
```
逻辑：
1. 按 username 查用户。
2. `comparePassword`。
3. 成功后返回 token 和用户。

#### `GET /api/auth/me`
需要认证。返回当前用户信息。

#### `GET /api/users?q=`
需要认证。按 username ILIKE 搜索，最多返回 20 条。
返回：`{ users: User[] }`。

#### `GET /api/rooms`
需要认证。返回当前用户加入的所有房间，按最近消息时间排序（可简化：按 created_at 降序）。
返回字段：`id, name, is_direct, created_by, created_at, members_count, unread_count`。

> 私聊房间名显示：取对方 username。

#### `POST /api/rooms`
请求体：`{ name: string, memberIds: string[] }`
逻辑：
1. 校验 memberIds 至少包含一个非自己的用户（创建群聊）。
2. 插入 rooms。
3. 插入 room_members：创建者 role = 'admin'，其他 role = 'member'。
4. 返回房间详情 + 成员列表。

#### `GET /api/rooms/:id`
需要认证且是成员。返回房间详情 + 成员列表。

#### `POST /api/rooms/:id/members`
请求体：`{ userId: string }`
逻辑：只有 admin 可拉人；插入 room_members。

#### `DELETE /api/rooms/:id/members/:userId`
只有 admin 可踢人；不能踢自己；删除 room_members。

#### `GET /api/direct/:userId`
需要认证。查找与目标用户的私聊房间（is_direct = true 且 room_members 恰好是这两人）。
- 如果存在：返回 room。
- 如果不存在：创建房间（name = null, is_direct = true），并加入双方，返回 room。

#### `GET /api/rooms/:id/messages?before=<id>&limit=20`
需要认证且是成员。
- 查询 room_id = :id 的消息。
- `before` 是消息 id，查询 `created_at < (select created_at from messages where id = before)`。
- 默认 limit = 20，最大 50。
- 按 created_at DESC 返回，前端再反转显示。
- 包含 sender 基本信息（id, username, avatar_color）。
- 如果 message.file_id 存在，联表 files 返回文件元数据。

#### `POST /api/rooms/:id/read`
需要认证且是成员。更新 `room_members.last_read_at = NOW()`。

#### `POST /api/files/upload`
需要认证。multipart/form-data，字段名 `file`。
- 限制大小：读取 `FILE_UPLOAD_MAX_BYTES`（默认 20MB）。
- 保存到 `STORAGE_PATH/uploads/` 下，文件名为 `${uuid}.${ext}`。
- 插入 files 表。
- 返回 `{ file: { id, originalName, sizeBytes, mimeType, url } }`。

#### `GET /api/files/:id`
需要认证。根据 files.id 查 storage_path，用 `res.sendFile` 返回。
- v2 时文件是密文，mime_type 可能是 application/octet-stream，这里直接返回原始字节。

### 4.6 Socket.IO 服务端 `backend/src/socket/`

#### `backend/src/socket/server.ts`
- 用 `new Server(httpServer, { cors: { origin: env.CORS_ORIGIN } })`。
- 注册中间件 `auth.ts`。
- 注册 handlers：`message.ts`、`presence.ts`、`typing.ts`、`rooms.ts`。
- 维护内存状态：`onlineUsers: Map<userId, Set<socketId>>`。
- 用户断开时，如果该 userId 没有其它 socket，广播 `presence:update offline`。

#### `backend/src/socket/auth.ts`
- 从 socket.handshake.auth.token 取 accessToken。
- `verifyAccessToken`。
- 失败调用 `next(new Error('Unauthorized'))`。
- 成功在 `socket.data.user` 挂载用户信息。

#### `backend/src/socket/handlers/message.ts`
监听 `message:send`：
```ts
socket.on('message:send', async (data, callback) => {
  // data: { roomId, content, type = 'text', fileId? }
  // 1. 校验 roomId 存在且 socket.data.user 是成员
  // 2. 如果是 file 类型，校验 fileId 属于当前用户
  // 3. 插入 messages
  // 4. 向 roomId 广播 message:new（含 sender 信息、file 元数据）
  // 5. callback({ ok: true, message })
});
```

#### `backend/src/socket/handlers/presence.ts`
- 连接建立时，把 socket 加入 `onlineUsers[userId]`。
- 如果是该 userId 的第一个 socket，广播 `presence:update { userId, online: true }`。
- 断开时移除，若为空广播 `presence:update { userId, online: false }`。

#### `backend/src/socket/handlers/typing.ts`
监听 `typing:start`、`typing:stop`：
```ts
socket.on('typing:start', ({ roomId }) => {
  socket.to(roomId).emit('typing:update', { userId, roomId, isTyping: true });
});
```

#### `backend/src/socket/handlers/rooms.ts`
监听 `room:join`、`room:leave`：
```ts
socket.on('room:join', async ({ roomId }) => {
  // 校验成员后 socket.join(roomId)
});
```

### 4.7 错误处理 `backend/src/index.ts`
- Express 全局错误处理中间件：捕获 `AppError` 和未知错误，返回 JSON。
- 未捕获的 Promise 异常用 `process.on('unhandledRejection')` 记录并退出。

---

## 五、前端详细设计

### 5.1 API 客户端 `frontend/src/api/client.ts`
- 用 axios.create({ baseURL: '/api' })。
- 请求拦截器：从 localStorage 读 `accessToken` 加到 `Authorization`。
- 响应拦截器：401 时清空 token 跳转 `/login`。

### 5.2 认证上下文 `frontend/src/auth/AuthContext.tsx`
- 状态：`user`、`accessToken`、`isLoading`。
- 登录/注册成功后保存 token 到 localStorage，设置 axios 默认 header。
- 页面刷新时调用 `GET /api/auth/me` 恢复登录态。
- 提供 `login(credentials)`、`register(credentials)`、`logout()`。

### 5.3 路由 `frontend/src/App.tsx`
```tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/chat/:roomId" element={<ChatPage />} />
    <Route path="/" element={<Navigate to="/chat" />} />
  </Routes>
</BrowserRouter>
```

### 5.4 Socket 封装 `frontend/src/socket/socket.ts`
- 用 `io({ auth: { token } })`。
- 封装 `emitWithAck(event, payload)` 返回 Promise。
- 导出 `socket` 单例。

### 5.5 全局状态 `frontend/src/store/`

#### `chatStore.ts`（Zustand）
```ts
interface ChatState {
  rooms: Room[];
  currentRoomId: string | null;
  messages: Record<roomId, Message[]>;
  typing: Record<roomId, Set<string>>;
  onlineUsers: Set<string>;
  setRooms, setCurrentRoom, appendMessage, prependMessages,
  updateTyping, setUserOnline, setUserOffline
}
```

#### `uiStore.ts`
- `sidebarOpen: boolean`（移动端用）
- `theme: 'light' | 'dark'`

### 5.6 页面与组件

#### `LoginPage.tsx` / `RegisterPage.tsx`
- 表单：username、password、confirmPassword（注册）。
- 调用 AuthContext 方法。
- 错误提示。

#### `ChatPage.tsx`
- 两栏布局：Sidebar + ChatWindow。
- 根据 `/:roomId` 设置 currentRoom。

#### `Sidebar.tsx`
- 顶部：当前用户头像 + 用户名 + 登出按钮。
- 搜索框：搜索用户，点击发起私聊（调用 `GET /api/direct/:userId` 后跳转）。
- "新建群聊" 按钮：弹出 CreateRoomModal。
- 房间列表：展示 room name / 对方用户名、未读数、最后消息预览（v1 可不做）。

#### `RoomList.tsx`
- props: `rooms, currentRoomId, onSelect`。
- 私聊显示对方 username 和 avatar。
- 当前房间高亮。

#### `CreateRoomModal.tsx`
- 输入群名。
- 用户搜索，可多选成员。
- 调用 `POST /api/rooms` 成功后跳转。

#### `UserSearchModal.tsx`
- 输入关键词，debounce 300ms 调用 `GET /api/users?q=`。
- 点击用户 -> `GET /api/direct/:userId` -> 跳转。

#### `ChatWindow.tsx`
- props: `roomId`。
- 进入时：
  1. `socket.emit('room:join', { roomId })`
  2. `GET /api/rooms/:id/messages` 加载历史
  3. `POST /api/rooms/:id/read`
- 离开时 `socket.emit('room:leave', { roomId })`。
- 监听 `message:new`、`typing:update`。

#### `MessageList.tsx`
- 滚动容器，消息按时间正序排列。
- 自己消息靠右，他人靠左。
- 支持滚动加载更多（v1 可选）。

#### `MessageItem.tsx`
- 根据 `type` 渲染：text / file / image。
- image 类型显示缩略图（用 `/api/files/:id` URL）。
- file 类型显示文件名 + 大小 + 下载按钮。

#### `MessageInput.tsx`
- 文本输入框。
- 回车发送（Shift+Enter 换行）。
- 输入时 emit `typing:start`，停止输入 1 秒后 emit `typing:stop`。
- 发送调用 `socket.emit('message:send', { roomId, content, type: 'text' })`。

#### `FileUploadButton.tsx`
- 点击选择文件。
- 先 `POST /api/files/upload`，成功后 `socket.emit('message:send', { type: 'file', fileId, content: originalName })`。
- 图片文件（mime 以 image/ 开头）type 用 `'image'`，否则 `'file'`。
- 上传中显示进度条（可用 axios onUploadProgress）。

#### `TypingIndicator.tsx`
- 显示 "xxx 正在输入..."。

#### `Avatar.tsx`
- 根据 username 首字母 + avatar_color 生成圆形头像。

### 5.7 Hooks

#### `useSocket.ts`
- 在 AuthContext 初始化后连接 socket。
- 监听全局事件：`message:new`、`presence:update`、`typing:update`。
- 返回 `socket`。

#### `useMessages.ts(roomId)`
- 加载历史消息。
- 订阅 `message:new` 并追加到 store。
- 返回 `messages, loadMore, hasMore`。

#### `usePresence.ts`
- 维护在线用户 Set。
- 监听 `presence:update`。

#### `useTyping.ts(roomId)`
- 维护当前房间的 typing 用户 Set。
- 监听 `typing:update`，超时自动清除。

### 5.8 工具函数

#### `frontend/src/utils/format.ts`
- `formatTime(iso: string): string` —— 今天显示时间，昨天显示 "昨天"，更早显示日期。
- `formatFileSize(bytes: number): string` —— B/KB/MB。

#### `frontend/src/utils/download.ts`
- `downloadFile(fileId: string, fileName: string)` —— 创建 `<a>` 标签触发下载。

---

## 六、前后端交互协议（必须严格遵守）

### 6.1 REST 响应格式
成功：
```json
{ "data": <any> }
```
或直接使用资源对象（如 `POST /api/auth/register` 返回 `{ user, accessToken, refreshToken }`）。

错误：
```json
{ "error": "human readable message", "code": "OPTIONAL_CODE" }
```

### 6.2 Socket.IO 事件

#### 客户端 -> 服务端
| 事件 |  payload | 说明 |
|------|----------|------|
| `message:send` | `{ roomId, content, type, fileId? }` | callback: `(res: { ok: boolean, message?: Message, error?: string }) => void` |
| `typing:start` | `{ roomId }` | |
| `typing:stop` | `{ roomId }` | |
| `room:join` | `{ roomId }` | callback 确认加入 |
| `room:leave` | `{ roomId }` | |

#### 服务端 -> 客户端
| 事件 | payload |
|------|---------|
| `message:new` | `Message` |
| `typing:update` | `{ userId, roomId, isTyping: boolean }` |
| `presence:update` | `{ userId, online: boolean }` |
| `error` | `{ message, code? }` |

### 6.3 TypeScript 类型 `frontend/src/types/`

```ts
// models.ts
export interface User {
  id: string;
  username: string;
  avatarColor: string;
  publicKey?: string;
}

export interface Room {
  id: string;
  name: string | null;
  isDirect: boolean;
  createdBy: string;
  members: RoomMember[];
  unreadCount?: number;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatarColor: string;
  role: 'admin' | 'member';
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender: Pick<User, 'id' | 'username' | 'avatarColor'>;
  content: string;
  type: 'text' | 'file' | 'image';
  file?: FileMeta;
  createdAt: string;
  editedAt?: string;
}

export interface FileMeta {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
}
```

---

## 七、Docker 与部署

### 7.1 `docker-compose.yml`
三个服务：
- `db`: postgres:16-alpine，卷 `postgres_data`。
- `backend`: 构建 `backend/`，依赖 db，暴露内部 3000。
- `nginx`: 构建 `nginx/`，端口映射 `80:80` 和 `443:443`，挂载静态文件卷/证书。

前端构建产物通过 **nginx 挂载卷** 或 **多阶段构建到 nginx 镜像** 提供。推荐：**nginx 镜像只负责反向代理，前端用单独 Dockerfile 构建后将 `dist/` 复制到 nginx 的 `/usr/share/nginx/html`**。

### 7.2 `nginx/nginx.conf`
- `/api/*` 反代 backend:3000。
- `/socket.io/*` 反代 backend:3000，配置 WebSocket upgrade。
- `/` 服务前端静态文件，`try_files $uri $uri/ /index.html;`。
- 配置 gzip。

### 7.3 环境变量 `.env`
```bash
NODE_ENV=production
DATABASE_URL=postgresql://chat:chat@db:5432/chat
JWT_SECRET=<随机 64 字符>
JWT_REFRESH_SECRET=<另一个 64 字符>
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://your-domain.com
FILE_UPLOAD_MAX_BYTES=20971520
STORAGE_PATH=/app/storage
```

### 7.4 `deploy/init.sh`
- 安装 Docker / Docker Compose。
- 创建 `/data/chat-app`。
- 配置 ufw 放行 22/80/443。
- 拉取代码、复制 `.env`、启动 `docker compose up -d`。

---

## 八、开发顺序（Phase 清单）

### Phase 1: 基础设施（后端骨架）
1. 创建 `backend/package.json`，安装 express、socket.io、pg、bcrypt、jsonwebtoken、pino、cors、dotenv、multer、uuid、@types/*。
2. 创建 `tsconfig.json`。
3. 写 `backend/src/config/env.ts`。
4. 写 `backend/src/utils/logger.ts`、`errors.ts`、`asyncHandler.ts`。
5. 写 `backend/src/db/pool.ts`、`migrate.ts` 和 4 个迁移文件。
6. 写 `backend/src/index.ts`：启动 HTTP 服务、挂载路由、全局错误处理、优雅关闭。
7. 跑通 `npm run dev`，验证数据库迁移成功。

### Phase 2: 认证模块
1. 写 `password.ts`、`jwt.ts`、`middleware.ts`。
2. 写 `routes/auth.ts`：register / login / me。
3. 用 Postman/curl 测试注册登录。

### Phase 3: 房间与用户
1. 写 `routes/users.ts`（搜索）。
2. 写 `routes/rooms.ts`（CRUD、成员、私聊创建）。
3. 用 curl 测试创建房间、拉人、获取房间。

### Phase 4: 消息历史
1. 写 `routes/messages.ts`（分页历史、已读）。
2. 写 `socket/server.ts`、中间件、handlers。
3. 用临时 HTML/socket.io-client 测试发消息和接收。

### Phase 5: 文件上传
1. 写 `storage/files.ts`。
2. 写 `routes/files.ts`。
3. 测试上传下载。

### Phase 6: 前端骨架
1. 创建 `frontend/package.json`：react、react-dom、react-router-dom、vite、tailwindcss、postcss、autoprefixer、zustand、axios、socket.io-client、lucide-react。
2. 写 `vite.config.ts`、`tailwind.config.js`、`postcss.config.js`、`tsconfig.json`。
3. 写 `main.tsx`、`App.tsx`、路由。

### Phase 7: 前端认证页面
1. 写 `AuthContext.tsx`、`LoginPage.tsx`、`RegisterPage.tsx`。
2. 联调后端注册登录。

### Phase 8: 前端聊天主界面
1. 写 `AppLayout`、`Sidebar`、`RoomList`。
2. 写 `ChatWindow`、`MessageList`、`MessageItem`、`MessageInput`。
3. 写 `useSocket`、`useMessages`。
4. 联调消息收发。

### Phase 9: 状态增强
1. 实现 presence（在线状态）。
2. 实现 typing（正在输入）。
3. 实现未读计数。

### Phase 10: 文件与 UI 打磨
1. 实现 `FileUploadButton`、图片预览、文件下载。
2. 实现 `CreateRoomModal`、`UserSearchModal`。
3. 响应式布局、暗色模式、空状态、加载状态。

### Phase 11: Docker 部署
1. 写 `backend/Dockerfile`、`frontend/Dockerfile`、`nginx/Dockerfile`、`docker-compose.yml`。
2. 本地 `docker compose up` 跑通全链路。
3. 写 `deploy/init.sh` 和 README。

### Phase 12（v2）: E2EE
1. 安装 `libsodium-wrappers`。
2. 实现密钥生成、IndexedDB 存储、公钥上传。
3. 实现单聊 ECDH 加密/解密。
4. 实现群聊 Sender Keys。
5. 实现文件加密上传/下载。
6. 修改 messages.content 含义为 ciphertext，前端负责编解码。

---

## 九、v2 E2EE 详细设计（供后续阶段参考）

### 9.1 密钥管理
每个用户注册时：
1. `sodium.crypto_box_keypair()` 生成 X25519 密钥对。
2. 私钥用 `idb-keyval` 存 IndexedDB。
3. 公钥上传服务端 `users.public_key`。

### 9.2 单聊加密流程
A 发消息给 B：
1. A 从 IndexedDB 取自己的私钥 `skA`。
2. A 从服务端拿 B 的公钥 `pkB`。
3. A 生成临时密钥对 `epkA / eskA`。
4. ECDH: `shared = sodium.crypto_scalarmult(eskA, pkB)`。
5. HKDF 派生 `k = sodium.crypto_kdf_derive_from_key(...)`。
6. `nonce = randombytes_buf(12)`。
7. `ciphertext = crypto_aead_chacha20poly1305_ietf_encrypt(plaintext, associatedData, nonce, k)`。
8. 消息体包含：`epkA`、`nonce`、`ciphertext`。
9. B 收到后：`shared = crypto_scalarmult(skB, epkA)`，派生 k，解密。

> 这样每条消息都有独立临时密钥，实现前向保密。

### 9.3 群聊 Sender Keys
1. 创建者生成 `groupKey`（随机 32 字节）。
2. 对每个成员：用该成员公钥 + 自己私钥 ECDH 加密 `groupKey` -> `keyEnvelope`。
3. 通过 socket 发送 `type = 'group_key'` 的信封消息给每个成员。
4. 普通群消息：`ciphertext = chacha20poly1305_encrypt(plaintext, groupKey, nonce)`。
5. 成员加入/退出：创建者生成新 `groupKey`，只分发给当前成员。旧消息对新成员不可见。

### 9.4 文件加密
1. 浏览器生成随机 `fileKey`。
2. 用 `fileKey` 加密文件 -> 密文上传。
3. `fileKey` 用聊天密钥加密后放在消息 content 中（作为 envelope 的一部分）。
4. 接收方解密 envelope 得 `fileKey`，再下载解密文件。

---

## 十、代码规范

- TypeScript `strict: true`。
- 后端路由函数全部用 `asyncHandler` 包裹。
- 不使用 `any`，必须定义类型。
- SQL 禁止字符串拼接，全部参数化查询。
- 文件路径禁止用户输入直接拼接到 storage_path。
- 日志不输出密码、token、私钥。
- 前端组件函数式组件 + hooks，避免 class 组件。
- 颜色、间距尽量用 Tailwind 标准类。

---

## 十一、验收标准

### v1 MVP 完成标准
- [ ] Docker Compose 一键启动无报错
- [ ] 可注册、登录、登出
- [ ] 可搜索用户并发起私聊
- [ ] 可创建群聊并拉人
- [ ] 可发送/接收文本消息
- [ ] 可发送/接收图片和文件
- [ ] 消息历史分页加载正常
- [ ] 在线状态实时显示
- [ ] 正在输入提示正常
- [ ] 未读消息计数显示
- [ ] 移动端侧边栏可折叠
- [ ] 部署脚本可用

### v2 E2EE 完成标准
- [ ] 服务端数据库中 messages.content 为不可读密文
- [ ] 私聊双方可正常加解密
- [ ] 群聊成员可正常加解密
- [ ] 文件为密文存储
- [ ] 新成员无法读取旧群消息
- [ ] 被踢出成员无法读取新群消息

---

## 十二、给 minimax 的特别提示

1. **不要一次性写完全部代码**。按 Phase 顺序逐个实现，每完成一个 Phase 就要能运行、能测试。
2. **先写后端，再写前端**。后端 API 稳定后，前端才好对接。
3. **v1 先不做 E2EE**。先把明文消息全流程跑通，再加加密。否则调试困难。
4. **每写一个路由/组件都要配类型**。TypeScript 严格模式不能出现 `any`。
5. **数据库迁移必须幂等**：每个 migration 文件开头用 `CREATE TABLE IF NOT EXISTS` 和 `CREATE INDEX IF NOT EXISTS`。
6. **错误处理要统一**：后端所有异步路由用 `asyncHandler`，前端 API 错误在组件里显示提示。
7. **测试工具**：后端可用 curl/Postman，前端先跑 `npm run dev`，最终用 `docker compose up` 验收。
8. **有疑问时回查本文档的"版本策略"和"开发顺序"**，不要偏离主线。
