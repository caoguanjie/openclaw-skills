---
domain: xiaohongshu.com
aliases: [小红书, XHS, RED]
updated: 2026-03-27
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
- 2026-03-25: 登录 QR 码选择器 `.qrcode-img`，img src 为 `data:image/png;base64,...` 格式，可通过 DOM 提取实现无头登录
- 2026-03-25: 无头 QR 登录流程：page.evaluate 提取 .qrcode-img 的 src → 解码 base64 → 保存 PNG → 系统程序打开 → 轮询登录状态
- 2026-03-25: ~~无头模式下 cookie 失效无法弹出登录界面，需退回有头模式重新登录~~（已通过 DOM QR 提取方案解决）
- 2026-03-25: 跨平台打开文件：Windows `cmd /c start`、macOS `open`、Linux `xdg-open`
- 2026-03-24: 搜索结果帖子 URL 格式为 `/search_result/{noteId}?xsec_token=...`，点击后会跳转到详情页
- 2026-03-24: 大部分帖子评论区提取到 0 条评论，可能是评论区延迟加载或选择器未命中，需增加等待时间和滚动次数
- 2026-03-24: 提取到的评论多为"回复 xxx : "格式，说明采集到的是回复而非顶层评论，选择器可能需调整以区分层级
- 2026-03-24: 不同用户名可能共享同一个 userId（采集 bug），可能是用户链接提取位置不对，取了上一级元素的链接
- 2026-03-25: cookie 对 /explore 页面有效但搜索页 /search_result 仍会弹出登录弹窗，需在 searchPosts 函数中单独检测并等待登录
- 2026-03-25: window.__INITIAL_STATE__.note.noteDetailMap[feedId] 包含完整评论数据（含 userInfo.userId、ipLocation、subComments），比 DOM 抓取更可靠
- 2026-03-25: 评论区稳定选择器：.comments-container（容器）、.parent-comment（主评论）、.show-more（展开回复）、.end-container（底部THE END）、.no-comments-text（无评论）
- 2026-03-25: 检测到 THE END 后从 __INITIAL_STATE__ 提取数据，帖子总评论数在 note.interactInfo.commentCount 字段
- 2026-03-26: 人类化滚动使用 window.scrollBy({ behavior: "smooth" }) 替代 page.mouse.wheel，更接近真实用户行为
- 2026-03-26: WheelEvent 派发 `new WheelEvent("wheel", { deltaY: 100, bubbles: true })` 可触发评论区懒加载
- 2026-03-26: rebrowser-patches 修复 CDP Runtime.enable leak 和 navigator.webdriver 检测
- 2026-03-26: viewport 随机偏移（±20px）+ UA 轮换可降低浏览器指纹固定风险
- 2026-03-26: 多段推进滚动（multi-push）比单次大幅滚动更自然，停滞时渐进升级（5次→largeMode, 20次→大冲刺）
- 2026-03-27: 人类化滚动不能只做单向下滑；详情评论区需保留“下滑后偶发小幅上滑回拉”的轨迹，window 与 `.note-scroller` 容器两种上下文都要支持
- 2026-03-27: 帖子间隔过短（<4s）会触发频率限制 300013（"安全限制 - 访问频繁"），页面显示倒计时后返回首页。7篇帖子中4篇被限，呈交替模式（成功→被限→成功→被限），因为被限帖的超时等待起到了冷却作用
- 2026-03-27: 帖子间基础间隔提升至 5-10s（POST_GAP），加入限流检测（checkRateLimit）和 15-30s 等待重试（最多3次），彻底解决 300013 问题
- 2026-03-27: 限流检测关键词: "安全限制"、"访问频繁"、"300013"、"请稍后再试"（在 page.goto 后立即检查 body 文本）
- 2026-03-27: 实测点击搜索结果卡片后，URL 会切到 `/explore/{noteId}`，但搜索卡片仍保留且详情以 modal 打开；模式判定必须优先看 modal DOM，不能只看 URL
- 2026-03-27: 实测详情评论滚动容器为 `.note-scroller`；弹窗模式下继续滚 `window` 不会稳定加载评论
- 2026-03-27: 直接点击 `.note-detail-mask` 不能稳定关闭详情弹窗；应优先点击明确 close 按钮，其次 `Escape`，mask 只做最后兜底
- 2026-03-27: 实测当前 cookie 进入 `search_result` 时仍可能被登录层拦截，卡片数会变成 0；搜索页登录复核必须保留在正式流程中

## 本地环境

> 此段落由 AI 在首次环境检查完成后自动填写，后续运行先读这里判断是否需要再次安装。
> 只有在环境确认就绪后，才继续读取「用户习惯」里的运行模式。

- 环境状态: 未设置
- Playwright依赖: 未设置
- Chromium浏览器: 未设置
- 最后检查时间: 未设置
- 备注: 首次使用先做环境检查与安装，完成后再处理运行模式选择

## 用户习惯

> 此段落由 AI 在首次运行时根据用户选择自动填写，后续运行自动读取。
> 用户可随时说「切换到打开浏览器模式」或「切换到后台模式」来修改。

- 运行模式: 打开浏览器运行
- 设置时间: 2026-03-27
