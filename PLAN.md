# 私有聊天室项目开发计划

## 一、项目目标

基于 4C4G 香港服务器,自建一个端到端加密(E2EE)的私有聊天系统,支持:
- 用户注册/登录
- 一对一私聊
- 群聊房间
- 消息历史持久化
- 文件/图片发送(加密传输)
- 在线状态/正在输入
- 端到端加密

服务器/客户端架构,纯私有,不对外开放注册。

---

## 二、技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 后端运行时 | Node.js 20 + TypeScript | 类型安全,生态好 |
| Web 框架 | Express | 轻量,搭配 Socket.IO 顺手 |
| 实时通信 | Socket.IO | 自动重连/降级,WebSocket 封装 |
| 数据库 | PostgreSQL 16 | 生产级,支持 JSONB/全文搜索 |
| ORM/查询 | node-postgres (pg) | 直接 SQL,无抽象损耗 |
| 认证 | JWT + bcrypt | 无状态,适合分布式 |
| 文件存储 | 本地磁盘(v1) | 单机够用,后期可换 S3 |
| 反向代理 | Nginx | TLS 终结 + 静态文件 |

| 层级 | 选型 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 生态成熟 |
| 构建工具 | Vite 5 | 启动快,HMR 流畅 |
| 路由 | React Router 6 | 标准方案 |
| 状态管理 | Zustand | 轻量,无模板代码 |
| 样式 | Tailwind CSS 3 | 快速出 UI |
| HTTP 客户端 | Axios | 拦截器好用 |
| 实时客户端 | socket.io-client | 与服务端配套 |
| E2EE 库 | libsodium-wrappers | 业界标准(X25519 + ChaCha20-Poly1305) |
| 本地存储 | IndexedDB(idb-keyval) | 存私钥 + 会话状态 |

| 部署 | 选型 | 说明 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 一键起服务 |
| 数据库 | postgres:16-alpine | 官方镜像 |
| 反代 | nginx:alpine | 配 TLS |
| 编排 | docker-compose | 单机部署 |

---

## 三、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器客户端 (React)                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  UI 层        │  │  状态层       │  │  加密层       │      │
│  │  React        │←→│  Zustand      │←→│  libsodium   │      │
│  │  Tailwind     │  │  IndexedDB    │  │  (X25519+    │      │
│  │               │  │              │  │   ChaCha20)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↕ HTTP/REST            ↕ WebSocket (Socket.IO)      │
└─────────────────────────────┬───────────────────────────────┘
                              │ TLS (Nginx)
┌─────────────────────────────┴───────────────────────────────┐
│  香港服务器 (4C4G)                                           │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Nginx (TLS 终结 + 反代)                         │      │
│  │   /api/*  →  backend:3000                        │      │
│  │   /socket.io/*  →  backend:3000                  │      │
│  │   /  →  frontend static (built React)            │      │
│  └──────────────────────────────────────────────────┘      │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Backend (Node.js + Express + Socket.IO)         │      │
│  │   - 鉴权 (JWT)                                   │      │
│  │   - REST API (历史消息/房间/文件)                 │      │
│  │   - WebSocket 事件 (实时消息/状态/输入)           │      │
│  │   - 加密信封转发(只看密文,不解密)                 │      │
│  └──────────────────────────────────────────────────┘      │
│           ↕                       ↕                          │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  PostgreSQL 16   │    │  本地文件存储      │              │
│  │  (用户/房间/      │    │  (加密文件块)      │              │
│  │   消息/密钥元数据) │    │                  │              │
│  └──────────────────┘    └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

**关键安全设计**:服务端**永远不接触明文**。客户端在浏览器中加密,服务端只转发和存储密文。

---

## 四、目录结构

```
chat-app/
├── README.md                          # 项目说明
├── PLAN.md                            # 本文件
├── .gitignore
├── .env.example                       # 环境变量示例
├── docker-compose.yml                 # 一键起服务
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts                   # 入口,启动 HTTP + Socket.IO
│       ├── config/
│       │   └── env.ts                 # 环境变量加载与校验
│       ├── db/
│       │   ├── pool.ts                # pg 连接池
│       │   └── migrations/
│       │       ├── 001_users.sql
│       │       ├── 002_rooms.sql
│       │       ├── 003_messages.sql
│       │       └── 004_files.sql
│       ├── auth/
│       │   ├── jwt.ts                 # token 签发与验证
│       │   ├── password.ts            # bcrypt 封装
│       │   └── middleware.ts          # 鉴权中间件
│       ├── routes/
│       │   ├── auth.ts                # POST /api/auth/register|login
│       │   ├── users.ts               # GET /api/users 搜索
│       │   ├── keys.ts                # 密钥分发
│       │   ├── rooms.ts               # 房间 CRUD
│       │   ├── messages.ts            # 消息历史
│       │   └── files.ts               # 文件上传下载
│       ├── socket/
│       │   ├── server.ts              # Socket.IO 挂载
│       │   ├── auth.ts                # socket 鉴权
│       │   ├── handlers/
│       │   │   ├── message.ts         # 消息发送
│       │   │   ├── presence.ts        # 在线状态
│       │   │   └── typing.ts          # 输入状态
│       │   └── rooms.ts               # 加入/离开房间
│       ├── storage/
│       │   └── files.ts               # 文件存储抽象
│       └── utils/
│           ├── logger.ts              # pino 日志
│           └── errors.ts              # 统一错误处理
│
├── frontend/
│   ├── Dockerfile                     # 多阶段构建,产出静态文件
│   ├── nginx.conf                     # SPA fallback
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts              # axios 实例 + 拦截器
│       │   └── socket.ts              # socket.io-client 封装
│       ├── crypto/
│       │   ├── sodium.ts              # libsodium 初始化
│       │   ├── keyManager.ts          # 密钥生成/存储/加载
│       │   ├── e2ee.ts                # 单聊 ECDH 加密
│       │   └── groupE2ee.ts           # 群聊 sender key
│       ├── auth/
│       │   ├── AuthContext.tsx        # 登录态 Context
│       │   ├── useAuth.ts
│       │   ├── LoginPage.tsx
│       │   └── RegisterPage.tsx
│       ├── store/
│       │   ├── chatStore.ts           # 房间/消息/在线状态
│       │   └── cryptoStore.ts         # 房间密钥缓存
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
│       │   └── usePresence.ts
│       ├── types/
│       │   ├── api.ts
│       │   ├── socket.ts
│       │   └── crypto.ts
│       ├── pages/
│       │   └── ChatPage.tsx
│       ├── utils/
│       │   ├── format.ts              # 时间格式化
│       │   └── download.ts            # 文件下载
│       └── styles/
│           └── index.css              # Tailwind 入口
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf                     # 主反代配置
│
└── deploy/
    ├── init.sh                        # 服务器初始化脚本
    └── README.md                      # 部署说明
```

---

## 五、数据库设计

```sql
-- 001_users.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(50) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  public_key      TEXT,                         -- X25519 公钥(base64)
  key_id          VARCHAR(64),                  -- 公钥指纹(防替换)
  avatar_color    VARCHAR(7) DEFAULT '#3b82f6',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 002_rooms.sql
CREATE TABLE rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100),                 -- 群聊名称(私聊为 NULL)
  is_direct       BOOLEAN DEFAULT FALSE,        -- 是否一对一
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE room_members (
  room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(20) DEFAULT 'member', -- 'admin' | 'member'
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  last_read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- 一对一用单独表,避免 is_direct 标志带来的复杂约束
CREATE TABLE direct_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID REFERENCES users(id),
  user_b_id       UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

-- 003_messages.sql
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID REFERENCES rooms(id) ON DELETE CASCADE,
  direct_id       UUID REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id),
  ciphertext      TEXT NOT NULL,                -- base64 密文
  nonce           TEXT NOT NULL,                -- base64 nonce
  key_id          VARCHAR(64),                  -- 标识用了哪把密钥(便于轮换)
  type            VARCHAR(20) DEFAULT 'text',   -- text | file | image
  file_id         UUID,                         -- type=file 时关联
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ,
  CHECK ((room_id IS NOT NULL) <> (direct_id IS NOT NULL))
);

CREATE INDEX idx_messages_room_time ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_direct_time ON messages(direct_id, created_at DESC);

-- 004_files.sql
CREATE TABLE files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id     UUID REFERENCES users(id),
  storage_path    TEXT NOT NULL,                -- 服务端路径
  size_bytes      BIGINT NOT NULL,
  mime_ciphertext TEXT,                         -- 加密的 mime(可选)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 六、API 设计

### REST API

```
POST   /api/auth/register        # 注册 { username, password, publicKey, keyId }
POST   /api/auth/login           # 登录 { username, password } → { token, user }
GET    /api/auth/me              # 当前用户信息

GET    /api/users                # 搜索用户 ?q=
GET    /api/users/:id/public-key # 拿对方公钥

GET    /api/rooms                # 我的房间列表
POST   /api/rooms                # 创建群聊 { name, memberIds[] }
GET    /api/rooms/:id            # 房间详情
POST   /api/rooms/:id/members    # 拉人
DELETE /api/rooms/:id/members/:uid  # 踢人

GET    /api/direct/:userId       # 拿到与某用户的私聊房间(没有则创建)
GET    /api/direct/:userId/messages?before=&limit=  # 私聊历史

GET    /api/rooms/:id/messages?before=&limit=      # 群聊历史
POST   /api/rooms/:id/read       # 标记已读,更新时间

POST   /api/files/upload         # multipart,上传加密文件 → { fileId }
GET    /api/files/:id            # 下载加密文件
```

### Socket.IO 事件

**客户端 → 服务端**:
```
message:send      { roomId|directId, ciphertext, nonce, keyId, type, fileId? }
message:edit      { messageId, ciphertext, nonce, keyId }
typing:start      { roomId|directId }
typing:stop       { roomId|directId }
room:join         { roomId }      # 加入房间
room:leave        { roomId }
direct:join       { directId }
```

**服务端 → 客户端**:
```
message:new       { ...完整消息对象 }
message:edited    { messageId, ... }
typing:update     { userId, roomId|directId, isTyping }
presence:update   { userId, online: bool }
room:user-joined  { roomId, user }
room:user-left    { roomId, userId }
error             { code, message }
```

---

## 七、E2EE 设计

### 单聊(1-on-1):ECDH 派生对称密钥
1. 用户 A 注册时生成 X25519 密钥对
2. 私钥存浏览器 IndexedDB,公钥上传服务端
3. A 发消息给 B 时:
   - 用 A 私钥 + B 公钥 做 ECDH → 派生共享密钥 K(每次消息可加 salt)
   - 用 K + ChaCha20-Poly1305 加密明文 → 密文 + nonce
4. 服务端只看到密文,无法解密

### 群聊:Sender Keys(简化版)
1. 创建者生成群组对称密钥 K_group
2. 创建者用与每个成员各自的 ECDH 密钥分别加密 K_group → 多个信封
3. 通过 `message:send`(type=`group_key`)分发给每个成员
4. 之后所有群消息都用 K_group 加密
5. 成员变动时轮换 K_group(老成员无法读新消息,新成员拿到新密钥)

### 文件加密
1. 浏览器用 `crypto.subtle` 或 libsodium 生成随机密钥 K_file
2. 用 K_file 加密文件 → 密文上传服务端
3. 在消息信封中附带 K_file(用对应收件人密钥加密)
4. 接收方先解密信封拿到 K_file,再下载并解密文件

**威胁模型**:
- ✅ 服务端被入侵 → 只拿到密文
- ✅ 数据库泄漏 → 用户元数据泄漏,内容安全
- ⚠️ 终端被入侵(恶意 JS 注入)→ 不在防御范围,需保证前端代码可信
- ⚠️ 密钥丢失 → 旧消息无法恢复(可考虑可选的密钥备份机制)

---

## 八、实施阶段

### Phase 1:基础设施 (1-2h)
- [ ] 目录结构创建
- [ ] docker-compose.yml 骨架
- [ ] 数据库迁移脚本
- [ ] 后端基础项目(Express + Socket.IO + 优雅关闭)
- [ ] 前端基础项目(Vite + React + Tailwind)
- [ ] Nginx 配置

### Phase 2:认证模块 (1h)
- [ ] 后端:bcrypt 密码、JWT 签发、注册/登录接口
- [ ] 前端:AuthContext、登录页、注册页
- [ ] 前后端联调

### Phase 3:房间与消息 (3-4h)
- [ ] 后端:房间 CRUD、成员管理
- [ ] 后端:消息历史分页接口
- [ ] 后端:Socket.IO 鉴权 + message 事件
- [ ] 前端:侧边栏(房间列表 + 用户搜索)
- [ ] 前端:聊天窗口(消息列表 + 输入框)
- [ ] 联调:能发送、接收、展示

### Phase 4:状态增强 (1-2h)
- [ ] 在线状态(presence)
- [ ] 正在输入(typing)
- [ ] 已读回执(可选)
- [ ] 未读计数

### Phase 5:E2EE (3-4h,最复杂)
- [ ] libsodium 集成
- [ ] 密钥生成/存储
- [ ] 单聊 ECDH 加密
- [ ] 群聊 Sender Keys
- [ ] 加密消息的发送/接收
- [ ] 文件加密传输

### Phase 6:UI 打磨 (1-2h)
- [ ] 响应式(移动端)
- [ ] 暗色模式
- [ ] 消息时间分组
- [ ] 文件/图片预览
- [ ] 加载/空状态/错误提示

### Phase 7:部署 (1h)
- [ ] 服务器初始化(防火墙、Docker)
- [ ] TLS 证书(Let's Encrypt 或自签)
- [ ] docker compose up
- [ ] 验证全链路
- [ ] 备份策略说明

**总工作量估计:12-15 小时**

---

## 九、安全与运维清单

部署前必须确认:
- [ ] 服务器防火墙(只开 22/80/443)
- [ ] SSH 改密钥登录
- [ ] 自动安全更新
- [ ] Docker 日志轮转
- [ ] 数据库每日自动备份
- [ ] 配置文件不进 Git(.env 加入 .gitignore)
- [ ] JWT secret 用强随机(>32 字节)
- [ ] bcrypt cost ≥ 12
- [ ] TLS 1.2+ 强制,禁用老协议
- [ ] CORS 严格限制
- [ ] Socket.IO 鉴权拒绝匿名连接
- [ ] 上传文件大小/类型限制
- [ ] 速率限制(防爆破)

---

## 十、风险与限制

| 风险 | 说明 | 缓解 |
|------|------|------|
| E2EE 复杂度 | 群聊密钥轮换/前向保密实现复杂 | v1 用简化 Sender Key,接受"成员变更后旧消息仍可读" |
| 私钥丢失 | 用户清浏览器数据 = 永久丢失密钥 | 提示用户备份;或加助记词恢复(可选) |
| 终端入侵 | 恶意脚本可读明文 | 部署简单 CSP,生产构建不引入可疑依赖 |
| 香港服务器风险 | 政治敏感期可能断联 | 备份方案:数据可迁移到其他云 |
| 个人项目运维 | 一个人维护,易懈怠 | 写好文档、自动化部署、监控告警 |

---

## 十一、后续扩展(可选)

- 消息编辑/撤回
- @ 提及
- 表情回复(emoji reaction)
- 消息搜索(服务端建索引,但只能搜密文 → 不做)
- 推送通知(Web Push)
- 移动端 PWA
- 语音/视频通话(WebRTC,需要 STUN/TURN)

---

**状态**:计划待评审
**下一步**:用户确认计划后,按 Phase 1 开始实施
