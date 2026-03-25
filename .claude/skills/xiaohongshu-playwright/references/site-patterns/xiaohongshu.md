---
domain: xiaohongshu.com
aliases: [小红书, XHS, RED]
updated: 2026-03-24
---

## 平台特征

- SPA 架构，评论区动态加载
- xsec_token 反爬机制
- 搜索结果需登录才能完整显示
- PC Web 首页在未登录态会展示登录层
- 搜索结果页 URL: `https://www.xiaohongshu.com/search_result?keyword=<关键词>&source=web_search_result_note`
- 未登录时搜索页面可打开，但结果区为空
- 页面 SSR 注入 `window.__INITIAL_STATE__`，未登录时 `search.feeds` 为空

## 有效模式

- 2026-03-24: 搜索 URL 需带 `source=web_search_result_note` 参数才能正确加载笔记搜索
- 2026-03-24: 评论区选择器需尝试多种 `[class*="comment-item"]`, `[class*="CommentItem"]`, `.comment-inner`
- 2026-03-24: 用户主页链接模式 `https://www.xiaohongshu.com/user/profile/{userId}`
- 2026-03-24: 帖子详情中用户 ID 可从 `a[href*="/user/profile/"]` 提取
- 2026-03-24: 登录检测多重策略: cookie(`customer_id`/`access-token`) + DOM(`[class*="user-avatar"]`) + `__INITIAL_STATE__.user.userInfo.userId`
- 2026-03-24: 弹窗模式容器选择器: `[class*="note-detail-modal"]`, `[class*="NoteDetailModal"]`, `.note-detail-mask`
- 2026-03-24: 弹窗模式内滚动需定位到 `[class*="note-scroller"]` 等容器元素操作 `scrollTop`

## 已知陷阱

- 2026-03-24: 未登录态 API 调用只返回 `{"hasMore":false}`，不返回数据
- 2026-03-24: 裸 `fetch` 调用 API 会收到 `create invoker failed`，需使用站内请求封装
- 2026-03-24: 过快操作会触发验证码或 IP 限制，需加随机延迟
- 2026-03-24: 帖子弹窗模式和全页模式的 DOM 结构不同，选择器需兼容
- 2026-03-24: `page.pause()` 需要 `PWDEBUG=1` 环境变量才能弹出 Playwright Inspector，不可靠作为登录等待方案
- 2026-03-24: cookie 中的 `expires` 字段为 Unix 时间戳（秒），加载前需过滤过期条目
- 2026-03-24: 搜索结果中同一帖子可能出现多个不同格式的链接，提取时需按 URL 去重
- 2026-03-24: 无头模式下 cookie 失效无法弹出登录界面，需退回有头模式重新登录
- 2026-03-24: 搜索结果帖子 URL 格式为 `/search_result/{noteId}?xsec_token=...`，点击后会跳转到详情页
- 2026-03-24: 大部分帖子评论区提取到 0 条评论，可能是评论区延迟加载或选择器未命中，需增加等待时间和滚动次数
- 2026-03-24: 提取到的评论多为"回复 xxx : "格式，说明采集到的是回复而非顶层评论，选择器可能需调整以区分层级
- 2026-03-24: 不同用户名可能共享同一个 userId（采集 bug），可能是用户链接提取位置不对，取了上一级元素的链接
- 2026-03-25: cookie 对 /explore 页面有效但搜索页 /search_result 仍会弹出登录弹窗，需在 searchPosts 函数中单独检测并等待登录
- 2026-03-25: window.__INITIAL_STATE__.note.noteDetailMap[feedId] 包含完整评论数据（含 userInfo.userId、ipLocation、subComments），比 DOM 抓取更可靠
- 2026-03-25: 评论区稳定选择器：.comments-container（容器）、.parent-comment（主评论）、.show-more（展开回复）、.end-container（底部THE END）、.no-comments-text（无评论）
- 2026-03-25: 检测到 THE END 后从 __INITIAL_STATE__ 提取数据，帖子总评论数在 note.interactInfo.commentCount 字段
