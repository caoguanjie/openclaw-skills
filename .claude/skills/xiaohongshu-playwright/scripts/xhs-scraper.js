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

async function humanScroll(page, distance = 300) {
  await page.mouse.wheel(0, distance + Math.random() * 200);
  await randomDelay(500, 1500);
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
async function searchPosts(page, keyword, maxPosts) {
  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_note`;
  console.log(`🔍 搜索关键词: ${keyword}`);

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await randomDelay(2000, 4000);

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

// ─── 提取单篇帖子评论（兼容弹窗和全页模式） ───
async function extractComments(page, postUrl, maxComments) {
  console.log(`  📖 打开帖子: ${postUrl}`);

  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await randomDelay(2000, 4000);

  // 检测页面模式：弹窗 or 全页
  const isPopupMode = await page.evaluate(() => {
    return !!document.querySelector(
      '[class*="note-detail-modal"], [class*="NoteDetailModal"], .note-detail-mask'
    );
  });

  if (isPopupMode) {
    console.log("  📋 检测到弹窗模式");
  }

  // 评论区容器选择器（兼容两种模式）
  const commentContainerSelectors = isPopupMode
    ? '[class*="note-detail-modal"] [class*="comment"], [class*="NoteDetailModal"] [class*="comment"]'
    : '[class*="comment"], [class*="Comment"], .note-comment';

  // 等待评论区加载
  try {
    await page.waitForSelector(commentContainerSelectors, { timeout: 8000 });
  } catch {
    console.warn("  ⚠️ 评论区加载超时");
  }

  // 滚动加载更多评论
  // 弹窗模式下需要在弹窗内部滚动，全页模式滚动整个页面
  let prevCount = 0;
  for (let i = 0; i < 5; i++) {
    if (isPopupMode) {
      // 弹窗模式：尝试在弹窗内滚动
      await page.evaluate(() => {
        const modal = document.querySelector(
          '[class*="note-detail-modal"], [class*="NoteDetailModal"], [class*="note-scroller"]'
        );
        if (modal) modal.scrollTop += 500;
      });
      await randomDelay(1000, 2000);
    } else {
      await humanScroll(page, 500);
      await randomDelay(1000, 2000);
    }

    // 点击"查看更多评论"
    const moreBtn = await page.$(
      '[class*="show-more"], [class*="expand"], button:has-text("查看更多"), button:has-text("展开")'
    );
    if (moreBtn) {
      try {
        await moreBtn.click();
        await randomDelay(1000, 2000);
      } catch {}
    }

    const count = await page.evaluate(() =>
      document.querySelectorAll(
        '[class*="comment-item"], [class*="CommentItem"], .comment-inner'
      ).length
    );
    if (count >= maxComments || count === prevCount) break;
    prevCount = count;
  }

  // 提取评论数据
  const comments = await page.evaluate((max) => {
    const results = [];
    const commentEls = document.querySelectorAll(
      '[class*="comment-item"], [class*="CommentItem"], .comment-inner'
    );

    commentEls.forEach((el) => {
      if (results.length >= max) return;

      const username =
        el
          .querySelector(
            '[class*="user-name"], [class*="nickname"], [class*="author-name"]'
          )
          ?.innerText?.trim() || "";
      const content =
        el
          .querySelector(
            '[class*="content"], [class*="text"], [class*="note-text"]'
          )
          ?.innerText?.trim() || "";
      const likesText =
        el
          .querySelector('[class*="like"], [class*="count"]')
          ?.innerText?.trim() || "0";
      const likes = parseInt(likesText.replace(/[^\d]/g, ""), 10) || 0;

      // 提取用户链接和 userId
      const userLink =
        el.querySelector('a[href*="/user/profile/"]')?.href || "";
      const userIdMatch = userLink.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
      const userId = userIdMatch ? userIdMatch[1] : "";

      // 提取头像
      const avatar =
        el.querySelector('[class*="avatar"] img, img[class*="avatar"]')?.src ||
        "";

      if (username && content) {
        results.push({
          username,
          userId,
          avatar,
          content,
          likes,
          profileUrl: userId
            ? `https://www.xiaohongshu.com/user/profile/${userId}`
            : "",
        });
      }
    });
    return results;
  }, maxComments);

  // 提取帖子标题和作者
  const postInfo = await page.evaluate(() => {
    const title =
      document
        .querySelector(
          '[class*="note-title"], #detail-title, [class*="title"]'
        )
        ?.innerText?.trim() || "";
    const author =
      document
        .querySelector(
          '[class*="author-name"], [class*="username"], .author-wrapper [class*="name"]'
        )
        ?.innerText?.trim() || "";
    return { title, author };
  });

  console.log(`  💬 提取到 ${comments.length} 条评论`);
  return { ...postInfo, comments };
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
    const posts = await searchPosts(page, opts.keyword, opts.maxPosts);

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
          comments: postData.comments,
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
