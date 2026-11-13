# Pulse · 动态墙

一个只用原生 HTML / CSS / JavaScript 写成的迷你动态发布页：在输入框写下内容并发布，动态以时间倒序展示在时间线中，数据保存在浏览器本地（Local Storage），刷新或重新打开页面后依然存在。

没有框架、没有构建步骤、没有外部资源依赖，双击 `index.html` 就能用。

> 基于 Node.js + Vue 3 + Pinia + TypeScript 的 TDD 重写版见 [`pulse-vue/`](pulse-vue/README.md)。该版本增加了 Hono REST API 与内存存储后端，动态数据保存在服务端，不再使用 Local Storage（两版数据因此不再互通）。

## 功能

- **发布**：多行输入，280 字上限，实时字数统计，空内容或超长时发布按钮自动禁用
- **查看**：新内容插入时间线顶部，按发布时间倒序排列，显示相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期）
- **本地持久化**：数据写入 `localStorage`，刷新不丢失；数据损坏或存储不可用时自动回退为空列表，不影响页面使用
- **无动态空状态**：引导首次发布
- **响应式**：桌面端 640px 居中窄栏，移动端单列铺满

功能边界：仅发布与查看，不含账号、删除、点赞、评论等能力。

## 文件结构

```
.
├── index.html   # 页面结构
├── style.css    # 深色玻璃拟态设计系统与响应式样式
├── app.js       # 存储、渲染、交互逻辑
├── pulse-vue/   # Vue 3 + Pinia + TypeScript 前端 + Hono 内存存储后端（独立工程）
└── README.md
```

## 运行

方式一：直接双击 `index.html`。

方式二：起一个本地静态服务（推荐，避免个别浏览器对本地文件的安全限制）：

```bash
python -m http.server 8000
# 然后访问 http://127.0.0.1:8000
```

## 数据说明

- 存储键：`pulse.timeline.v1`
- 数据格式：`[{ "id": "…", "content": "…", "createdAt": 1731490000000 }]`
- 清空数据：浏览器开发者工具 → Application / Storage → Local Storage → 删除该项，或在控制台执行 `localStorage.removeItem('pulse.timeline.v1')`

## 实现要点

- 渲染用户内容全程使用 `textContent` 与 DOM API，不拼接 HTML，避免注入风险
- 读取数据时校验结构（数组、字段类型），异常数据被过滤
- 写入时捕获存储配额等异常，失败会给出提示
- 时间展示每 60 秒自动刷新一次
- 多标签页间通过 `storage` 事件同步数据
