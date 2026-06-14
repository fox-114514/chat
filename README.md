# 私有聊天室 (Private Chat Room)

一个基于 Docker Compose 部署的私有即时通讯系统，支持一对一私聊、群聊、文件传输、在线状态和端到端加密扩展（v2）。

> **当前版本：v1 MVP**  
> v1 服务端临时存储明文消息，用于快速验证架构和全链路功能。v2 将基于 libsodium 实现端到端加密。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [部署指南](#部署指南)
- [环境变量](#环境变量)
- [API 与事件](#api-与事件)
- [开发计划](#开发计划)
- [安全说明](#安全说明)
- [常见问题](#常见问题)

---

## 功能特性

### v1 已实现

- [x] 用户注册 / 登录 / 登出
- [x] 页面刷新后自动恢复登录态
- [x] 一对一私聊（自动创建私聊房间）
- [x] 群聊创建与成员管理
- [x] 实时文本消息收发（WebSocket）
- [x] 图片 / 文件上传与下载
- [x] 消息历史分页加载
- [x] 在线状态显示
- [x] "正在输入" 提示
- [x] 未读消息计数
- [x] Docker Compose 一键部署

### v2 计划

- [ ] libsodium 端到端加密（单聊 ECDH + 群聊 Sender Keys）
- [ ] 文件端到端加密
- [ ] 密钥备份与恢复
- [ ] 消息编辑 / 撤回
- [ ] 消息搜索
- [ ] Web Push 通知

---

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| Node.js 20 + TypeScript | 运行时与类型安全 |
| Express | Web 框架 |
| Socket.IO | 实时通信 |
| PostgreSQL 16 | 数据库 |
| node-postgres (`pg`) | 数据库驱动 |
| bcrypt | 密码哈希 |
| jsonwebtoken | JWT 认证 |
| multer | 文件上传 |
| pino | 日志 |

### 前端

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | UI 框架 |
| Vite 5 | 构建工具 |
| Tailwind CSS 3 | 样式 |
| Zustand | 状态管理 |
| React Router 6 | 路由 |
| Axios | HTTP 客户端 |
| socket.io-client | 实时客户端 |
| lucide-react | 图标 |

### 部署

| 技术 | 用途 |
|------|------|
| Docker + Docker Compose | 容器化部署 |
| Nginx | 静态文件服务 + 反向代理 |
| PostgreSQL 16 Alpine | 数据库容器 |

---

## 项目结构

```
chat-app/
├── .env.example                 # 环境变量模板
├── docker-compose.yml           # Docker Compose 配置
├── README.md                    # 本文件
├── DETAIL_PLAN.md               # 详细开发执行文档
│
├── backend/                     # 后端服务
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts             # 服务入口
│       ├── config/              # 环境变量
│       ├── db/                  # 数据库连接与迁移
│       ├── auth/                # 认证（JWT / bcrypt）
│       ├── routes/              # REST API
│       ├── socket/              # Socket.IO
│       ├── storage/             # 文件存储
│       ├── types/               # 共享类型
│       └── utils/               # 工具函数
│
├── frontend/                    # 前端应用
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                 # API 调用
│       ├── auth/                # 认证上下文与页面
│       ├── components/          # UI 组件
│       ├── hooks/               # 自定义 Hooks
│       ├── pages/               # 页面
│       ├── socket/              # Socket.IO 客户端
│       ├── store/               # Zustand 状态
│       ├── styles/              # 全局样式
│       ├── types/               # 类型定义
│       └── utils/               # 工具函数
│
└── deploy/                      # 部署脚本
    ├── init.sh
    └── README.md
```

---

## 快速开始

### 环境要求

- Node.js >= 20
- Docker + Docker Compose（推荐）
- 或本地 PostgreSQL 16

### 方式一：Docker Compose（推荐）

```bash
cd chat-app

# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env，设置强随机的 JWT_SECRET 和 JWT_REFRESH_SECRET
# 至少 64 个字符
nano .env

# 3. 启动服务
docker compose up -d --build

# 4. 访问
open http://localhost
```

### 方式二：本地开发

#### 1. 启动数据库

```bash
# 使用 Docker
docker run -d \
  --name chat-db \
  -e POSTGRES_USER=chat \
  -e POSTGRES_PASSWORD=chat \
  -e POSTGRES_DB=chat \
  -p 5432:5432 \
  postgres:16-alpine
```

#### 2. 启动后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 设置数据库连接和 JWT 密钥
npm install
npm run dev
```

后端运行在 `http://localhost:3000`。

#### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`，并已配置代理到后端。

---

## 部署指南

### 服务端一键部署（推荐）

在服务器上执行：

```bash
cd /opt
git clone https://github.com/fox-114514/chat.git
cd chat
bash deploy/deploy.sh
```

脚本会自动完成：

1. 检查并安装 Docker + Docker Compose
2. 自动生成强随机 JWT 密钥和数据库密码
3. 创建 `.env` 配置文件
4. 配置防火墙（开放 22/80/443）
5. 构建并启动所有服务
6. 执行健康检查

部署完成后，访问服务器 IP 即可使用。

> 如果你已经通过其他方式把代码上传到服务器，也可以直接 `cd /opt/chat-app && bash deploy/deploy.sh`。

### 手动部署

```bash
# 复制项目到服务器
cp -r chat-app /opt/chat-app
cd /opt/chat-app

# 创建环境变量文件
cp .env.example .env
nano .env

# 启动
docker compose up -d --build
```

或使用 `deploy/init.sh` 脚本在新服务器上安装 Docker：

```bash
cd /opt/chat-app
bash deploy/init.sh
```

### 配置防火墙

生产环境建议只开放：

- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### TLS / HTTPS

本项目不包含 HTTPS 自动配置。建议：

1. 在 `frontend` 服务前再挂一层 Nginx / Caddy / Traefik 做 TLS 终结
2. 或使用 Cloudflare Tunnel
3. 或直接使用 Caddy 替换 frontend 的 Nginx

### 备份

数据库备份：

```bash
docker run --rm \
  -v chat-app_postgres_data:/data \
  -v /backup:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .
```

文件上传备份：

```bash
docker run --rm \
  -v chat-app_backend_storage:/data \
  -v /backup:/backup \
  alpine tar czf /backup/storage-$(date +%Y%m%d).tar.gz -C /data .
```

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `POSTGRES_USER` | 是 | chat | 数据库用户名 |
| `POSTGRES_PASSWORD` | 是 | - | 数据库密码，生产必须修改 |
| `POSTGRES_DB` | 是 | chat | 数据库名 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥，>= 64 字符随机字符串 |
| `JWT_REFRESH_SECRET` | 是 | - | refresh token 签名密钥 |
| `BCRYPT_ROUNDS` | 否 | 12 | 密码哈希轮数 |
| `CORS_ORIGIN` | 否 | * | 允许的前端域名，生产必须限制 |
| `FILE_UPLOAD_MAX_BYTES` | 否 | 20971520 | 最大上传文件大小（字节） |
| `HTTP_PORT` | 否 | 80 | 外部 HTTP 端口 |

> **警告**：`JWT_SECRET` 和 `JWT_REFRESH_SECRET` 必须使用强随机字符串。不要复用、不要提交到 Git。

---

## API 与事件

### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/auth/refresh` | 刷新 access token |
| GET | `/api/users?q=` | 搜索用户 |
| GET | `/api/rooms` | 我的房间列表 |
| POST | `/api/rooms` | 创建群聊 |
| GET | `/api/rooms/:id` | 房间详情 |
| POST | `/api/rooms/:id/members` | 添加成员 |
| DELETE | `/api/rooms/:id/members/:userId` | 移除成员 |
| GET | `/api/direct/:userId` | 获取/创建私聊 |
| GET | `/api/rooms/:id/messages` | 消息历史 |
| POST | `/api/rooms/:id/read` | 标记已读 |
| POST | `/api/files/upload` | 上传文件 |
| GET | `/api/files/:id` | 下载文件 |

### Socket.IO 事件

#### 客户端 → 服务端

| 事件 | payload |
|------|---------|
| `room:join` | `{ roomId }` |
| `room:leave` | `{ roomId }` |
| `message:send` | `{ roomId, content, type?, fileId? }` |
| `typing:start` | `{ roomId }` |
| `typing:stop` | `{ roomId }` |

#### 服务端 → 客户端

| 事件 | payload |
|------|---------|
| `message:new` | `Message` |
| `typing:update` | `{ userId, roomId, isTyping }` |
| `presence:update` | `{ userId, online }` |
| `error` | `{ message, code? }` |

---

## 开发计划

### v1 MVP（已完成）

- [x] 后端基础设施
- [x] 用户认证
- [x] 房间与用户管理
- [x] 消息历史与 Socket.IO 实时消息
- [x] 文件上传下载
- [x] 前端基础 + 认证页面
- [x] 前端聊天主界面
- [x] 在线状态 / 正在输入 / 未读计数
- [x] Docker 部署

### v2 E2EE（计划中）

- [ ] libsodium 集成
- [ ] 客户端密钥生成与 IndexedDB 存储
- [ ] 单聊 ECDH 加密
- [ ] 群聊 Sender Keys
- [ ] 文件加密传输
- [ ] 密钥备份机制

---

## 安全说明

### v1 已知限制

1. **服务端存储明文消息**  
   v1 中 `messages.content` 是明文。部署服务器被入侵时消息内容会泄露。

2. **文件临时明文存储**  
   上传的文件以原始格式保存在 `STORAGE_PATH/uploads/`。

3. **JWT 无黑名单**  
   修改密码或用户被禁用后，已签发的 token 仍然有效直到过期。

4. **全局在线状态广播**  
   任何登录用户都能看到其他所有用户的在线状态。

### 生产建议

- 使用强随机的 JWT 密钥
- 尽快升级到 v2 E2EE
- 配置 HTTPS
- 限制 CORS 为生产域名
- 定期备份数据库和文件
- 使用 SSH 密钥登录服务器，禁用密码登录
- 只开放 22/80/443 端口

---

## 常见问题

### Q: 注册时提示用户名已存在？

A: 用户名全局唯一，请换一个用户名。

### Q: 刷新页面后被踢到登录页？

A: 检查 `JWT_SECRET` 是否正确配置，以及 `/api/auth/me` 是否能正常访问。

### Q: 文件上传失败？

A: 检查 `FILE_UPLOAD_MAX_BYTES` 是否大于文件大小，以及 `STORAGE_PATH` 是否有写入权限。

### Q: WebSocket 连接失败？

A: 检查 Nginx 是否正确代理 `/socket.io/` 路径，并开启 `Upgrade` / `Connection` 头。

### Q: 如何升级到新版本？

```bash
cd /opt/chat-app
docker compose down
docker compose pull
docker compose up -d --build
```

---

## 许可证

私有项目，未经许可不得商用或二次分发。

---

## 贡献者

- 架构与后端：minimax
- 前端与部署：Kimi Code CLI
