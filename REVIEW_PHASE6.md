# Phase 6 代码审查意见

> 审查对象：`frontend/` 前端基础项目  
> 审查结果：**通过，但必须修复 1 个功能缺失问题，另有 2 个建议项**

---

## 一、总体评价

Phase 6 前端基础项目搭建得很规范：

- Vite + React + TypeScript + Tailwind 配置正确
- 路由结构清晰：`/login`、`/register`、`/chat`、`/chat/:roomId`
- axios 客户端封装完整：token 注入、401 跳转、错误处理
- socket.io-client 封装完整：token 认证、ack 超时、断开连接
- AuthContext 结构正确
- Vite proxy 正确代理 `/api` 和 `/socket.io`
- `npm run typecheck` 通过
- `npm run build` 通过

整体来看，minimax 做前端基础是完全合格的。

---

## 二、必须修复的问题

### 🔴 问题 1：AuthContext 没有页面刷新后的登录态恢复

**文件**：`frontend/src/auth/AuthContext.tsx`

**当前代码**：
```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading] = useState(false);
  // ...
}
```

**问题**：
- `user` 初始为 `null`
- 页面刷新后，即使 `localStorage` 里有 `accessToken`，用户也被视为未登录
- `isLoading` 永远是 `false`，没有实际使用

**影响**：用户刷新页面后会被 axios 拦截器判定为 401，强制跳回登录页，体验极差。

**修改建议**：在 `AuthProvider` mount 时，如果有 `accessToken`，调用 `GET /api/auth/me` 恢复用户状态。

```tsx
import { useEffect } from 'react';
import { api, getAccessToken } from '../api/client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => {
        if (!cancelled) {
          setUser(res.data.user);
          setAccessToken(token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTokens();
          setAccessToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // setAuth / clearAuth 保持不变
}
```

> 注意：这里直接使用 `api.get('/auth/me')`，因为 `api` 的请求拦截器会自动从 localStorage 拿 token。

---

## 三、建议优化（不改也能进入 Phase 7，但最好修）

### 🟡 问题 2：没有路由保护（Protected Route）

**文件**：`frontend/src/App.tsx`

**当前情况**：所有路由都直接渲染，未登录用户也能访问 `/chat`。

**问题**：虽然 `/chat` 页面会从后端拿不到数据，但应该在前端层面直接重定向到 `/login`。

**修改建议**：添加一个简单的 `ProtectedRoute` 组件：

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // 或显示 loading spinner
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

然后在 `App.tsx` 中使用：

```tsx
<Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
<Route path="/chat/:roomId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
```

> 修复问题 1 后，`isLoading` 才有意义，这个问题才有意义。

---

### 🟡 问题 3：`emitWithAck` 的事件类型不够精确

**文件**：`frontend/src/socket/socket.ts`

**当前代码**：
```ts
export function emitWithAck<TResponse = unknown, TPayload = unknown>(
  event: string,
  payload: TPayload,
  timeoutMs = 5_000,
): Promise<TResponse>
```

**问题**：`event: string` 无法利用 `ClientToServerEvents` 的类型约束。

**修改建议（可选）**：
```ts
import type { ClientToServerEvents } from '../types/socket';

type EventName = keyof ClientToServerEvents;

export function emitWithAck<
  E extends EventName,
  TResponse = ReturnType<ClientToServerEvents[E]> extends (...args: any[]) => void
    ? Parameters<ReturnType<ClientToServerEvents[E]>>[0]
    : unknown,
  TPayload = Parameters<ClientToServerEvents[E]>[0],
>(event: E, payload: TPayload, timeoutMs = 5_000): Promise<TResponse>
```

这个类型比较复杂，v1 可以不做，但建议后续完善类型系统时加上。

---

## 四、Phase 6 范围说明

当前 `LoginPage`、`RegisterPage`、`ChatPage` 都是 placeholder，写着 "Phase 7/8 will implement"。这符合 DETAIL_PLAN.md 中的阶段划分：

- Phase 6：前端基础骨架
- Phase 7：前端认证页面（登录/注册表单）
- Phase 8：前端聊天主界面

因此 **placeholder 本身不是问题**，但 AuthContext 必须能在刷新后恢复登录态，否则 Phase 7/8 都无法正常测试。

---

## 五、验证结果

```bash
cd frontend
npm install
npm run typecheck   # ✅ 通过
npm run build       # ✅ 通过
```

> `npm audit` 报告了一些依赖漏洞，这些来自第三方包，不影响功能，后续可以用 `npm audit fix` 处理。

---

## 六、Phase 6 验收 Checklist

- [ ] `npm run dev` 能启动前端开发服务器
- [ ] Vite proxy 把 `/api` 转发到 `http://localhost:3000`
- [ ] Vite proxy 把 `/socket.io` 转发到 `http://localhost:3000` 并支持 WebSocket
- [ ] axios 请求自动带 `Authorization: Bearer <token>`
- [ ] axios 收到 401 时清空 token 并跳转 `/login`
- [ ] 页面刷新后，如果有有效 token，自动恢复登录态（修复问题 1 后）
- [ ] socket.io 连接时从 `handshake.auth.token` 传 token
- [ ] 未登录时尝试连接 socket 会报错/拒绝
- [ ] `npm run build` 成功产出 `frontend/dist/`

---

## 七、下一步：Phase 7 前端认证页面

Phase 7 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `frontend/src/auth/LoginPage.tsx` | 完整登录表单 |
| `frontend/src/auth/RegisterPage.tsx` | 完整注册表单 |
| `frontend/src/api/auth.ts` | 调用后端 `/api/auth/register`、`/api/auth/login`、`/api/auth/refresh` |
| `frontend/src/App.tsx` | 增加 ProtectedRoute |

详细定义见 `DETAIL_PLAN.md` 第五章。
