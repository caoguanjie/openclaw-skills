# XHS Playwright 上下文稳定性修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 xhs-scraper.js 的帖子处理流程，从「单页面 click+goBack」模式切换到「固定 worker page + goto 复用」模式，同时增加增量保存、上下文安全包装和 worker page 混合重建策略。

**Architecture:** 搜索页（page）只负责浏览和收集 URL。创建一个固定的 worker page 用 goto(post.url) 逐帖处理。每 5 帖或异常时重建 worker page。所有 evaluate/locator 操作用统一的 safeEval/safeLocatorOp 包装。每帖采集完立即写盘。

**Tech Stack:** Node.js, Playwright, 现有 human.js 延迟库

**Source file:** `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js` (1581 lines)
**Design doc:** `docs/xhs-playwright-context-stability-fix.md` (v1.2)

---

### Task 1: Add incremental save function

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js:1040-1060`

**Step 1: Add `appendPostResult()` after `loadExistingData()` (line 1060)**

Insert the following function immediately after the closing `}` of `loadExistingData` (line 1060):

```javascript
// ─── 增量保存（每帖采完立即写盘，noteId 去重） ───
function appendPostResult(outputPath, keyword, postData) {
  let existing = { keyword, scrapeTime: new Date().toISOString(), posts: [] };
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    } catch {
      // 文件损坏时从空开始
    }
  }

  const noteId = postData.noteId;
  const existingIds = new Set(existing.posts.map((p) => p.noteId));
  if (existingIds.has(noteId)) {
    return false; // 已存在，跳过
  }

  existing.posts.push(postData);
  existing.scrapeTime = new Date().toISOString();

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), "utf-8");
  return true;
}
```

**Step 2: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): add appendPostResult for incremental save"
```

---

### Task 2: Add worker page management infrastructure

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**Step 1: Add worker page config to human.js**

In `.claude/skills/xiaohongshu-playwright/scripts/human.js`, add to the `CONFIG` object (after `MAX_COMMENTS_HARD_LIMIT: 500` on line 17):

```javascript
  WORKER_REBUILD_INTERVAL: 5,       // 每 5 帖主动重建 worker page
  WORKER_MAX_CONTEXT_ERRORS: 2,     // 连续 2 次上下文销毁触发重建
  WORKER_MAX_RATE_LIMITS: 2,        // 连续 2 次限流触发重建
  DETAIL_CONTEXT_REPROBE_INTERVAL: 15, // 每 15 次滚动循环重新探测 detailContext
```

**Step 2: Add worker page state and management functions to xhs-scraper.js**

Insert after the `DETAIL_SCROLL_SELECTORS` array (line 241), before `function extractNoteId`:

```javascript
// ─── Worker page 状态管理 ───
let _workerPage = null;
let _workerState = {
  postCount: 0,
  consecutiveContextErrors: 0,
  consecutiveRateLimits: 0,
  rateLimitHits: 0,
  extraPostGap: 0,
};

function resetWorkerState() {
  _workerState.postCount = 0;
  _workerState.consecutiveContextErrors = 0;
  _workerState.consecutiveRateLimits = 0;
}

async function getWorkerPage(context) {
  if (!_workerPage || _workerPage.isClosed()) {
    _workerPage = await context.newPage();
    await _workerPage.addInitScript(ANTI_DETECT_SCRIPT);
    resetWorkerState();
    console.log("  🔧 Worker page 已创建");
  }
  return _workerPage;
}

async function rebuildWorkerPage(context, reason) {
  console.log(`  🔄 重建 worker page: ${reason}`);
  if (_workerPage && !_workerPage.isClosed()) {
    await _workerPage.close().catch(() => null);
  }
  _workerPage = null;
  return getWorkerPage(context);
}

function shouldRebuildWorker() {
  return (
    _workerState.postCount >= CONFIG.WORKER_REBUILD_INTERVAL ||
    _workerState.consecutiveContextErrors >= CONFIG.WORKER_MAX_CONTEXT_ERRORS ||
    _workerState.consecutiveRateLimits >= CONFIG.WORKER_MAX_RATE_LIMITS
  );
}
```

**Step 3: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js && node -c .claude/skills/xiaohongshu-playwright/scripts/human.js`
Expected: No output (syntax OK)

**Step 4: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js .claude/skills/xiaohongshu-playwright/scripts/human.js
git commit -m "feat(xhs): add worker page state management infrastructure"
```

---

### Task 3: Add session probing and safe wrappers

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**Step 1: Add the context-destroyed regex and safe wrapper functions**

Insert after the worker page management block (after `shouldRebuildWorker` function), before `function extractNoteId`:

```javascript
// ─── 上下文安全包装 ───
const CONTEXT_DESTROYED_RE = /Execution context was destroyed|Cannot find context|Target closed|frame was detached/i;

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
  }, { noteId: targetNoteId, scrollSelectors: DETAIL_SCROLL_SELECTORS });
}

async function recoverOrThrow(page, label, targetNoteId) {
  await page.waitForLoadState("domcontentloaded").catch(() => null);
  await sleepRandom(500, 1200);

  const session = await probeDetailSession(page, targetNoteId).catch(() => null);
  if (!session?.ok) {
    throw new Error(`DetailSessionLostError: ${label}`);
  }
  return session;
}

async function safeEval(page, label, fn, arg, targetNoteId) {
  try {
    return await page.evaluate(fn, arg);
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || "")) throw error;
    console.warn(`  ⚠️ 上下文销毁 [${label}]，尝试恢复...`);
    await recoverOrThrow(page, label, targetNoteId);
    return await page.evaluate(fn, arg);
  }
}

async function safeLocatorOp(page, label, locatorFn, targetNoteId) {
  try {
    return await locatorFn();
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || "")) throw error;
    console.warn(`  ⚠️ 上下文销毁 [${label}]，尝试恢复...`);
    await recoverOrThrow(page, label, targetNoteId);
    return await locatorFn();
  }
}
```

**Step 2: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): add probeDetailSession, safeEval, safeLocatorOp"
```

---

### Task 4: Add human delay functions for goto transitions

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**Step 1: Add pre/post goto delay functions**

Insert after the `safeLocatorOp` function, before `function extractNoteId`:

```javascript
// ─── goto 前后人类化延迟 ───
async function applyPreGotoHumanDelay(searchPage) {
  await sleepRandom(1500, 3500);

  const moves = randomInt(1, 3);
  for (let i = 0; i < moves; i++) {
    const delta = randomInt(80, 260) * (Math.random() > 0.3 ? 1 : -1);
    await searchPage.evaluate((value) => {
      window.scrollBy({ top: value, behavior: "smooth" });
    }, delta).catch(() => null);
    await sleepRandom(400, 900);
  }
}

async function applyPostGotoHumanDelay(detailPage) {
  await sleepRandom(1200, 2600);
}
```

**Step 2: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): add pre/post goto human delay functions"
```

---

### Task 5: Modify loadAllComments for periodic re-probing and safe wrappers

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js:1063-1165` (loadAllComments function)

This is the most delicate change. We need to:
1. Add `targetNoteId` parameter
2. Re-probe `detailContext` every `DETAIL_CONTEXT_REPROBE_INTERVAL` iterations
3. Wrap key evaluate calls with `safeEval`

**Step 1: Replace the `loadAllComments` function signature and add re-probing**

Replace the entire `loadAllComments` function (lines 1063-1165) with:

```javascript
async function loadAllComments(page, maxComments, speed, detailContext, targetNoteId) {
  const effectiveMax = maxComments > 0
    ? Math.min(maxComments, CONFIG.MAX_COMMENTS_HARD_LIMIT)
    : CONFIG.MAX_COMMENTS_HARD_LIMIT;
  const maxAttempts = effectiveMax * 3;
  const scrollInterval = getScrollInterval(speed);
  const reprobeInterval = CONFIG.DETAIL_CONTEXT_REPROBE_INTERVAL || 15;
  let currentContext = { ...detailContext };

  console.log("  📜 开始加载评论...");
  await scrollToCommentsArea(page, currentContext);
  await sleepRandom(...DELAYS.HUMAN_DELAY);

  const noComments = await safeEval(page, "checkNoComments", (ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const el = root?.querySelector(".no-comments-text") || document.querySelector(".no-comments-text");
    return el ? el.textContent.includes("这是一片荒地") : false;
  }, currentContext, targetNoteId);
  if (noComments) {
    console.log("  ℹ️ 该帖子无评论");
    return { hasComments: false };
  }

  let lastCount = 0;
  let lastScrollTop = 0;
  let stagnantChecks = 0;
  let totalClicked = 0;
  let totalSkipped = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 周期性重新探测 detailContext
    if (attempt > 0 && attempt % reprobeInterval === 0) {
      try {
        const session = await probeDetailSession(page, targetNoteId);
        if (!session.ok) {
          throw new Error(`DetailSessionLostError: reprobe at attempt ${attempt}`);
        }
        currentContext = {
          mode: "fullpage",
          rootSelector: "",
          scrollMode: session.scrollMode,
          scrollSelector: session.scrollSelector,
        };
      } catch (e) {
        if (/DetailSessionLostError/i.test(e?.message || "")) throw e;
        // 探测失败但不是 session lost，继续用旧 context
      }
    }

    const isEnd = await safeEval(page, "checkEndContainer", (ctx) => {
      const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
      const el = root?.querySelector(".end-container") || document.querySelector(".end-container");
      if (!el) return false;
      const text = el.textContent.trim().toUpperCase();
      return text.includes("THE END") || text.includes("THEEND");
    }, currentContext, targetNoteId);
    if (isEnd) {
      const count = await safeEval(page, "getCommentCount", (ctx) => {
        const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
        return root?.querySelectorAll(".parent-comment").length || 0;
      }, currentContext, targetNoteId);
      console.log(`  ✅ 检测到 THE END，加载完成: ${count} 条评论, 点击: ${totalClicked}, 跳过: ${totalSkipped}`);
      return { hasComments: true };
    }

    if (attempt % CONFIG.BUTTON_CLICK_INTERVAL === 0) {
      const { clicked, skipped } = await safeEval(page, "clickShowMore", ({ ctx, threshold }) => {
        const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
        const btns = root?.querySelectorAll(".show-more") || [];
        let clicked = 0;
        let skipped = 0;
        btns.forEach((btn) => {
          const text = btn.textContent || "";
          const match = text.match(/展开\s*(\d+)\s*条回复/);
          if (match && parseInt(match[1], 10) > threshold) {
            skipped++;
            return;
          }
          btn.click();
          clicked++;
        });
        return { clicked, skipped };
      }, { ctx: currentContext, threshold: 50 }, targetNoteId);
      totalClicked += clicked;
      totalSkipped += skipped;
      if (clicked > 0 || skipped > 0) {
        await sleepRandom(...DELAYS.READ_TIME);
        const r2 = await safeEval(page, "clickShowMore2", ({ ctx, threshold }) => {
          const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
          const btns = root?.querySelectorAll(".show-more") || [];
          let clicked = 0;
          let skipped = 0;
          btns.forEach((btn) => {
            const text = btn.textContent || "";
            const match = text.match(/展开\s*(\d+)\s*条回复/);
            if (match && parseInt(match[1], 10) > threshold) {
              skipped++;
              return;
            }
            btn.click();
            clicked++;
          });
          return { clicked, skipped };
        }, { ctx: currentContext, threshold: 50 }, targetNoteId);
        totalClicked += r2.clicked;
        totalSkipped += r2.skipped;
        if (r2.clicked > 0 || r2.skipped > 0) {
          await sleepRandom(...DELAYS.SHORT_READ);
        }
      }
    }

    const currentCount = await safeEval(page, "getCommentCount", (ctx) => {
      const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
      return root?.querySelectorAll(".parent-comment").length || 0;
    }, currentContext, targetNoteId);
    if (currentCount !== lastCount) {
      if (attempt % 5 === 0 || currentCount - lastCount > 5) {
        console.log(`  📊 评论增加: ${lastCount} -> ${currentCount}`);
      }
      lastCount = currentCount;
      stagnantChecks = 0;
    } else {
      stagnantChecks++;
    }

    if (currentCount >= effectiveMax) {
      console.log(`  ✅ 已达到目标评论数: ${currentCount}/${effectiveMax}`);
      return { hasComments: true };
    }

    if (currentCount > 0) {
      await safeEval(page, "scrollToLastComment", (ctx) => {
        const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
        const comments =
          root?.querySelectorAll(".parent-comment") || document.querySelectorAll(".parent-comment");
        if (comments.length > 0) {
          comments[comments.length - 1].scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, currentContext, targetNoteId);
      await sleepRandom(...DELAYS.POST_SCROLL);
    }

    const largeMode = stagnantChecks >= CONFIG.LARGE_SCROLL_TRIGGER;
    let pushCount = 1;
    if (largeMode) {
      pushCount = 3 + randomInt(0, 2);
    }

    const { actualDelta, currentScrollTop } = await humanScroll(
      page,
      speed,
      largeMode,
      pushCount,
      currentContext
    );

    if (actualDelta < CONFIG.MIN_SCROLL_DELTA || currentScrollTop === lastScrollTop) {
      stagnantChecks++;
    } else {
      stagnantChecks = 0;
      lastScrollTop = currentScrollTop;
    }

    if (stagnantChecks >= CONFIG.STAGNANT_LIMIT) {
      console.log("  ⚡ 停滞过多，尝试大冲刺...");
      await humanScroll(page, speed, true, 10, currentContext);
      stagnantChecks = 0;
    }

    await new Promise((r) => setTimeout(r, scrollInterval));
  }

  console.log("  🏃 达到最大尝试次数，最后冲刺...");
  await humanScroll(page, speed, true, CONFIG.FINAL_SPRINT_PUSH_COUNT, currentContext);
  const count = await safeEval(page, "getCommentCount", (ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    return root?.querySelectorAll(".parent-comment").length || 0;
  }, currentContext, targetNoteId);
  console.log(`  📊 加载结束: ${count} 条评论, 点击: ${totalClicked}, 跳过: ${totalSkipped}`);
  return { hasComments: count > 0 };
}
```

**Step 2: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): rewrite loadAllComments with periodic reprobe and safeEval"
```

---

### Task 6: Rewrite extractComments to pass targetNoteId

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js:1177-1277` (extractComments function)

**Step 1: Update extractComments to use targetNoteId**

The only change needed in `extractComments` is passing `targetNoteId` to `loadAllComments`. Replace the `loadAllComments` call (around line 1198):

Change:
```javascript
  const { hasComments } = await loadAllComments(page, maxComments, speed, detailContext);
```

To:
```javascript
  const feedId = post.noteId || extractNoteId(post.url);
  // ... (feedId already declared above on ~line 1180)
  const { hasComments } = await loadAllComments(page, maxComments, speed, detailContext, feedId);
```

Note: `feedId` is already declared on line 1180. Just pass it to `loadAllComments`. Find the exact line with `loadAllComments(page, maxComments, speed, detailContext)` and add `feedId` as the 5th argument.

Also wrap the `__INITIAL_STATE__` extraction and screenshot with safeEval:

Replace `const stateResult = await page.evaluate(EXTRACT_DETAIL_JS);` (around line 1214) with:
```javascript
  const stateResult = await safeEval(page, "extractState", () => {
    try {
      const state = window.__INITIAL_STATE__;
      if (state && state.note && state.note.noteDetailMap) {
        return JSON.stringify(state.note.noteDetailMap);
      }
    } catch {}
    return "";
  }, undefined, feedId);
```

And do the same for the earlier `page.evaluate(EXTRACT_DETAIL_JS)` call (around line 1201) in the no-comments branch.

**Step 2: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): pass targetNoteId through extractComments to loadAllComments"
```

---

### Task 7: Rewrite main loop with worker page pattern

This is the largest task. We rewrite the post-processing loop in `main()` (lines 1449-1544) and add the new `processPost` / `processPostWithRetry` functions.

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**Step 1: Add processPost and processPostWithRetry functions**

Insert after `appendPostResult` function (from Task 1), before `sanitizeKeywordForFilename`:

```javascript
// ─── 单帖处理（在 worker page 上执行） ───
async function processPost(searchPage, post, context, opts) {
  const detailPage = await getWorkerPage(context);
  const feedId = post.noteId || extractNoteId(post.url);

  // goto 前：搜索页人类化停留
  await applyPreGotoHumanDelay(searchPage);

  await detailPage.goto(post.url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // goto 后：等待页面渲染
  await applyPostGotoHumanDelay(detailPage);

  // 检查 300013
  if (await checkRateLimit(detailPage)) {
    throw new Error("300013: 触发频率限制");
  }

  // 确认详情会话就绪
  const session = await probeDetailSession(detailPage, feedId).catch(() => null);
  if (!session?.ok) {
    throw new Error(`DetailSessionLostError: 详情页未就绪 (noteId=${feedId}, active=${session?.activeNoteId})`);
  }

  // 等待 __INITIAL_STATE__ 和评论区
  try {
    await detailPage.waitForFunction(
      () => window.__INITIAL_STATE__?.note?.noteDetailMap,
      { timeout: 10000 }
    );
  } catch {
    console.warn("  ⚠️ __INITIAL_STATE__ 加载超时");
  }

  try {
    await detailPage.waitForSelector(".comments-container", { timeout: 8000 });
  } catch {
    console.warn("  ⚠️ 评论区加载超时");
  }

  // 构建 detailContext（goto fullpage 模式下始终为 window scroll）
  const detailContext = {
    mode: "fullpage",
    rootSelector: "",
    scrollMode: session.scrollMode,
    scrollSelector: session.scrollSelector,
  };

  // 提取评论
  const postData = await extractComments(
    detailPage,
    post,
    opts.maxComments,
    opts.speed,
    detailContext
  );

  _workerState.postCount++;
  _workerState.consecutiveContextErrors = 0;
  _workerState.consecutiveRateLimits = 0;

  // 达到重建间隔时标记（外层处理）
  return postData;
}

async function processPostWithRetry(searchPage, post, context, opts) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processPost(searchPage, post, context, opts);
    } catch (error) {
      const message = error?.message || String(error);
      console.warn(`  ⚠️ 第 ${attempt} 次处理异常: ${message}`);

      if (/DetailSessionLostError|Execution context was destroyed|Cannot find context/i.test(message)) {
        _workerState.consecutiveContextErrors++;
        await rebuildWorkerPage(context, `会话丢失 (attempt ${attempt})`);
      }

      if (/300013|访问频繁/.test(message)) {
        _workerState.consecutiveRateLimits++;
        _workerState.rateLimitHits++;
        const cooldown = randomInt(15000, 30000) + Math.min(attempt * 2000, 10000);
        console.log(`  ⏳ 限流冷却 ${Math.round(cooldown / 1000)}s...`);
        await sleepRandom(cooldown, cooldown + 2000);

        if (_workerState.rateLimitHits >= 2) {
          _workerState.extraPostGap = Math.min(_workerState.extraPostGap + 3000, 15000);
        }
      } else {
        await sleepRandom(1500, 4000);
      }

      if (attempt === maxRetries) {
        console.error(`  ❌ ${maxRetries} 次尝试均失败，跳过此帖`);
        return null;
      }
    }
  }
  return null;
}
```

**Step 2: Rewrite the main loop (lines ~1449-1544)**

Replace the entire "4. 逐篇提取评论" section (from `// 4. 逐篇提取评论` to the end of the for loop including the post-gap delay) with:

```javascript
    // 4. 逐篇提取评论（worker page 模式 + 增量保存）
    for (let i = 0; i < posts.length; i++) {
      console.log(`\n📌 [${i + 1}/${posts.length}] 处理帖子: ${posts[i].url}`);

      // 预检查：是否需要重建 worker page
      if (shouldRebuildWorker()) {
        await rebuildWorkerPage(context, `主动重建 (已处理 ${_workerState.postCount} 帖)`);
      }

      const postData = await processPostWithRetry(page, posts[i], context, opts);

      if (postData) {
        const record = {
          title: postData.title || posts[i].title,
          url: posts[i].url,
          noteId: posts[i].noteId || extractNoteId(posts[i].url),
          author: postData.author || posts[i].author,
          commentCount: postData.commentCount || "0",
          comments: postData.comments,
          screenshotFile: postData.screenshotFile || "",
        };

        // 增量保存
        const saved = appendPostResult(opts.output, opts.keyword, record);
        if (saved) {
          console.log(`  💾 已保存到 ${path.basename(opts.output)}`);
        }
      }

      // 帖子间间隔
      if (i < posts.length - 1) {
        await browseSearchResults(page);
        const baseGap = randomInt(DELAYS.POST_GAP[0], DELAYS.POST_GAP[1]);
        const totalGap = baseGap + _workerState.extraPostGap;
        await sleepRandom(totalGap, totalGap + 1000);
        await navigationDelay();
        console.log(`  ⏱️ 帖子间等待 ~${Math.round(totalGap / 1000)}s 完成`);
      }
    }
```

**Step 3: Update the final save section (lines ~1546-1567)**

Replace the batch-write section with a summary that reads from the incremental file:

```javascript
    // 5. 读取最终结果（已增量保存）
    let finalResult = { keyword: opts.keyword, posts: [] };
    if (fs.existsSync(opts.output)) {
      finalResult = JSON.parse(fs.readFileSync(opts.output, "utf-8"));
    }

    const totalComments = finalResult.posts.reduce(
      (sum, p) => sum + (p.comments?.length || 0),
      0
    );
    console.log(`\n✅ 采集完成!`);
    console.log(`   合计帖子: ${finalResult.posts.length}`);
    console.log(`   合计评论: ${totalComments}`);
    console.log(`   输出: ${opts.output}`);

    runPostPipeline(opts, finalResult, taskSpec);
```

**Step 4: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 5: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "feat(xhs): rewrite main loop with worker page pattern and incremental save"
```

---

### Task 8: Delete dead code

Now that the main loop uses worker page + goto, the following functions are dead code:

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**Step 1: Delete the following functions and related code**

Delete these functions entirely:
1. `findPostCard` (lines ~561-569) — no longer searching for cards to click
2. `detectDetailState` (lines ~571-599) — was for modal/fullpage detection
3. `waitForDetailOpen` (lines ~601-614) — was for waiting after click
4. `navigateToPost` (lines ~616-645) — replaced by worker page goto
5. `closeDetailModal` (lines ~647-680) — no more modal to close
6. `returnToSearch` (lines ~682-698) — no more returning to search from same page
7. `dismissOverlays` (lines ~540-559) — was called by navigateToPost
8. `resolveDetailContext` (lines ~793-825) — replaced by probeDetailSession

Also delete the standalone `checkNoComments` (lines ~1032-1038), `checkEndContainer` (lines ~1022-1030), `getCommentCount` (lines ~1015-1020), and `clickShowMoreButtons` (lines ~992-1013) functions — their logic is now inlined into `loadAllComments` via `safeEval`.

Also delete the standalone `scrollToLastComment` (lines ~980-989) — inlined into loadAllComments.

Keep:
- `scrollToCommentsArea` — still used by loadAllComments
- `browseSearchResults` — still used by main loop
- `ensureSearchPage` — still used for search page
- `getScrollMetrics`, `performScroll`, `humanScroll` — still used by loadAllComments

**Step 2: Remove unused selectors**

Remove `DETAIL_MODAL_SELECTORS` (lines ~225-229) and `DETAIL_CLOSE_SELECTORS` (lines ~230-236) — no longer needed for modal handling.

**Step 3: Verify syntax**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
Expected: No output (syntax OK)

**Step 4: Commit**

```bash
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "refactor(xhs): remove dead code from modal/click/goBack flow"
```

---

### Task 9: Smoke test

**Step 1: Dry-run syntax check**

Run: `node -c .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js && echo "OK"`
Expected: `OK`

**Step 2: Run with --headed to visually verify**

Run manually (requires login cookies):
```bash
cd .claude/skills/xiaohongshu-playwright
node scripts/xhs-scraper.js --keyword "测试" --max-posts 2 --max-comments 10 --headed --speed slow --task-spec data/task-specs/<your-spec>.json
```

Verify:
- [ ] Search page loads and stays open
- [ ] Worker page opens and navigates to first post via goto
- [ ] Comments load with periodic progress logs
- [ ] Post result saved incrementally (check data/comments_测试.json after first post)
- [ ] Worker page reused for second post (no new tab opened)
- [ ] No `Execution context was destroyed` errors
- [ ] No `goBack` or modal close attempts in logs
- [ ] Script completes and runs post-pipeline

**Step 3: Verify crash recovery**

1. Run the same command
2. After first post completes (see "💾 已保存"), Ctrl+C to kill
3. Re-run the same command
4. Verify it skips the first post ("跳过已采集帖子") and continues from post 2

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(xhs): verify context stability fix with smoke test"
```

---

## Summary of Changes

| File | Action | Lines Changed |
|------|--------|--------------|
| `scripts/xhs-scraper.js` | Major rewrite | ~400 lines modified/deleted, ~250 added |
| `scripts/human.js` | Config additions | ~4 lines added |

**New functions added:**
- `appendPostResult()` — incremental save
- `getWorkerPage()`, `rebuildWorkerPage()`, `shouldRebuildWorker()`, `resetWorkerState()` — worker page management
- `probeDetailSession()`, `recoverOrThrow()`, `safeEval()`, `safeLocatorOp()` — context safety
- `applyPreGotoHumanDelay()`, `applyPostGotoHumanDelay()` — human delays
- `processPost()`, `processPostWithRetry()` — new post processing flow

**Functions deleted:**
- `findPostCard`, `detectDetailState`, `waitForDetailOpen`, `navigateToPost`, `closeDetailModal`, `returnToSearch`, `dismissOverlays`, `resolveDetailContext`
- Standalone `checkNoComments`, `checkEndContainer`, `getCommentCount`, `clickShowMoreButtons`, `scrollToLastComment` (inlined into loadAllComments)

**Functions modified:**
- `loadAllComments` — added targetNoteId, periodic reprobe, safeEval wrapping
- `extractComments` — pass feedId to loadAllComments, safeEval for state extraction
- `main()` — new worker page loop + incremental save
