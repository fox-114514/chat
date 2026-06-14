# Phase 5 代码审查意见

> 审查对象：`backend/src/storage/files.ts`、`backend/src/routes/files.ts`、`backend/src/index.ts`  
> 审查结果：**通过，建议修复 1 个权限问题后再进入 Phase 6**

---

## 一、总体评价

Phase 5 文件上传模块实现规范、完整：

- 使用 multer + memoryStorage，配置正确
- 文件大小超限返回 `413 PayloadTooLarge`
- 存储路径使用 UUID + 安全扩展名，防止目录遍历
- 数据库存 `storageFilename` 而非绝对路径，安全
- 下载接口设置正确的 `Content-Type` 和 `Content-Disposition`
- `index.ts` 正确挂载 `/api/files`
- `npm run typecheck` 通过
- `npm run build` 通过

---

## 二、必须修复的问题

### 🔴 问题 1：文件下载权限过宽

**文件**：`backend/src/routes/files.ts`

**当前代码**：
```ts
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // 任何登录用户都能下载
  }),
);
```

**问题**：只要登录，任何用户都能下载任何文件，包括不属于自己所在房间的文件。这不符合私有聊天系统的预期。

**修改建议**：

方案 A（推荐，v1 够用）：下载者必须是文件上传者本人。

```ts
const result = await pool.query<{
  storage_path: string;
  mime_type: string | null;
  original_name: string | null;
  uploader_id: string;
}>(
  `SELECT storage_path, mime_type, original_name, uploader_id
   FROM files WHERE id = $1`,
  [fileId],
);
const file = result.rows[0];
if (!file) throw NotFound('file not found', 'FILE_NOT_FOUND');

if (file.uploader_id !== req.user!.userId) {
  throw Forbidden('you do not have permission to access this file', 'FILE_ACCESS_DENIED');
}
```

方案 B（更严格，推荐 v2 考虑）：下载者必须是文件所在房间的成员。需要 `files` 表增加 `room_id` 字段（迁移中已有），并校验：

```ts
import { isMember } from '../db/rooms';

if (!file.room_id) {
  throw Forbidden('file is not associated with any room', 'FILE_ACCESS_DENIED');
}
const member = await isMember(file.room_id, req.user!.userId);
if (!member) {
  throw Forbidden('you do not have permission to access this file', 'FILE_ACCESS_DENIED');
}
```

> v1 建议先用方案 A（上传者本人可下载），因为当前 `message:send` 里已经校验 file 属于发送者，下载者也只可能是发送者本人或接收者。但接收者下载时方案 A 会失败。
>
> 因此 **v1 实际建议用方案 B**：按房间成员权限判断，这样发送者和接收者都能下载。`files.room_id` 字段已经在迁移文件里存在。

---

## 三、可选优化（不改也能通过）

### 1. multer 使用 memoryStorage 的内存占用

当前 multer 配置：
```ts
storage: multer.memoryStorage(),
limits: { fileSize: env.FILE_UPLOAD_MAX_BYTES },
```

上传的文件会先读到内存，然后 `saveFile` 再写入磁盘。对于 20MB 限制和少量用户的私有系统，v1 完全够用。如果未来上传视频等大文件，建议改为 `diskStorage` 或流式直传。

### 2. 缺少文件类型白名单

当前没有限制可上传的文件类型。v1 私有场景可接受，但建议后续加：

```ts
function allowedMime(mime: string): boolean {
  const allowed = ['image/', 'application/pdf', 'text/', 'video/'];
  return allowed.some((prefix) => mime.startsWith(prefix));
}
```

### 3. `storage/files.ts` 中的 `getUploadsDir` 未使用

当前 `getUploadsDir()` 没有调用，可以保留备用，也可以删除保持简洁。

### 4. 上传接口响应字段与 `FileMeta` 类型一致

当前返回：
```ts
{
  file: {
    id,
    originalName,
    sizeBytes,
    mimeType,
    url: `/api/files/${fileId}`,
  }
}
```

这与 `types/models.ts` 中的 `FileMeta` 完全一致，很好。

---

## 四、验证结果

```bash
cd backend
npm run typecheck   # ✅ 通过
npm run build       # ✅ 通过
```

---

## 五、Phase 5 验收 Checklist

- [ ] `POST /api/files/upload` 可上传文件
- [ ] 超过 `FILE_UPLOAD_MAX_BYTES` 返回 `413 FILE_TOO_LARGE`
- [ ] 上传后数据库 `files` 表有记录
- [ ] 文件实际保存到 `STORAGE_PATH/uploads/`
- [ ] `GET /api/files/:id` 可下载文件
- [ ] 非授权用户无法下载他人文件（修复问题 1 后）
- [ ] 下载响应包含正确的 `Content-Type`
- [ ] 下载响应包含正确的 `Content-Disposition`（含中文文件名）
- [ ] `tsc --noEmit` 干净
- [ ] `tsc` build 干净

---

## 六、下一步：Phase 6 前端基础

Phase 6 需要实现的文件：

| 文件 | 职责 |
|------|------|
| `frontend/package.json` | 前端依赖 |
| `frontend/vite.config.ts` | Vite 配置 |
| `frontend/tailwind.config.js` | Tailwind 配置 |
| `frontend/tsconfig.json` | TypeScript 配置 |
| `frontend/index.html` | HTML 入口 |
| `frontend/src/main.tsx` | React 入口 |
| `frontend/src/App.tsx` | 路由 |
| `frontend/src/api/client.ts` | axios 封装 |
| `frontend/src/socket/socket.ts` | socket.io-client 封装 |
| `frontend/src/types/*.ts` | 前端类型 |

详细定义见 `DETAIL_PLAN.md` 第五章。
