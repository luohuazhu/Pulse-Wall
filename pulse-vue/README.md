# Pulse · 动态墙（Vue 3 + Hono 版）

原生版 `Pulse 动态墙` 的框架化重写：Node.js + Vite + Vue 3（`<script setup>` + TypeScript）+ Pinia 负责界面，Hono 提供 RESTful API，动态数据保存在**服务端进程内存**中，浏览器不再使用 Local Storage 存业务数据。

以 TDD 方式开发：先写失败的测试，再实现最小可用代码，最后重构。

## 功能

- **发布**：多行输入，实时字数统计（已用 / 280），空内容或超过 280 字时发布按钮置灰；提交空内容或超长会给出对应提示并聚焦回输入框
- **时间线**：新动态插入顶部，按创建时间倒序，展示头像、作者名「本地用户」与相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / YYYY-MM-DD），相对时间文案每 60 秒自动刷新（不轮询数据，其它标签页/客户端的新动态需手动刷新）
- **服务端持久化**：数据经 `POST /api/posts` 写入 Hono 内存仓库，刷新页面后从 `GET /api/posts` 重新载入
- **点赞**：心形按钮乐观切换，显示总赞数；重复点击去重，失败自动回滚并在卡片内提示
- **收藏**：书签按钮切换收藏状态；时间线顶部提供「只看收藏」筛选，无收藏时展示专门空状态
- **降级策略**：服务端不可用时仍可发布，动态只在本地临时展示并提示「保存到服务器失败」；加载失败在时间线顶部显示提示，不影响页面继续使用
- **空状态**：无动态时展示引导插画与文案，顶部胶囊实时显示「N 条动态」
- **视觉**：完整沿用原生版深色玻璃拟态设计（`src/styles/pulse.css`），桌面 640px 居中、移动端单列

功能边界：发布、查看、点赞、收藏，不含账号、删除、评论。**服务进程重启后数据（含点赞/收藏）清空**（内存存储的预期行为）。

## 快速开始

需要 Node.js 22.18+（本机使用 Node 26；后端直接用 Node 运行 TypeScript，无需构建）。

```bash
cd pulse-vue
npm install

# 终端 1：启动 Hono API（默认 http://127.0.0.1:8787）
npm run dev:api

# 终端 2：启动前端（默认 http://localhost:5173，/api 由 Vite 代理到后端）
npm run dev
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（`/api` 代理到 8787） |
| `npm run dev:api` | 以 `--watch` 启动 Hono API |
| `npm run start:api` | 启动 Hono API（不监听文件变化） |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物（已配置 `/api` 代理，需先启动 API） |
| `npm test` | 运行全部测试（Vitest，单次） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run typecheck` | `vue-tsc --noEmit` 类型检查 |

## REST API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/posts` | 返回 `{ "posts": Post[] }`，按 `createdAt` 倒序 |
| `POST` | `/api/posts` | 请求体 `{ "content": string }`，成功返回 `201 { "post": Post }` |
| `PUT` | `/api/posts/:id/like` | 点赞（幂等），返回 `200 { "post": Post }` |
| `DELETE` | `/api/posts/:id/like` | 取消点赞（幂等，计数不会小于 0） |
| `PUT` | `/api/posts/:id/favorite` | 收藏（幂等） |
| `DELETE` | `/api/posts/:id/favorite` | 取消收藏（幂等） |
| `GET` | `/api/health` | 健康检查，返回 `{ "ok": true }` |

`Post` 结构：`{ id, content, createdAt, likes, liked, favorited }`。互动端点对不存在的 `id` 返回 `404 NOT_FOUND`（message 为「动态不存在」），且不会创建条目。

错误统一为 `{ "error": { "code": string, "message": string } }`，`code` 取值：
`EMPTY`、`TOO_LONG`、`INVALID_CONTENT`、`INVALID_JSON`（400）、
`UNSUPPORTED_MEDIA_TYPE`（415，非 `application/json`）、`PAYLOAD_TOO_LARGE`（413，>8KB）、
`NOT_FOUND`（404）、`INTERNAL_ERROR`（500）。

请求与响应约束：`POST` 必须带 `content-type: application/json`；请求体上限 8KB；服务只监听 `127.0.0.1`，生产环境请放在反向代理之后。

```bash
curl http://127.0.0.1:8787/api/posts
curl -X POST http://127.0.0.1:8787/api/posts \
  -H 'content-type: application/json' \
  -d '{"content":"你好，Pulse"}'
curl -X PUT http://127.0.0.1:8787/api/posts/<id>/like
curl -X PUT http://127.0.0.1:8787/api/posts/<id>/favorite
```

## 目录结构

```
pulse-vue/
├── index.html               # Vite 入口（含内联 favicon）
├── server/
│   ├── store.ts             # 内存仓库（工厂 + 可注入时钟/id）
│   ├── app.ts               # Hono 应用：路由、校验、错误形状
│   └── index.ts             # @hono/node-server 启动入口
├── src/
│   ├── main.ts              # 挂载应用、注册 Pinia、引入全局样式
│   ├── App.vue              # 页面骨架，挂载时载入时间线
│   ├── constants.ts         # 长度上限、作者、全部文案
│   ├── types.ts             # Post / 校验 / 发布结果类型
│   ├── styles/pulse.css     # 全局设计系统（原 style.css）
│   ├── api/posts.ts         # REST 客户端与 PostsApiError
│   ├── utils/
│   │   ├── id.ts            # createId（本地临时条目）
│   │   ├── time.ts          # pad / formatTime
│   │   └── validation.ts    # isValidPost / validateContent（前后端共用）
│   ├── composables/useNow.ts        # 60 秒刷新的当前时间（可注入时钟）
│   ├── stores/posts.ts              # Pinia store：加载、发布、降级
│   └── components/
│       ├── SiteHeader.vue   # 品牌与动态条数
│       ├── PostComposer.vue # 发布表单、计数、禁用态、提示
│       ├── Timeline.vue     # 时间线容器与加载失败提示
│       ├── PostCard.vue     # 单条动态
│       └── EmptyState.vue   # 空状态插画
└── tests/
    ├── setup.ts
    ├── server/*.spec.ts     # Hono 路由与内存仓库（node 环境）
    ├── api/*.spec.ts        # REST 客户端
    ├── utils/*.spec.ts      # 纯函数
    ├── stores/posts.spec.ts # store 行为（含服务端失败降级）
    ├── composables/*.spec.ts
    └── components/*.spec.ts # 组件与集成
```

## 测试覆盖（152 个用例 / 12 个文件）

- `server/store`：空仓、倒序、同毫秒唯一 id、注入时钟、返回副本、实例隔离；点赞/收藏幂等、计数下限、未知 id、只影响目标
- `server/app`：列表/创建、trim、280/281 边界、空串/全空白、非法 JSON、`content` 非字符串、404、413 体积上限、415 内容类型、500 统一错误、健康检查、实例隔离；`PUT/DELETE like|favorite` 幂等与动态 404
- `api/posts`：请求路径与方法、超时信号、响应排序与脏数据过滤、4xx 错误码透传、非 JSON 响应、`posts` 非数组、网络异常与超时文案、`post` 结构非法；互动端点路径编码、PUT/DELETE 选择与默认值补齐
- `stores/posts`：初始态、load 成功/失败/保留旧数据、并发 load 与发布不丢数据、校验短路不发请求、成功以服务端结果为准、失败乐观插入、`persistError` 复位；点赞/收藏乐观更新、失败回滚、在途去重、旧列表不覆盖互动状态
- `components/PostComposer`：计数、禁用态、超限红态、三类提示文案、发布后清空与聚焦、服务端失败提示、重复提交只发一次请求
- `components/PostCard` / `Timeline`：作者、相对时间、ISO `datetime`、正文转义、空状态、顺序、`aria-busy` 与加载失败提示；点赞/收藏按钮状态与无障碍属性、只看收藏筛选、收藏空态、互动错误定位
- `components/App`：挂载载入、发布集成流程、加载失败提示、挂载只请求一次、点赞成功/失败回滚

```bash
npm test
```

## 数据说明

- 存储位置：Hono 进程内存（`server/store.ts` 中的数组），**重启 API 即清空**
- 数据格式：`{ "id": "…", "content": "…", "createdAt": 1731490000000, "likes": 0, "liked": false, "favorited": false }`
- 浏览器 Local Storage 不再保存动态；清空数据请重启 API 进程
- 生产部署时 `dist/` 与 `/api` 必须同源（Nginx/Caddy 反向代理到 Hono），否则前端会拿到 `index.html` 并报「无法连接服务器」

## 与原生版的对照

| 关注点 | 原生版 `app.js` | 本版 |
| --- | --- | --- |
| 数据 | 一个 `posts` 数组 | Pinia store 单一数据源 |
| 存储 | `localStorage` 读写 | Hono 内存仓库 + REST API |
| 校验 | 分散在 submit 与 load 中 | `utils/validation.ts` 纯函数，前后端共用 |
| 渲染 | 手写 DOM 拼接 | 组件 + 插值渲染（等效 `textContent`，无注入风险） |
| 相对时间 | 60 秒遍历改写每个时间节点 | `useNow()` 每 60 秒更新一次，卡片由 `now` 派生 |
| 跨标签页 | `storage` 事件同步 | 不再需要，服务端是唯一数据源 |
| 互动 | 无 | 点赞（计数）/ 收藏（筛选），PUT/DELETE 幂等 + 乐观更新回滚 |
| 上限 | `maxlength=400` 但校验 280 | 一致：保留 400 的输入上限以维持「超限提示」交互路径 |
