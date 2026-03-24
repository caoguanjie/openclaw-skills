---
domain: xiaohongshu.com
aliases: [小红书, RED, Xiaohongshu]
updated: 2026-03-24
---
## 平台特征
- 2026-03-24 验证：PC Web 首页 `https://www.xiaohongshu.com/explore` 在未登录态会展示登录层，但推荐流文本可能仍出现在 DOM 中。
- 2026-03-24 验证：搜索结果页 URL 形如 `https://www.xiaohongshu.com/search_result?keyword=<关键词>&type=51`，未登录时页面可打开，但结果区为空，页面文本仅显示“登录后查看搜索结果”。
- 2026-03-24 验证：页面 SSR 会注入 `window.__INITIAL_STATE__`，其中可看到搜索上下文（如 `keyword`、`page`、`pageSize`），但未登录时 `search.feeds` 为空。

## 有效模式
- 2026-03-24 验证：可通过 webpack runtime 注入方式获取站内模块，模块 `40122` 暴露搜索接口封装，其中 `$5` 对应 `/api/sns/web/v1/search/notes`。
- 2026-03-24 验证：在页面上下文中直接调用模块 `40122.$5(...)` 能命中站内 HTTP 封装，优于裸 `fetch`。

## 已知陷阱
- 2026-03-24 验证：未登录态下，`/api/sns/web/v1/search/notes` 经站内封装调用只返回 `{"hasMore":false}`，不给笔记列表。
- 2026-03-24 验证：在页面上下文中对 `/api/sns/web/v1/search/notes` 使用裸 `fetch`，会收到 `create invoker failed, service: jarvis-gateway-default`，说明缺少站内请求封装附带的签名或中间件。
