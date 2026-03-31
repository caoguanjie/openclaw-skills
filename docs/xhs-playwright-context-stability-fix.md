# 小红书 Playwright 脚本上下文稳定性修复方案

## 问题诊断

### 核心问题

小红书前端采用 SPA 架构，在搜索页、详情页、评论区加载和风控插层之间会频繁重建 DOM，而不是原地更新。这会导致：

1. 页面上下文不稳定
   - 搜索页点击卡片后，可能进入 modal，也可能切到独立详情页
   - 评论区滚动过程中，详情 DOM 可能被整体卸载再重建
   - 登录层、风险提示层、分享层会打断当前页面结构

2. 旧引用和旧上下文失效
   - 旧的 `page.evaluate` 执行上下文失效
   - 旧的滚动容器、评论节点、元素句柄会失效
   - 继续复用旧上下文时，容易触发 `Execution context was destroyed`

3. 当前主流程恢复方式过于混杂
   - 搜索页点击失败会降级到 `goto`
   - 采集结束后还会尝试 `close modal`、`goBack`、重新 `goto search`
   - 同一条帖子处理链路中混用了多种导航方式，放大了状态漂移问题

### 根本原因

脚本当前默认“自己还停留在原页面、原弹层、原滚动容器中”，但小红书实际已经切换了页面状态。代码没有把“详情会话已经丢失”建模成一个明确事件，只是继续拿旧上下文重试，因此异常会不断放大。

---

## 目标原则

### 1. 搜索页只负责伪装浏览和收集帖子 URL

- 搜索页不再承担详情采集职责
- 搜索页保留登录校验、浏览停留、候选帖子提取
- 搜索页不再点击卡片进入详情

### 2. 使用固定 worker page 复用处理详情

- 创建一次固定的 detail worker page，后续每篇帖子都在这个 page 里 `goto(post.url)` 复用处理
- 不每帖新开新关 tab（避免「反复开关标签」的自动化指纹）
- 每 N 帖或会话丢失时，才重建这个 worker page
- 不再 `goBack`
- 不再从详情页返回搜索页复位

### 3. 详情采集基于”会话存活”而不是一次性判断

- `detailContext`（scrollSelector、scrollMode）不再一次性解析后缓存到底
- 每 10-20 次滚动循环重新探测一次 detailContext，平衡性能和稳定性
- 一旦会话丢失（`DetailSessionLostError`），立即重建 worker page，不继续复用旧上下文

### 4. 直接跳转必须搭配人类化节奏和 300013 恢复机制

- `goto` 前后必须有人类化延迟
- 搜索页阶段必须保留停留和滚动行为
- 命中 300013 后立即冷却和重试，不能继续盲目滚动

---

## 核心修改策略

### 1. 固定 worker page + goto 复用（替代每帖新开 tab）

**问题**：

- 搜索页点击卡片的打开方式不稳定
- 同一个 `page` 在搜索页和详情页之间往返切换，容易造成状态污染
- `goBack` 和重新 `goto search` 会让原上下文进一步漂移
- **审查补充**：每帖新建 tab 再关闭会产生强自动化指纹（真实用户不会反复开关标签）

**解决方案**：

- 主搜索页只保留在搜索结果列表
- 创建一个固定的 detail worker page，所有帖子在此 page 上用 `goto(post.url)` 处理
- 不每帖新开/关闭 tab
- 每 N 帖主动重建 + 异常时立即重建（混合策略，见策略 8）

```javascript
// 初始化：创建固定 worker page
let workerPage = await context.newPage();
let workerPostCount = 0;
const WORKER_REBUILD_INTERVAL = 5; // 每 5 帖主动重建一次

async function getWorkerPage(context) {
  if (!workerPage || workerPage.isClosed()) {
    workerPage = await context.newPage();
    workerPostCount = 0;
  }
  return workerPage;
}

async function processPost(searchPage, post, context) {
  const detailPage = await getWorkerPage(context);

  await applyPreGotoHumanDelay(searchPage, post);

  await detailPage.goto(post.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await applyPostGotoHumanDelay(detailPage);

  await assertNotRateLimited(detailPage);
  await assertDetailSessionReady(detailPage, post.noteId);

  const result = await extractCommentsFromDetailPage(detailPage, post);
  workerPostCount++;

  // 每 N 帖主动重建 worker page，防止内存和状态积累
  if (workerPostCount >= WORKER_REBUILD_INTERVAL) {
    await workerPage.close().catch(() => null);
    workerPage = null;
  }

  return result;
}
```

**关键点**：

- 只使用 `post.url`，不自行拼接 `/explore/{noteId}`
- 复用固定 worker page，不每帖新开 tab
- `goto` 会完全重写 `__INITIAL_STATE__`，不存在上一帖数据污染
- 不再 `goBack`
- 不再在同一条处理链中混用 click 和 goto

---

### 2. `goto` 前后增加人类化延迟

**问题**：

- 直接连续 `goto` 多篇帖子，容易触发 300013
- 跳转节奏过于机械，和真实用户行为不符

**解决方案**：

- 在 `goto` 前，先在搜索页执行短暂停留和轻微滚动
- 在 `goto` 后，增加阅读停留和页面缓冲时间
- 保留帖子间基础间隔，并在连续运行中动态抬高延迟

```javascript
async function applyPreGotoHumanDelay(searchPage, post) {
  await searchPage.waitForTimeout(randomDelay(1500, 3500));

  const moves = randomInt(1, 3);
  for (let i = 0; i < moves; i++) {
    const delta = randomInt(80, 260) * (Math.random() > 0.3 ? 1 : -1);
    await searchPage.evaluate((value) => {
      window.scrollBy({ top: value, behavior: "smooth" });
    }, delta);
    await searchPage.waitForTimeout(randomDelay(400, 900));
  }
}

async function applyPostGotoHumanDelay(detailPage) {
  await detailPage.waitForTimeout(randomDelay(1200, 2600));
}
```

**关键点**：

- 延迟不只放在异常重试时，正常链路也必须有
- 搜索页行为用于伪装浏览，不用于进入详情
- detail page 打开后要留出初始渲染和懒加载缓冲

---

### 3. 搜索页保留真实浏览行为

**问题**：

- 如果搜索页只是一闪而过地提取 URL，然后立即连续跳详情，行为过于像机器人

**解决方案**：

- 在搜索页停留 2 到 6 秒
- 进行 1 到 3 次小幅滚动
- 偶尔 hover 前几张卡片
- 在帖子之间继续保留搜索页内浏览动作

```javascript
async function browseSearchResults(searchPage) {
  await searchPage.waitForTimeout(randomDelay(2000, 6000));

  const moves = randomInt(1, 3);
  for (let i = 0; i < moves; i++) {
    const delta = randomInt(100, 400) * (Math.random() > 0.4 ? 1 : -1);
    await searchPage.evaluate((value) => {
      window.scrollBy({ top: value, behavior: "smooth" });
    }, delta);
    await searchPage.waitForTimeout(randomDelay(500, 1200));
  }

  const cards = searchPage.locator("section a[href]");
  const count = await cards.count();
  if (count > 0 && Math.random() < 0.3) {
    await cards.nth(randomInt(0, Math.min(count - 1, 4))).hover().catch(() => null);
    await searchPage.waitForTimeout(randomDelay(500, 1000));
  }
}
```

**关键点**：

- 浏览行为保留在搜索页
- 不再通过点击卡片进入详情
- 搜索页行为的目标是降低风控，不是复用为详情采集上下文

---

### 4. 不持有长期元素句柄，每次操作前重新探测

**问题**：

- DOM 重建后，旧的元素句柄和旧的滚动容器引用立即失效

**解决方案**：

- 不缓存 `elementHandle`
- 不缓存长期有效的 `detailContext`
- 每轮操作前都重新探测当前详情会话

```javascript
async function probeDetailSession(page, targetNoteId) {
  return await page.evaluate(({ noteId, scrollSelectors }) => {
    const isVisible = (el) =>
      !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

    const activeNoteId =
      location.href.match(/\/([a-f0-9]{24})\b/i)?.[1] ||
      Object.keys(window.__INITIAL_STATE__?.note?.noteDetailMap || {})[0] ||
      "";

    const scrollSelector =
      scrollSelectors.find((selector) => {
        const el = document.querySelector(selector);
        return isVisible(el) && el.scrollHeight > el.clientHeight + 20;
      }) || "";

    const hasComments = !!document.querySelector(".comments-container");
    const hasLoginLayer = !!document.querySelector(".login-container, [class*='login-modal']");
    const hasRiskLayer = /300013|访问频繁|请稍后再试/.test(document.body?.innerText || "");

    return {
      ok: activeNoteId === noteId && hasComments && !hasLoginLayer && !hasRiskLayer,
      activeNoteId,
      scrollSelector,
      scrollMode: scrollSelector ? "container" : "window",
      hasComments,
      hasLoginLayer,
      hasRiskLayer,
    };
  }, { noteId: targetNoteId, scrollSelectors: [".note-scroller", "[class*='note-scroller']"] });
}
```

**关键点**：

- 每轮都重新确认 `activeNoteId === targetNoteId`
- 上下文检测必须同时覆盖评论区、登录层、风控层
- 如果探测失败，不继续操作旧会话

---

### 5. 为 `page.evaluate` 和 `locator` 操作提供统一恢复包装

**问题**：

- `Execution context was destroyed` 并不只是”再等一下”
- 如果继续用旧上下文，很可能采到错页、空页或中断层
- **审查补充**：现有代码中 `clickShowMoreButtons` 用 `page.locator().click()`、`checkEndContainer` 用 `page.locator().isVisible()` 等 locator API 同样会在上下文销毁时报错，但原方案只包装了 `page.evaluate`

**解决方案**：

- 给**所有关键 DOM 操作**（evaluate 和 locator）统一包一层容错逻辑
- 命中上下文销毁后，先等待页面重新进入可探测状态
- 然后重新探测详情会话
- 如果已经不是目标帖子，抛出 `DetailSessionLostError`

```javascript
const CONTEXT_DESTROYED_RE = /Execution context was destroyed|Cannot find context|Target closed|frame was detached/i;

// 包装 page.evaluate
async function safeEval(page, label, fn, arg, targetNoteId) {
  try {
    return await page.evaluate(fn, arg);
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || “”)) throw error;
    await recoverOrThrow(page, label, targetNoteId);
    return await page.evaluate(fn, arg);
  }
}

// 包装 locator 操作（click、isVisible、count 等）
async function safeLocatorOp(page, label, locatorFn, targetNoteId) {
  try {
    return await locatorFn();
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || “”)) throw error;
    await recoverOrThrow(page, label, targetNoteId);
    return await locatorFn();
  }
}

// 统一恢复逻辑
async function recoverOrThrow(page, label, targetNoteId) {
  await page.waitForLoadState(“domcontentloaded”).catch(() => null);
  await page.waitForTimeout(randomDelay(500, 1200));

  const session = await probeDetailSession(page, targetNoteId).catch(() => null);
  if (!session?.ok) {
    throw new Error(`DetailSessionLostError: ${label}`);
  }
}
```

**关键点**：

- 不吞掉上下文销毁错误
- evaluate 和 locator 操作共用同一套恢复逻辑
- 恢复前必须重新校验 detail session
- `DetailSessionLostError` 交给外层重建 worker page

---

### 6. 添加 300013 检测和恢复机制

**问题**：

- 直接跳详情页和短间隔多帖采集都容易命中 300013
- 命中后如果继续滚动和等评论区，只会浪费时间并放大异常

**解决方案**：

- `goto` 后立刻检查 300013 关键词和风控文本
- 命中后立即终止本次 detail session
- 冷却 15 到 30 秒后重建新 page 重试
- 同一帖子最多重试 2 到 3 次
- 连续多帖命中时整体降速

```javascript
async function detectRateLimit(page) {
  const text = await page.evaluate(() => document.body?.innerText || "");
  return /300013|安全限制|访问频繁|请稍后再试/.test(text);
}

async function handleRateLimit(contextState, postIndex) {
  contextState.rateLimitHits += 1;

  const cooldown = randomDelay(15000, 30000) + Math.min(postIndex * 1000, 10000);
  await sleep(cooldown);

  if (contextState.rateLimitHits >= 2) {
    contextState.extraPostGap = Math.min(contextState.extraPostGap + 3000, 15000);
  }
}
```

**关键点**：

- 300013 检测要放在 `goto` 之后、评论加载之前
- 命中限流后要销毁当前 detail page，不继续复用
- 恢复策略以冷却和重建为主，不再 `goBack`

---

### 7. 评论采集重试以”重建 worker page”作为边界

**问题**：

- 当前重试是基于同一个 page 的连续尝试，容易把坏状态带进下一轮

**解决方案**：

- 同一帖子允许 2 到 3 次尝试
- `DetailSessionLostError` 或连续 context destroyed 时，先重建 worker page 再重试
- 普通错误（超时等）直接在现有 worker page 上重新 `goto` 重试

```javascript
async function processPostWithRetry(searchPage, post, context, state) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processPost(searchPage, post, context);
    } catch (error) {
      const message = error?.message || String(error);

      if (/DetailSessionLostError|Execution context was destroyed/i.test(message)) {
        // 会话丢失：重建 worker page
        await workerPage?.close().catch(() => null);
        workerPage = null;
      }

      if (/300013|访问频繁/.test(message)) {
        await handleRateLimit(state, attempt);
      } else {
        await sleep(randomDelay(1500, 4000));
      }

      if (attempt === maxRetries) throw error;
    }
  }
}
```

**关键点**：

- “重试”不等于在同一个坏会话上继续
- 会话丢失时重建 worker page，普通错误时复用现有 page 重新 goto
- 重试之间始终有延迟

---

### 8. Worker page 混合重建策略（审查新增）

**问题**：

- Worker page 长期运行会积累内存和状态
- 需要明确定义何时重建

**解决方案**：

- **主动重建**：每处理 5 篇帖子后主动关闭并重建 worker page
- **被动重建**：遇到以下异常时立即重建：
  - `DetailSessionLostError`
  - 连续 2 次 `Execution context was destroyed`
  - 300013 连续失败 2 次
- 两种触发取先到者

```javascript
const WORKER_REBUILD_TRIGGERS = {
  maxPostsPerWorker: 5,       // 每 5 帖主动重建
  maxContextErrors: 2,        // 连续 2 次上下文销毁
  maxRateLimitConsecutive: 2, // 连续 2 次限流
};

function shouldRebuildWorker(state) {
  return (
    state.workerPostCount >= WORKER_REBUILD_TRIGGERS.maxPostsPerWorker ||
    state.consecutiveContextErrors >= WORKER_REBUILD_TRIGGERS.maxContextErrors ||
    state.consecutiveRateLimits >= WORKER_REBUILD_TRIGGERS.maxRateLimitConsecutive
  );
}
```

**关键点**：

- 主动重建防止状态积累，被动重建快速恢复异常
- 重建不会丢数据（配合增量保存）
- 计数器在重建后归零

---

### 9. 增量保存每篇帖子结果（审查新增，从「后续优化」提升）

**问题**：

- 现有代码在 `xhs-scraper.js:1556` 把所有结果一次性写入文件
- 如果跑到第 8 篇时崩溃，前 7 篇的数据全丢
- 在 worker page 模式下，会话丢失重建后必须知道哪些帖子已经采完

**解决方案**：

- 每篇帖子采集完成后立即追加写入输出文件
- 启动时加载已有数据，跳过已采集的帖子
- 保证幂等性：通过 noteId 去重

```javascript
function appendPostResult(outputPath, keyword, postData) {
  let existing = { keyword, scrapeTime: new Date().toISOString(), posts: [] };
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, “utf-8”));
  }

  // 按 noteId 去重
  const existingIds = new Set(existing.posts.map((p) => p.noteId));
  if (!existingIds.has(postData.noteId)) {
    existing.posts.push(postData);
    existing.scrapeTime = new Date().toISOString();
    fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), “utf-8”);
  }
}
```

**关键点**：

- 崩溃恢复：重启后自动跳过已采集帖子
- Worker page 重建后不丢已有进度
- 通过 noteId 保证去重，不会重复写入

---

## 修改优先级

### 立即修改（高优先级）

1. ✅ 取消搜索页点击和 `goBack` 恢复
   - 搜索页只保留为列表页
   - 改为固定 worker page + `goto(post.url)` 复用处理（不每帖新开 tab）

2. ✅ 为 `goto` 前后补充人类化延迟
   - 在搜索页增加停留、滚动、hover
   - 在 detail page 初始加载后增加缓冲等待

3. ✅ 增加 300013 检测和恢复机制
   - `goto` 后立即检测
   - 命中后冷却、重建 worker page、重试

4. ✅ 所有关键 DOM 操作改为”先探测会话，再执行”
   - 不持有长期句柄
   - `detailContext` 每 10-20 次循环重新探测（而非一次性缓存到底）

5. ✅ 为关键 `page.evaluate` **和 `locator` 操作**添加统一恢复包装
   - 命中上下文销毁后，重新探测或重建会话
   - **审查补充**：locator API（click、isVisible、count）同样需要包装

6. ✅ **[审查新增]** 增量保存每篇帖子结果
   - 每篇帖子采完立即写入文件
   - 崩溃重启后自动跳过已采集帖子
   - 通过 noteId 去重保证幂等

7. ✅ **[审查新增]** Worker page 混合重建策略
   - 每 5 帖主动重建 + 异常时立即重建
   - 防止内存和状态积累

### 后续优化（中优先级）

1. 增加评论 API 响应捕获，降低对 `__INITIAL_STATE__` 的单点依赖
2. 增加登录层、验证码层、分享层的专门中断处理
3. 清理 modal 相关死代码（goto 模式下 `closeDetailModal`、`waitForDetailOpen` 的 modal 分支不再使用）

---

## 实施建议

### 第一阶段：流程重构 + 增量保存

1. 拆分搜索页和详情页职责
2. 删除 `navigateToPost()` 中的点击链路
3. 删除 `returnToSearch()` 和 `closeDetailModal()` 等 modal/goBack 复位逻辑
4. 新增固定 worker page 管理（创建、复用、重建）
5. 实现增量保存（每帖写入 + noteId 去重 + 启动时加载已有数据）

### 第二阶段：稳定性增强

1. 实现 `applyPreGotoHumanDelay()` 和 `applyPostGotoHumanDelay()`
2. 实现 `probeDetailSession()`
3. 实现 `safeEval()` 和 `safeLocatorOp()`（统一包装 evaluate 和 locator）
4. 把 `loadAllComments` 循环中的 `detailContext` 改为每 N 次重新探测
5. 把滚动、评论计数、展开回复全部改为动态会话探测模式

### 第三阶段：限流恢复和验证

1. 实现 300013 检测和冷却逻辑
2. 实现 worker page 混合重建策略（每 5 帖 + 异常触发）
3. 测试多帖连续采集时的节流效果
4. 测试上下文销毁后的恢复效果
5. 测试崩溃恢复（中途 kill 后重启，验证增量数据完整性）

---

## 预期效果

修复后应该能够：

1. ✅ 显著减少 `Execution context was destroyed`
2. ✅ 消除“同一 page 在搜索页和详情页之间反复切换”带来的状态污染
3. ✅ 不再依赖 `goBack` 回搜索页恢复
4. ✅ 降低 300013 触发后的连锁失败
5. ✅ 提高多帖子连续采集的稳定性

---

## 风险评估

### 中风险

- 直接 `goto(post.url)` 的详情采集方式更稳定，但仍然更容易暴露机械化导航节奏
- 缓解措施：
  - 保留搜索页停留和滚动行为
  - 在 `goto` 前后增加人类化延迟
  - 保留帖子间间隔，并在命中 300013 后动态抬高间隔
  - **审查补充**：使用固定 worker page 复用（而非每帖新开 tab），避免了「反复开关标签」的自动化指纹

### 低风险

- ~~每篇帖子新建 page 会带来更多资源开销~~ 已通过 worker page 复用消除
- Worker page 长期运行的内存积累
- 缓解措施：
  - 每 5 帖主动重建
  - 异常时立即重建

### 中风险

- 只修复上下文问题，仍不能彻底解决 `__INITIAL_STATE__` 数据不完整问题
- 缓解措施：
  - 后续补评论接口捕获或 DOM fallback
  - **审查确认**：经验证 XHS 的状态管理会将 XHR 加载的评论同步回 `__INITIAL_STATE__`，当前提取逻辑不会丢数据

---

## 后续监控

修复后需要重点监控：

1. `Execution context was destroyed` 出现频率
2. `DetailSessionLostError` 出现频率
3. 300013 命中率和平均冷却时间
4. 单帖平均采集时间
5. 评论提取完整性
6. 多帖连续运行成功率
7. **[审查新增]** Worker page 重建频率（主动 vs 被动触发比例）
8. **[审查新增]** 增量保存的崩溃恢复成功率

---

## 审查记录

### v1.2 审查发现总结（2026-03-30）

**架构调整（2 项）**：

1. **Worker page 复用替代每帖新开 tab** — 原方案每帖 `context.newPage()` 后 `close()` 会产生强自动化指纹。改为固定 worker page + `goto` 复用，每 N 帖或异常时重建。
2. **detailContext 周期性重新探测** — 原方案的 `resolveDetailContext()` 只调用一次就缓存到底（可能跑上千次循环）。改为每 10-20 次滚动循环重新探测。

**新增必做项（3 项）**：

3. **safeLocatorOp 统一包装** — 原方案只包装了 `page.evaluate`，但 `locator.click()`、`locator.isVisible()` 等同样会在上下文销毁时报错。
4. **增量保存提升为高优先级** — 原方案列为「后续优化」，但 worker page 重建后必须知道已采集进度，增量保存是前置条件。
5. **Worker page 混合重建策略** — 定义了明确的重建触发条件：每 5 帖主动重建 + 异常（SessionLost / context destroyed / 连续限流）时立即重建。

**已排除的风险（4 项）**：

- `__INITIAL_STATE__` 会同步 XHR 数据 → 不会丢评论
- `goto` 会完全重写 state → 不会跨帖污染
- 15-30s 300013 冷却时间 → 实际成功率很高
- 滑块验证码/分享弹窗等中断层 → 当前采集规模下未触发

---

**文档版本**: v1.2
**更新日期**: 2026-03-30
**状态**: 已完成代码审查，含 2 项架构调整 + 3 项新增必做项
