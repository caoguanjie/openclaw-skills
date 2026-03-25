#!/usr/bin/env node

/**
 * 小红书评论采集脚本 - 基于 Playwright
 *
 * 用法:
 *   node xhs-scraper.js --keyword "护肤" --max-posts 5 --max-comments 20
 *   node xhs-scraper.js --keyword "医美" --headless  # 有 cookie 时无头运行
 *
 * 输出: JSON 文件包含帖子及其评论数据
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ─── CLI 参数解析 ───
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    keyword: "",
    maxComments: 20,
    maxPosts: 5,
    headless: false,
    cookiePath: path.join(__dirname, "..", "data", "cookies.json"),
    output: path.join(__dirname, "..", "data", "comments.json"),
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--keyword":
        opts.keyword = args[++i];
        break;
      case "--max-comments":
        opts.maxComments = parseInt(args[++i], 10);
        break;
      case "--max-posts":
        opts.maxPosts = parseInt(args[++i], 10);
        break;
      case "--headless":
        opts.headless = true;
        break;
      case "--cookie-path":
        opts.cookiePath = args[++i];
        break;
      case "--output":
        opts.output = args[++i];
        break;
    }
  }

  if (!opts.keyword) {
    console.error("错误: --keyword 为必填参数");
    process.exit(1);
  }
  return opts;
}

// ─── 工具函数 ───
function randomDelay(min = 1000, max = 3000) {
  return new Promise((r) =>
    setTimeout(r, min + Math.random() * (max - min))
  );
}

// ─── Playwright 浏览器安装检查 ───
async function ensureBrowserInstalled() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (e) {
    if (
      e.message.includes("Executable doesn't exist") ||
      e.message.includes("browserType.launch")
    ) {
      console.error("❌ Playwright 浏览器未安装");
      console.error("   请运行: npx playwright install chromium");
      process.exit(1);
    }
    // 其他错误让它继续，可能是临时问题
  }
}

// ─── Cookie 管理 ───
async function loadCookies(context, cookiePath) {
  if (fs.existsSync(cookiePath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      if (Array.isArray(cookies) && cookies.length > 0) {
        // 过滤掉明显过期的 cookie
        const now = Date.now() / 1000;
        const valid = cookies.filter(
          (c) => !c.expires || c.expires === -1 || c.expires > now
        );
        if (valid.length > 0) {
          await context.addCookies(valid);
          console.log(`已加载 ${valid.length} 个有效 cookie（共 ${cookies.length} 个）`);
          return true;
        }
        console.warn("所有 cookie 已过期");
      }
    } catch (e) {
      console.warn("Cookie 文件解析失败:", e.message);
    }
  }
  return false;
}

async function saveCookies(context, cookiePath) {
  const cookies = await context.cookies();
  const dir = path.dirname(cookiePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  console.log(`已保存 ${cookies.length} 个 cookie`);
}

// ─── 登录检测（多重判断） ───
async function checkLogin(page) {
  try {
    await page.goto("https://www.xiaohongshu.com/explore", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await randomDelay(2000, 3000);

    const isLoggedIn = await page.evaluate(() => {
      // 策略1: 检查 cookie 中是否有用户标识
      const hasCookieUser = document.cookie.includes("customer_id") ||
                            document.cookie.includes("access-token");

      // 策略2: 检查页面是否有登录弹窗
      const hasLoginModal = !!document.querySelector(
        ".login-container, [class*='login-modal'], [class*='LoginModal']"
      );

      // 策略3: 检查是否有已登录用户元素
      const hasUserEl = !!document.querySelector(
        "[class*='user-avatar'], .reds-avatar, [class*='sidebar-user']"
      );

      // 策略4: 检查 __INITIAL_STATE__ 是否有用户信息
      let hasStateUser = false;
      try {
        const state = window.__INITIAL_STATE__;
        if (state && state.user && state.user.userInfo && state.user.userInfo.userId) {
          hasStateUser = true;
        }
      } catch {}

      // 有登录弹窗 → 未登录
      if (hasLoginModal) return false;
      // cookie 或 state 或 DOM 任一有用户标识 → 已登录
      return hasCookieUser || hasStateUser || hasUserEl;
    });

    return isLoggedIn;
  } catch (e) {
    console.warn("登录检测异常:", e.message);
    return false;
  }
}

// ─── 手动登录流程（基于 URL 变化检测，不依赖 page.pause） ───
async function manualLogin(page, context, cookiePath) {
  console.log("\n⚠️  需要登录小红书");
  console.log("📱 请在弹出的浏览器中完成登录（扫码或手机号）");
  console.log("⏳ 登录完成后脚本会自动继续...\n");

  await page.goto("https://www.xiaohongshu.com/explore", {
    waitUntil: "domcontentloaded",
  });

  // 等待用户登录完成：轮询检测登录状态
  // 最多等待 5 分钟
  const maxWait = 5 * 60 * 1000;
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const loggedIn = await page.evaluate(() => {
      const hasCookieUser = document.cookie.includes("customer_id") ||
                            document.cookie.includes("access-token");
      const hasLoginModal = !!document.querySelector(
        ".login-container, [class*='login-modal'], [class*='LoginModal']"
      );
      const hasUserEl = !!document.querySelector(
        "[class*='user-avatar'], .reds-avatar, [class*='sidebar-user']"
      );

      // 没有登录弹窗 + 有用户标识
      return !hasLoginModal && (hasCookieUser || hasUserEl);
    });

    if (loggedIn) {
      break;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ 已等待 ${elapsed}s，请在浏览器中完成登录...`);
  }

  if (Date.now() - startTime >= maxWait) {
    console.error("\n❌ 登录超时（5分钟），请重新运行脚本");
    process.exit(1);
  }

  // 登录完成后额外等待页面稳定
  await randomDelay(2000, 3000);
  await saveCookies(context, cookiePath);
  console.log("\n✅ 登录成功，cookie 已保存");
}

// ─── 搜索帖子 ───
async function searchPosts(page, keyword, maxPosts, context, cookiePath) {
  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_note`;
  console.log(`🔍 搜索关键词: ${keyword}`);

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await randomDelay(3000, 5000);

  // 检查搜索页是否有登录弹窗（cookie 可能对 explore 有效但对搜索页失效）
  const hasModal = await page.evaluate(() => {
    return !!document.querySelector(".login-container, [class*='login-modal'], [class*='LoginModal']");
  });

  if (hasModal) {
    console.log("⚠️  搜索页检测到登录弹窗，等待用户扫码...");
    const maxWait = 5 * 60 * 1000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const loggedIn = await page.evaluate(() => {
        const hasLogin = !!document.querySelector(".login-container, [class*='login-modal'], [class*='LoginModal']");
        const hasCookieUser = document.cookie.includes("customer_id") || document.cookie.includes("access-token");
        return !hasLogin && hasCookieUser;
      });
      if (loggedIn) break;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r⏳ 已等待 ${elapsed}s，请在浏览器中完成登录...`);
    }
    console.log("\n✅ 登录完成");
    await saveCookies(context, cookiePath);
    await randomDelay(2000, 3000);
  }

  // 等待搜索结果加载
  try {
    await page.waitForSelector(
      '[class*="note-item"], [class*="search-result"] a, .feeds-page section',
      { timeout: 10000 }
    );
  } catch {
    console.warn("搜索结果加载超时，尝试继续...");
  }

  await randomDelay(1000, 2000);

  // 提取帖子列表（带去重）
  const posts = await page.evaluate((max) => {
    const items = [];
    const seenUrls = new Set();

    const selectors = [
      "section.note-item a.cover",
      'a[href*="/explore/"]',
      'a[href*="/search_result/"]',
      '[class*="note-item"] a',
      ".feeds-page section a",
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach((el) => {
          const href = el.href || el.closest("a")?.href;
          if (
            href &&
            href.includes("xiaohongshu.com") &&
            !seenUrls.has(href) &&
            items.length < max
          ) {
            seenUrls.add(href);
            const title =
              el.querySelector('[class*="title"]')?.innerText?.trim() ||
              el
                .closest("section")
                ?.querySelector('[class*="title"]')
                ?.innerText?.trim() ||
              "";
            const author =
              el
                .closest("section")
                ?.querySelector('[class*="author"], [class*="name"]')
                ?.innerText?.trim() || "";
            items.push({ url: href, title, author });
          }
        });
        if (items.length > 0) break;
      }
    }
    return items;
  }, maxPosts);

  console.log(`📋 找到 ${posts.length} 篇帖子`);
  return posts.slice(0, maxPosts);
}

// ─── 关闭弹窗覆盖层（通用） ───
async function dismissOverlays(page) {
  try {
    // 尝试关闭各种弹窗
    const overlaySelectors = [
      '[class*="close-button"]',
      '[class*="CloseBtn"]',
      '[class*="modal"] [class*="close"]',
      '.note-detail-mask',
    ];
    for (const sel of overlaySelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          await btn.click();
          await randomDelay(500, 1000);
        }
      }
    }
  } catch {}
}

// ─── 从 __INITIAL_STATE__ 提取帖子详情和评论 ───
// 参考 xiaohongshu-skills/scripts/xhs/feed_detail.py 的实现思路：
// 小红书前端将所有数据存储在 window.__INITIAL_STATE__.note.noteDetailMap 中，
// 滚动页面触发前端加载更多评论时，该 state 会同步更新。
// 比 DOM 抓取和 API 拦截都更可靠、更完整。

const EXTRACT_DETAIL_JS = `
(() => {
  try {
    const state = window.__INITIAL_STATE__;
    if (state && state.note && state.note.noteDetailMap) {
      return JSON.stringify(state.note.noteDetailMap);
    }
  } catch {}
  return "";
})()
`;

function parseStateComments(noteDetailMap, feedId) {
  // 找到对应 feedId 的数据，如果 feedId 未知则取第一个
  let noteData = noteDetailMap[feedId];
  if (!noteData) {
    const keys = Object.keys(noteDetailMap);
    if (keys.length > 0) noteData = noteDetailMap[keys[0]];
  }
  if (!noteData) return { note: null, comments: [] };

  // 提取帖子信息
  const rawNote = noteData.note || {};
  const note = {
    title: rawNote.title || "",
    desc: rawNote.desc || "",
    type: rawNote.type || "",
    ipLocation: rawNote.ipLocation || "",
    author: rawNote.user?.nickname || rawNote.user?.nickName || "",
    authorId: rawNote.user?.userId || "",
    commentCount: rawNote.interactInfo?.commentCount || "0",
    likedCount: rawNote.interactInfo?.likedCount || "0",
    collectedCount: rawNote.interactInfo?.collectedCount || "0",
  };

  // 提取评论列表
  const rawComments = noteData.comments?.list || [];
  const comments = [];

  for (const c of rawComments) {
    const userId = c.userInfo?.userId || "";
    comments.push({
      id: c.id || "",
      username: c.userInfo?.nickname || c.userInfo?.nickName || "",
      userId,
      avatar: c.userInfo?.avatar || "",
      content: c.content || "",
      likes: c.likeCount || "0",
      createTime: c.createTime || 0,
      ipLocation: c.ipLocation || "",
      profileUrl: userId
        ? `https://www.xiaohongshu.com/user/profile/${userId}`
        : "",
      subCommentCount: c.subCommentCount || "0",
      subComments: (c.subComments || []).map((sub) => {
        const subUserId = sub.userInfo?.userId || "";
        return {
          id: sub.id || "",
          username: sub.userInfo?.nickname || sub.userInfo?.nickName || "",
          userId: subUserId,
          content: sub.content || "",
          likes: sub.likeCount || "0",
          ipLocation: sub.ipLocation || "",
          profileUrl: subUserId
            ? `https://www.xiaohongshu.com/user/profile/${subUserId}`
            : "",
        };
      }),
    });
  }

  return { note, comments };
}

// ─── 提取单篇帖子评论（基于 __INITIAL_STATE__） ───
async function extractComments(page, postUrl, maxComments) {
  console.log(`  📖 打开帖子: ${postUrl}`);

  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await randomDelay(2000, 4000);

  // 从 URL 提取 feedId
  const feedIdMatch = postUrl.match(/\/([a-f0-9]{24})\b/);
  const feedId = feedIdMatch ? feedIdMatch[1] : "";

  // 等待 __INITIAL_STATE__ 可用
  try {
    await page.waitForFunction(
      () => window.__INITIAL_STATE__?.note?.noteDetailMap,
      { timeout: 10000 }
    );
  } catch {
    console.warn("  ⚠️ __INITIAL_STATE__ 加载超时");
  }

  // 等待评论区容器出现（参考 selectors.py: COMMENTS_CONTAINER = ".comments-container"）
  try {
    await page.waitForSelector(".comments-container", { timeout: 8000 });
  } catch {
    console.warn("  ⚠️ 评论区加载超时");
  }

  // 检查是否无评论（参考 selectors.py: NO_COMMENTS_TEXT）
  const noComments = await page.evaluate(() => {
    const el = document.querySelector(".no-comments-text");
    return el ? el.textContent.includes("这是一片荒地") : false;
  });

  if (noComments) {
    console.log("  ℹ️ 该帖子无评论");
    const result = await page.evaluate(EXTRACT_DETAIL_JS);
    const noteDetailMap = result ? JSON.parse(result) : {};
    const { note } = parseStateComments(noteDetailMap, feedId);
    return {
      title: note?.title || "",
      author: note?.author || "",
      commentCount: note?.commentCount || "0",
      comments: [],
      screenshotFile: "",
    };
  }

  // 滚动加载全部评论（参考 feed_detail.py 的状态机逻辑）
  // 先滚动到评论区（参考 selectors.py: COMMENTS_CONTAINER）
  await page.evaluate(() => {
    const container = document.querySelector(".comments-container");
    if (container) container.scrollIntoView({ behavior: "smooth" });
  });
  await randomDelay(500, 1000);

  const MAX_ATTEMPTS = maxComments > 0 ? maxComments * 3 : 150;
  const STAGNANT_LIMIT = 8;
  let lastCount = 0;
  let stagnantChecks = 0;
  let totalClicked = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 检查是否到达底部（参考 selectors.py: END_CONTAINER = ".end-container"）
    const isEnd = await page.evaluate(() => {
      const el = document.querySelector(".end-container");
      if (!el) return false;
      const text = el.textContent.trim().toUpperCase();
      return text.includes("THE END") || text.includes("THEEND");
    });

    if (isEnd) {
      const count = await page.evaluate(
        () => document.querySelectorAll(".parent-comment").length
      );
      console.log(`  ✅ 已到达评论底部 THE END，共 ${count} 条一级评论`);
      break;
    }

    // 定期点击"展开N条回复"按钮（参考 selectors.py: SHOW_MORE_BUTTON = ".show-more"）
    if (attempt % 3 === 0) {
      const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll(".show-more");
        let count = 0;
        btns.forEach((btn) => {
          // 跳过回复数 > 50 的按钮（避免展开太多导致卡顿）
          const text = btn.textContent || "";
          const match = text.match(/展开\s*(\d+)\s*条回复/);
          if (match && parseInt(match[1], 10) > 50) return;
          btn.click();
          count++;
        });
        return count;
      });
      if (clicked > 0) {
        totalClicked += clicked;
        await randomDelay(800, 1500);
      }
    }

    // 获取当前评论数（参考 selectors.py: PARENT_COMMENT = ".parent-comment"）
    const currentCount = await page.evaluate(
      () => document.querySelectorAll(".parent-comment").length
    );

    if (currentCount !== lastCount) {
      if (attempt % 5 === 0 || currentCount - lastCount > 5) {
        console.log(`  📊 评论加载中: ${currentCount} 条`);
      }
      lastCount = currentCount;
      stagnantChecks = 0;
    } else {
      stagnantChecks++;
    }

    // 检查是否达到目标
    if (maxComments > 0 && currentCount >= maxComments) {
      console.log(`  ✅ 已达目标评论数: ${currentCount}/${maxComments}`);
      break;
    }

    // 停滞过多 → 大冲刺滚动
    if (stagnantChecks >= STAGNANT_LIMIT) {
      console.log("  ⚡ 停滞过多，尝试大冲刺滚动...");
      for (let j = 0; j < 10; j++) {
        await page.mouse.wheel(0, 1000 + Math.random() * 500);
        await randomDelay(200, 400);
      }
      stagnantChecks = 0;
      await randomDelay(1000, 2000);
      continue;
    }

    // 滚动到最后一条评论（参考 feed_detail.py: _scroll_to_last_comment）
    if (currentCount > 0) {
      await page.evaluate(() => {
        const comments = document.querySelectorAll(".parent-comment");
        if (comments.length > 0) {
          comments[comments.length - 1].scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    // 人类化滚动
    const scrollDelta = 300 + Math.random() * 400;
    await page.mouse.wheel(0, scrollDelta);
    await randomDelay(800, 1500);
  }

  console.log(`  🔘 展开回复按钮点击: ${totalClicked} 次`);

  // 从 __INITIAL_STATE__ 一次性提取全部数据
  const stateResult = await page.evaluate(EXTRACT_DETAIL_JS);
  if (!stateResult) {
    console.warn("  ⚠️ 未获取到 __INITIAL_STATE__ 数据");
    return { title: "", author: "", commentCount: "0", comments: [], screenshotFile: "" };
  }

  const noteDetailMap = JSON.parse(stateResult);
  const { note, comments } = parseStateComments(noteDetailMap, feedId);

  // 展平: 主评论 + 子评论都作为独立条目（但保留层级标记）
  const flatComments = [];
  for (const c of comments) {
    flatComments.push({
      username: c.username,
      userId: c.userId,
      avatar: c.avatar,
      content: c.content,
      likes: c.likes,
      ipLocation: c.ipLocation,
      profileUrl: c.profileUrl,
      isSubComment: false,
      subCommentCount: c.subCommentCount,
    });
    for (const sub of c.subComments) {
      flatComments.push({
        username: sub.username,
        userId: sub.userId,
        avatar: "",
        content: sub.content,
        likes: sub.likes,
        ipLocation: sub.ipLocation,
        profileUrl: sub.profileUrl,
        isSubComment: true,
        subCommentCount: "0",
      });
    }
  }

  const totalCommentCount = note?.commentCount || "0";
  console.log(`  💬 提取到 ${comments.length} 条主评论 + ${flatComments.length - comments.length} 条子评论（帖子总评论数: ${totalCommentCount}）`);

  // 截取帖子全景截图
  let screenshotFile = "";
  try {
    const screenshotDir = path.join(__dirname, "..", "data", "screenshots");
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

    const noteId = feedId || Date.now().toString();
    screenshotFile = path.join(screenshotDir, `${noteId}.png`);

    await page.screenshot({ path: screenshotFile, fullPage: true });
    console.log(`  📸 帖子截图已保存: ${path.basename(screenshotFile)}`);
  } catch (e) {
    console.warn(`  ⚠️ 截图失败: ${e.message}`);
  }

  return {
    title: note?.title || "",
    author: note?.author || "",
    commentCount: totalCommentCount,
    comments: flatComments,
    screenshotFile,
  };
}

// ─── 主流程 ───
async function main() {
  const opts = parseArgs();
  console.log("🚀 小红书评论采集器启动");
  console.log(`   关键词: ${opts.keyword}`);
  console.log(`   最大帖子数: ${opts.maxPosts}`);
  console.log(`   每帖最大评论数: ${opts.maxComments}`);
  console.log(`   运行模式: ${opts.headless ? "无头" : "有头"}`);

  // 检查浏览器是否已安装
  await ensureBrowserInstalled();

  // 决定是否 headless: 有 cookie 且指定了 --headless 才用无头
  const hasCookieFile =
    fs.existsSync(opts.cookiePath) &&
    (() => {
      try {
        const c = JSON.parse(fs.readFileSync(opts.cookiePath, "utf-8"));
        return Array.isArray(c) && c.length > 0;
      } catch {
        return false;
      }
    })();

  const useHeadless = opts.headless && hasCookieFile;
  if (opts.headless && !hasCookieFile) {
    console.warn("⚠️  无 cookie 文件，忽略 --headless，将打开浏览器供登录");
  }

  const browser = await chromium.launch({
    headless: useHeadless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // 1. 加载 cookie + 检测登录态
    const hasCookies = await loadCookies(context, opts.cookiePath);
    const isLoggedIn = hasCookies && (await checkLogin(page));

    if (!isLoggedIn) {
      if (useHeadless) {
        // 无头模式下 cookie 失效 → 需要重新有头登录
        console.error("❌ Cookie 已失效，请去掉 --headless 重新登录");
        process.exit(1);
      }
      await manualLogin(page, context, opts.cookiePath);
    } else {
      console.log("✅ 已登录");
    }

    // 2. 搜索帖子
    const posts = await searchPosts(page, opts.keyword, opts.maxPosts, context, opts.cookiePath);

    if (posts.length === 0) {
      console.error("❌ 未找到任何帖子，请检查关键词或登录状态");
      process.exit(1);
    }

    // 3. 逐篇提取评论
    const result = {
      keyword: opts.keyword,
      scrapeTime: new Date().toISOString(),
      posts: [],
    };

    for (let i = 0; i < posts.length; i++) {
      console.log(`\n📌 [${i + 1}/${posts.length}] 处理帖子...`);
      try {
        await dismissOverlays(page);
        const postData = await extractComments(
          page,
          posts[i].url,
          opts.maxComments
        );
        result.posts.push({
          title: postData.title || posts[i].title,
          url: posts[i].url,
          author: postData.author || posts[i].author,
          commentCount: postData.commentCount || "0",
          comments: postData.comments,
          screenshotFile: postData.screenshotFile || "",
        });
      } catch (e) {
        console.error(`  ❌ 帖子处理失败: ${e.message}`);
      }

      // 帖子间间隔 5-10 秒
      if (i < posts.length - 1) {
        const wait = 5000 + Math.random() * 5000;
        console.log(`  ⏱️ 等待 ${(wait / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    // 4. 保存输出
    const outputDir = path.dirname(opts.output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");

    const totalComments = result.posts.reduce(
      (sum, p) => sum + p.comments.length,
      0
    );
    console.log(`\n✅ 采集完成!`);
    console.log(`   帖子: ${result.posts.length}`);
    console.log(`   评论: ${totalComments}`);
    console.log(`   输出: ${opts.output}`);

    // 保存最新 cookie
    await saveCookies(context, opts.cookiePath);
  } catch (e) {
    console.error("❌ 运行出错:", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
