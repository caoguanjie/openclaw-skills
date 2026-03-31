# 小红书采集器：点击导航替代 goto 跳转

## Context

测试发现 7 篇帖子中 4 篇触发 300013 频率限制（"安全限制 - 访问频繁"），呈交替模式。小龙虾 claw 分析根因：**不是延迟不够，而是导航模式本身像机器人**。

另外，2026-03-27 的一次真实浏览器复核确认了两个必须写进方案的事实：

1. 搜索结果页在当前 cookie 下仍可能直接弹登录层，结果卡片数量变为 0，不能把它当成偶发异常
2. 用户确认点击帖子后常见交互是**搜索页内打开详情弹窗，关闭后不刷新搜索页**，因此这条路径应当是主路径，不是兼容分支

核心问题：
1. `page.goto(postUrl)` 直跳详情页，无点击轨迹
2. 帖子间无"回搜索页"行为，缺少自然浏览链
3. `search_result` 链接的 xsec_token 连续访问易失效
4. 同一 tab 高频切详情页 + 深滚评论，行为密度过高

之前的修改（加延迟 + 检测重试）只治标，本次改造要**从导航模式层面解决**。

## 改造目标

```
当前: searchPosts提取URL列表 → goto(帖子A) → goto(帖子B) → goto(帖子C)
目标: searchPosts提取URL+noteId → 留在搜索页 → 点击卡片A → 在弹窗内提取评论 → 关闭弹窗回搜索流 → 浏览搜索页 → 点击卡片B → ...
```

## 修改的文件

- `scripts/xhs-scraper.js` — 主要改动文件
- `scripts/human.js` — 新增延迟常量
- `references/site-patterns/xiaohongshu.md` — 记录新发现

## 实施步骤

### Step 1: human.js — 新增延迟常量

在 `DELAYS` 对象中添加：
```js
BROWSE_SEARCH: [1500, 3000],     // 浏览搜索结果
HOVER_CARD: [200, 500],          // 悬停卡片
MODAL_CLOSE_WAIT: [500, 1000],   // 关闭弹窗后等待
BACK_NAVIGATION: [1000, 2000],   // 浏览器后退后等待
```

保留已有的 `POST_GAP`, `RATE_LIMIT_WAIT`。

### Step 2: searchPosts() — 返回 noteId + searchUrl，并把搜索页登录检测固化

**改动点**（lines 353-461）：

1. 在 `page.evaluate()` 内，从每个 href 提取 noteId（用已有的 `\/([a-f0-9]{24})\b` 正则）
2. 返回对象加 `noteId` 字段：`{ url, title, author, noteId }`
3. 函数返回值从 `selected` 改为 `{ posts: selected, searchUrl }`
4. 搜索页登录弹窗检测抽成可复用逻辑，不只在首次 search 时用；后续重回 `searchUrl` 时也要复核
5. 更新 main() 中的调用方处理新返回结构

### Step 3: 新增 navigateToPost() 函数

**位置**: 插入在 `dismissOverlays()` 之后

```
async function navigateToPost(page, post, searchUrl)
返回: { mode: 'modal' | 'fullpage' | 'fallback' }
```

流程：
1. 检查当前是否仍在搜索页（`page.url()` 含 `search_result`），不在则回 `searchUrl`
2. 回到 `searchUrl` 后先复核登录态；若出现登录层，等待用户完成登录，再继续等结果卡片
3. 等待搜索结果加载：`waitForSelector('section.note-item', { timeout: 8000 })`
4. 用 `a[href*="${post.noteId}"]` 定位目标卡片
5. 找不到 → 小幅滚动触发懒加载 → 再试一次
6. 仍找不到 → **fallback**: `page.goto(post.url)`，返回 `{ mode: 'fallback' }`
7. 找到 → `scrollIntoViewIfNeeded()` → hover（等 HOVER_CARD）→ click
8. 等待结果时优先检测弹窗：
   - 出现 `[class*="note-detail-modal"], .note-detail-mask` → `{ mode: 'modal' }`
   - 只有在 **modal 不存在** 且页面明确变成详情结构时，才判定 `{ mode: 'fullpage' }`
9. 任何异常 → fallback 到 goto

注意：
- `modal` 是主路径，`fullpage` 和 `fallback` 只是降级
- 不再把“点击后跳详情页”当成默认交互假设
- 实测中点击卡片后 URL 会变成 `/explore/...`，但页面仍保留搜索卡片且 modal 可见，所以**不能用 URL 变化来区分 modal/fullpage**

### Step 4: 新增 returnToSearch() 函数

```
async function returnToSearch(page, mode, searchUrl)
```

- `modal` 模式: 优先点击明确 close 按钮，其次 `Escape`，最后才尝试 mask；关闭后等 MODAL_CLOSE_WAIT，并确认 modal 消失、搜索卡片仍在，而不是仅看 URL
- `fullpage` / `fallback` 模式: `page.goBack()`，验证 URL 含 `search_result`；失败则 `goto(searchUrl)`，等 BACK_NAVIGATION

### Step 5: 新增 browseSearchResults() 函数

```
async function browseSearchResults(page)
```

模拟帖子间的自然浏览行为：
- 随机小幅滚动 1-3 次（100-400px，smooth）
- 30% 概率悬停一个可见卡片
- 总时间约 2-5 秒

### Step 6: 重构详情页上下文识别 + extractComments()

**关键改动**: 不只是移除 `page.goto()`。还要把“滚动发生在 window”改成“按详情容器决定滚动目标”。

拆成两部分：

1. `resolveDetailContext(page, mode)`
   - `modal` 模式: 识别 detail root 和滚动容器（优先 `[class*="note-scroller"]`）
   - `fullpage` / `fallback` 模式: 滚动容器回退到 `window`
   - 输出统一结构：`{ mode, rootSelector, scrollMode, scrollSelector }`

2. `extractComments(page, post, maxComments, speed, detailContext)`
   - 移除 lines 815-837 的重试循环和 goto
   - 用 `post.noteId` 代替从 URL 解析 feedId
   - `loadAllComments()` / `humanScroll()` / `scrollToCommentsArea()` / `scrollToLastComment()` 改为接收 `detailContext`
   - `modal` 模式下对滚动容器执行 `scrollBy/scrollTop`，不再默认 `window.scrollBy`
   - `clickShowMoreButtons()`、`getCommentCount()`、`checkEndContainer()` 尽量限定在 detail root 内执行，避免误扫背景页面
   - 保留 `checkRateLimit()` 函数（由 main loop 调用）

### Step 7: 重构 main loop

新循环结构：
```
for each post:
  navigateToPost(page, post, searchUrl)        // 点击卡片进入，主路径是 modal
  → checkRateLimit → 被限则 returnToSearch + 等待 + 重试(最多3次)
  → dismissOverlays
  → resolveDetailContext(page, mode)
  → extractComments(page, post, ...)            // 提取评论（不含导航）
  → returnToSearch(page, mode, searchUrl)       // modal 关弹窗；降级路径才 goBack/goto
  → browseSearchResults(page)                   // 浏览搜索结果
  → sleepRandom(POST_GAP) + navigationDelay     // 帖子间冷却
```

### Step 8: 更新 site-patterns

记录卡片定位选择器、弹窗检测、弹窗滚动容器、搜索页登录弹窗复核等新发现。

## 已有改动保留

上一轮对话中的这些改动保留不变：
- `detectInterest()` 通用化（移除医美硬编码）
- `isRelevantPost()` 通用化（纯关键词匹配）
- `buildAnalysis()` 评分改为 `Math.max()`
- `human.js` 中的 `RATE_LIMIT_KEYWORDS`, `POST_GAP`, `RATE_LIMIT_WAIT`
- `checkRateLimit()` 函数

需要替换的：
- `extractComments()` 内的 goto + 重试循环 → 移除，导航交给 main loop
- main loop 的帖子间等待 → 替换为 returnToSearch + browseSearchResults + POST_GAP
- 评论滚动目标默认 `window` → 替换为基于 `detailContext` 的窗口/弹窗容器双模式

## 已知限制

- 当前真实浏览器复核只确认了“搜索页会被登录层拦截”，没有在本轮亲自完成登录后的点卡复核；“主路径为弹窗”仍依赖用户反馈和已有站点经验文件
- 即使改成容器滚动，`__INITIAL_STATE__` 是否完整回写所有追加评论仍是独立风险，后续仍需补 DOM/API fallback

## 验证方式

1. `node -c scripts/xhs-scraper.js && node -c scripts/human.js` — 语法检查
2. `--headed` 模式运行，目视观察：
   - 搜索结果页是否正常加载
   - 搜索页登录弹窗是否能被正确识别和等待
   - 卡片是否被正确点击（而非 goto 跳转）
   - 弹窗模式是否被检测到并正确关闭
   - 弹窗内评论是否跟随 detail 容器滚动，而不是滚动整个 window
   - 帖子间是否有回搜索页 + 浏览行为
   - 7 篇帖子是否全部成功（不再交替被限）
3. 对比改动前后的 300013 触发率
