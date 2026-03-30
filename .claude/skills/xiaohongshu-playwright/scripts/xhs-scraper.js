#!/usr/bin/env node

/**
 * 小红书评论采集脚本 - 基于 Playwright + 人类化行为模拟
 *
 * 用法:
 *   node xhs-scraper.js --keyword "护肤" --max-posts 5 --max-comments 20
 *   node xhs-scraper.js --keyword "医美" --speed slow     # 慢速模式，更安全
 *   node xhs-scraper.js --keyword "医美" --headed          # 有头模式（调试用）
 *
 * 输出: JSON 文件包含帖子及其评论数据
 */

// rebrowser-patches: 修复 CDP leak、navigator.webdriver 等反检测
try {
  require("rebrowser-patches/patch");
} catch {
  // rebrowser-patches 未安装时静默降级
}

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const {
  CONFIG,
  DELAYS,
  RATE_LIMIT_KEYWORDS,
  sleepRandom,
  navigationDelay,
  getScrollInterval,
  getScrollRatio,
  calculateScrollDelta,
  randomUserAgent,
  randomInt,
} = require("./human");

// ─── CLI 参数解析 ───
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    keyword: "",
    maxComments: 0, // 0 = 获取全部（硬上限 500）
    maxPosts: 10,
    headed: false, // 默认无头
    speed: "normal", // slow | normal | fast
    cookiePath: path.join(__dirname, "..", "data", "cookies.json"),
    output: "", // 默认为空，解析完 keyword 后自动生成
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
      case "--headed":
        opts.headed = true;
        break;
      case "--speed":
        opts.speed = args[++i] || "normal";
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

  // 默认输出路径按关键字分文件
  if (!opts.output) {
    opts.output = path.join(__dirname, "..", "data", `comments_${opts.keyword}.json`);
  }
  if (!["slow", "normal", "fast"].includes(opts.speed)) {
    console.warn(`未知速度 "${opts.speed}"，使用默认 normal`);
    opts.speed = "normal";
  }
  return opts;
}

// ─── 跨平台打开文件 ───
function openFile(filePath) {
  const { spawn } = require("child_process");
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", filePath], { stdio: "ignore" });
    } else if (process.platform === "darwin") {
      spawn("open", [filePath], { stdio: "ignore" });
    } else {
      spawn("xdg-open", [filePath], { stdio: "ignore" });
    }
  } catch {
    // 静默失败，文件路径已打印到终端供用户手动打开
  }
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
  }
}

// ─── 反检测初始化脚本 ───
const ANTI_DETECT_SCRIPT = `
(() => {
  // 隐藏 webdriver 标志（rebrowser-patches 可能已处理，这里兜底）
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch {}

  // 伪装 plugins（真实浏览器有多个插件）
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ];
        plugins.length = 3;
        return plugins;
      },
    });
  } catch {}

  // 伪装 languages
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en-US', 'en'],
    });
  } catch {}

  // 伪装 platform
  try {
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel',
    });
  } catch {}

  // 伪装 hardwareConcurrency
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
  } catch {}

  // 伪装 deviceMemory
  try {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
  } catch {}

  // 隐藏 Automation 相关属性
  try {
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  } catch {}

  // 修复 chrome.runtime（Playwright 缺失）
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: () => {},
      sendMessage: () => {},
    };
  }

  // 修复 Permissions API（避免返回 "denied" 暴露自动化）
  try {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  } catch {}
})();
`;

// ─── Cookie 管理 ───
async function loadCookies(context, cookiePath) {
  if (fs.existsSync(cookiePath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      if (Array.isArray(cookies) && cookies.length > 0) {
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
    await sleepRandom(...DELAYS.READ_TIME);

    const isLoggedIn = await page.evaluate(() => {
      const hasCookieUser = document.cookie.includes("customer_id") ||
                            document.cookie.includes("access-token");
      const hasLoginModal = !!document.querySelector(
        ".login-container, [class*='login-modal'], [class*='LoginModal']"
      );
      const hasUserEl = !!document.querySelector(
        "[class*='user-avatar'], .reds-avatar, [class*='sidebar-user']"
      );
      let hasStateUser = false;
      try {
        const state = window.__INITIAL_STATE__;
        if (state && state.user && state.user.userInfo && state.user.userInfo.userId) {
          hasStateUser = true;
        }
      } catch {}

      if (hasLoginModal) return false;
      return hasCookieUser || hasStateUser || hasUserEl;
    });

    return isLoggedIn;
  } catch (e) {
    console.warn("登录检测异常:", e.message);
    return false;
  }
}

// ─── 手动登录流程（有头=浏览器内手动登录；无头=提取 QR 到本地展示） ───
async function manualLogin(page, context, cookiePath, opts = {}) {
  console.log("\n⚠️  需要登录小红书");

  await page.goto("https://www.xiaohongshu.com/explore", {
    waitUntil: "domcontentloaded",
  });
  await navigationDelay();

  const headedMode = !!opts.headed;
  let qrExtracted = false;

  if (headedMode) {
    console.log("📱 当前为打开浏览器运行：请直接在浏览器窗口中完成登录（扫码或手机号）");
    console.log("⏳ 登录完成后脚本会自动继续...\n");
  } else {
    try {
      await page.waitForSelector(".qrcode-img", { timeout: 15000 });
      const qrSrc = await page.evaluate(() => {
        const img = document.querySelector(".qrcode-img");
        return img?.src || "";
      });

      if (qrSrc && qrSrc.includes("base64,")) {
        const base64Data = qrSrc.split("base64,")[1];
        const qrDir = path.join(__dirname, "..", "data");
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
        const qrPath = path.join(qrDir, "login_qrcode.png");
        fs.writeFileSync(qrPath, Buffer.from(base64Data, "base64"));

        console.log(`📱 QR 码已保存: ${qrPath}`);
        console.log("⏳ 当前为后台静默运行，请用小红书 APP 扫描二维码登录...\n");
        openFile(qrPath);
        qrExtracted = true;
      }
    } catch {
      console.warn("⚠️  QR 码提取失败，请改用打开浏览器运行，或检查页面登录弹层");
    }

    if (!qrExtracted) {
      console.log("📱 后台静默运行未能成功提取二维码");
      console.log("⏳ 如需继续，建议切换为打开浏览器运行后重试...\n");
    }
  }

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
      return !hasLoginModal && (hasCookieUser || hasUserEl);
    });

    if (loggedIn) break;

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ 已等待 ${elapsed}s，请扫码登录...`);
  }

  if (Date.now() - startTime >= maxWait) {
    console.error("\n❌ 登录超时（5分钟），请重新运行脚本");
    process.exit(1);
  }

  await navigationDelay();
  await saveCookies(context, cookiePath);
  console.log("\n✅ 登录成功，cookie 已保存");
}

// ─── 搜索帖子 ───
async function searchPosts(page, keyword, maxPosts, context, cookiePath) {
  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_note`;
  console.log(`🔍 搜索关键词: ${keyword}`);

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await navigationDelay();
  await sleepRandom(...DELAYS.READ_TIME);

  // 检查搜索页是否有登录弹窗
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
    await navigationDelay();
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

  await sleepRandom(...DELAYS.HUMAN_DELAY);

  // 提取帖子列表（带去重，加载 2x 候选以支持混合选取）
  const candidateLimit = maxPosts * 2;
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
  }, candidateLimit);

  console.log(`📋 找到 ${posts.length} 篇候选帖子`);

  // 50/50 混合选取策略：前半顺序 + 后半随机
  const halfN = Math.ceil(maxPosts / 2);
  const sequential = posts.slice(0, halfN);
  const remaining = posts.slice(halfN);
  // Fisher-Yates shuffle
  for (let j = remaining.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
  }
  const selected = [...sequential, ...remaining].slice(0, maxPosts);
  console.log(`📋 选取 ${selected.length} 篇帖子（前 ${Math.min(halfN, selected.length)} 顺序 + 后 ${Math.max(0, selected.length - halfN)} 随机）`);
  return selected;
}

// ─── 关闭弹窗覆盖层（通用） ───
async function dismissOverlays(page) {
  try {
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
          await sleepRandom(...DELAYS.REACTION_TIME);
        }
      }
    }
  } catch {}
}

// ─── 从 __INITIAL_STATE__ 提取帖子详情和评论 ───
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
  let noteData = noteDetailMap[feedId];
  if (!noteData) {
    const keys = Object.keys(noteDetailMap);
    if (keys.length > 0) noteData = noteDetailMap[keys[0]];
  }
  if (!noteData) return { note: null, comments: [] };

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

// ─── 人类化滚动（对应 Python feed_detail.py: _human_scroll） ───
async function humanScroll(page, speed, largeMode, pushCount) {
  const beforeTop = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  let baseRatio = getScrollRatio(speed);
  if (largeMode) {
    baseRatio *= 2.0;
  }

  let actualDelta = 0;
  let currentScrollTop = beforeTop;
  let prevTop = beforeTop;

  for (let i = 0; i < Math.max(1, pushCount); i++) {
    const scrollDelta = calculateScrollDelta(viewportHeight, baseRatio);

    // 使用 window.scrollBy 替代 page.mouse.wheel（更接近真实用户行为）
    await page.evaluate((delta) => {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }, Math.round(scrollDelta));

    await sleepRandom(...DELAYS.SCROLL_WAIT);

    currentScrollTop = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    const deltaThis = currentScrollTop - prevTop;
    actualDelta += deltaThis;
    prevTop = currentScrollTop;

    if (i < pushCount - 1) {
      await sleepRandom(...DELAYS.HUMAN_DELAY);
    }
  }

  // 如果没有滚动，强制到底部
  if (actualDelta < CONFIG.MIN_SCROLL_DELTA && pushCount > 0) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleepRandom(...DELAYS.POST_SCROLL);
    currentScrollTop = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
    actualDelta = currentScrollTop - beforeTop;
  }

  return { actualDelta, currentScrollTop };
}

// ─── 滚动到评论区（对应 Python feed_detail.py: _scroll_to_comments_area） ───
async function scrollToCommentsArea(page) {
  console.log("  📜 滚动到评论区...");
  await page.evaluate(() => {
    const container = document.querySelector(".comments-container");
    if (container) container.scrollIntoView({ behavior: "smooth" });
  });
  await sleepRandom(500, 1000);

  // 触发 wheel 事件以激活懒加载（参考 Python dispatch_wheel_event）
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
    }));
  });
}

// ─── 滚动到最后一条评论（对应 Python feed_detail.py: _scroll_to_last_comment） ───
async function scrollToLastComment(page) {
  await page.evaluate(() => {
    const comments = document.querySelectorAll(".parent-comment");
    if (comments.length > 0) {
      comments[comments.length - 1].scrollIntoView({ behavior: "smooth" });
    }
  });
}

// ─── 点击展开回复按钮（对应 Python feed_detail.py: _click_show_more_buttons） ───
async function clickShowMoreButtons(page, maxRepliesThreshold = 50) {
  const result = await page.evaluate((threshold) => {
    const btns = document.querySelectorAll(".show-more");
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
  }, maxRepliesThreshold);
  return result;
}

// ─── 检查评论数 ───
async function getCommentCount(page) {
  return page.evaluate(() => document.querySelectorAll(".parent-comment").length);
}

// ─── 检查是否到达底部 ───
async function checkEndContainer(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".end-container");
    if (!el) return false;
    const text = el.textContent.trim().toUpperCase();
    return text.includes("THE END") || text.includes("THEEND");
  });
}

// ─── 加载已有采集数据（帖子级去重） ───
function loadExistingData(outputPath, keyword) {
  if (!fs.existsSync(outputPath)) {
    return { existingPosts: [], collectedUrls: new Set() };
  }
  try {
    const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    // 只匹配同关键词的数据
    if (data.keyword !== keyword) {
      console.log(`📂 已有数据关键词不匹配（"${data.keyword}" vs "${keyword}"），不去重`);
      return { existingPosts: [], collectedUrls: new Set() };
    }
    const existingPosts = data.posts || [];
    const collectedUrls = new Set(existingPosts.map((p) => p.url));
    console.log(`📂 已有 ${existingPosts.length} 篇帖子数据，将跳过已采集帖子`);
    return { existingPosts, collectedUrls };
  } catch (e) {
    console.warn("读取已有数据失败:", e.message);
    return { existingPosts: [], collectedUrls: new Set() };
  }
}

// ─── 评论加载状态机（对应 Python feed_detail.py: _load_all_comments） ───
async function loadAllComments(page, maxComments, speed) {
  // 硬上限 500，防止极端情况
  const effectiveMax = maxComments > 0
    ? Math.min(maxComments, CONFIG.MAX_COMMENTS_HARD_LIMIT)
    : CONFIG.MAX_COMMENTS_HARD_LIMIT;
  const maxAttempts = effectiveMax * 3;
  const scrollInterval = getScrollInterval(speed);

  console.log("  📜 开始加载评论...");
  await scrollToCommentsArea(page);
  await sleepRandom(...DELAYS.HUMAN_DELAY);

  // 检查是否无评论
  const noComments = await page.evaluate(() => {
    const el = document.querySelector(".no-comments-text");
    return el ? el.textContent.includes("这是一片荒地") : false;
  });
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
    // 检查是否到达底部
    if (await checkEndContainer(page)) {
      const count = await getCommentCount(page);
      console.log(`  ✅ 检测到 THE END，加载完成: ${count} 条评论, 点击: ${totalClicked}, 跳过: ${totalSkipped}`);
      return { hasComments: true };
    }

    // 定期点击展开按钮（每 BUTTON_CLICK_INTERVAL 轮）
    if (attempt % CONFIG.BUTTON_CLICK_INTERVAL === 0) {
      const { clicked, skipped } = await clickShowMoreButtons(page);
      totalClicked += clicked;
      totalSkipped += skipped;
      if (clicked > 0 || skipped > 0) {
        await sleepRandom(...DELAYS.READ_TIME);
        // 第二轮点击（参考 Python 实现）
        const r2 = await clickShowMoreButtons(page);
        totalClicked += r2.clicked;
        totalSkipped += r2.skipped;
        if (r2.clicked > 0 || r2.skipped > 0) {
          await sleepRandom(...DELAYS.SHORT_READ);
        }
      }
    }

    // 获取当前评论数
    const currentCount = await getCommentCount(page);
    if (currentCount !== lastCount) {
      if (attempt % 5 === 0 || currentCount - lastCount > 5) {
        console.log(`  📊 评论增加: ${lastCount} -> ${currentCount}`);
      }
      lastCount = currentCount;
      stagnantChecks = 0;
    } else {
      stagnantChecks++;
    }

    // 检查是否达到目标（含硬上限）
    if (currentCount >= effectiveMax) {
      console.log(`  ✅ 已达到目标评论数: ${currentCount}/${effectiveMax}`);
      return { hasComments: true };
    }

    // 滚动到最后一条评论
    if (currentCount > 0) {
      await scrollToLastComment(page);
      await sleepRandom(...DELAYS.POST_SCROLL);
    }

    // 计算 pushCount（参考 Python: large_mode 时 3+random(0,2)）
    const largeMode = stagnantChecks >= CONFIG.LARGE_SCROLL_TRIGGER;
    let pushCount = 1;
    if (largeMode) {
      pushCount = 3 + randomInt(0, 2);
    }

    const { actualDelta, currentScrollTop } = await humanScroll(page, speed, largeMode, pushCount);

    if (actualDelta < CONFIG.MIN_SCROLL_DELTA || currentScrollTop === lastScrollTop) {
      stagnantChecks++;
    } else {
      stagnantChecks = 0;
      lastScrollTop = currentScrollTop;
    }

    // 停滞处理（参考 Python: STAGNANT_LIMIT 后大冲刺）
    if (stagnantChecks >= CONFIG.STAGNANT_LIMIT) {
      console.log("  ⚡ 停滞过多，尝试大冲刺...");
      await humanScroll(page, speed, true, 10);
      stagnantChecks = 0;
    }

    // 滚动间隔
    await new Promise((r) => setTimeout(r, scrollInterval));
  }

  // 最终冲刺
  console.log("  🏃 达到最大尝试次数，最后冲刺...");
  await humanScroll(page, speed, true, CONFIG.FINAL_SPRINT_PUSH_COUNT);
  const count = await getCommentCount(page);
  console.log(`  📊 加载结束: ${count} 条评论, 点击: ${totalClicked}, 跳过: ${totalSkipped}`);
  return { hasComments: count > 0 };
}

// ─── 检测页面是否命中频率限制（300013） ───
async function checkRateLimit(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText || '');
    return RATE_LIMIT_KEYWORDS.some((kw) => text.includes(kw));
  } catch {
    return false;
  }
}

// ─── 提取单篇帖子评论（基于 __INITIAL_STATE__） ───
async function extractComments(page, postUrl, maxComments, speed) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`  📖 打开帖子${attempt > 1 ? `（第 ${attempt} 次尝试）` : ''}: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await navigationDelay();
    await sleepRandom(...DELAYS.HUMAN_DELAY);

    // 检测频率限制
    if (await checkRateLimit(page)) {
      if (attempt < MAX_RETRIES) {
        const waitMs = DELAYS.RATE_LIMIT_WAIT[0] + Math.random() * (DELAYS.RATE_LIMIT_WAIT[1] - DELAYS.RATE_LIMIT_WAIT[0]);
        console.warn(`  ⚠️ 触发频率限制（300013），等待 ${Math.round(waitMs / 1000)}s 后重试...`);
        await sleepRandom(...DELAYS.RATE_LIMIT_WAIT);
        continue;
      }
      console.error(`  ❌ 连续 ${MAX_RETRIES} 次触发频率限制，跳过此帖`);
      return { title: "", author: "", commentCount: "0", comments: [], screenshotFile: "" };
    }
    // 限流检测通过，跳出重试循环进入正常提取流程
    break;
  }

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

  // 等待评论区容器出现
  try {
    await page.waitForSelector(".comments-container", { timeout: 8000 });
  } catch {
    console.warn("  ⚠️ 评论区加载超时");
  }

  // 使用状态机加载评论
  const { hasComments } = await loadAllComments(page, maxComments, speed);

  if (!hasComments) {
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

  // 从 __INITIAL_STATE__ 一次性提取全部数据
  const stateResult = await page.evaluate(EXTRACT_DETAIL_JS);
  if (!stateResult) {
    console.warn("  ⚠️ 未获取到 __INITIAL_STATE__ 数据");
    return { title: "", author: "", commentCount: "0", comments: [], screenshotFile: "" };
  }

  const noteDetailMap = JSON.parse(stateResult);
  const { note, comments } = parseStateComments(noteDetailMap, feedId);

  // 展平: 主评论 + 子评论都作为独立条目
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



function sanitizeKeywordForFilename(keyword) {
  return String(keyword || 'keyword').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'keyword';
}

function detectInterest(content) {
  const text = String(content || '').trim();
  if (!text) return null;

  const patterns = [
    { re: /多少钱|价格|费用|贵不贵|预算|怎么收费|什么价|求[个]?价/, tags: ['购买意向', '咨询'], score: 8, reason: '明确询问价格或费用，消费意向较强' },
    { re: /适合我吗|适不适合|我.*适合|我这种.*[能行]/, tags: ['咨询', '需求判断'], score: 8, reason: '在判断自身适合性，具备现实需求' },
    { re: /在哪[买做弄]|哪里[买做弄]|哪家好|去哪[买做]|求推荐|有.{0,2}推荐|求链接|有链接/, tags: ['购买意向', '渠道咨询'], score: 8, reason: '明确咨询购买渠道或服务方，转化可能较高' },
    { re: /想[做买]|准备[做买]|想入手|想试试|打算[做买]|种草了|被种草|心动了|怎么买/, tags: ['购买意向'], score: 7, reason: '表达了较明确的尝试或消费计划' },
    { re: /效果怎么样|好不好用|值不值|有用吗|质量怎么样|靠谱吗|维持多久|有没有坑/, tags: ['深度讨论', '咨询'], score: 7, reason: '围绕效果或体验做决策前咨询，兴趣较高' },
    { re: /我[买用做]过|我之前[买用做]|我去年[买用做]|亲身经历|入手了|已[购入买]/, tags: ['深度讨论', '经验用户'], score: 6, reason: '有真实使用或消费经历，长期关注相关话题' },
  ];

  for (const p of patterns) {
    if (p.re.test(text)) {
      return {
        interestTags: p.tags.join(', '),
        interestScore: p.score,
        reason: p.reason,
      };
    }
  }
  return null;
}

function isRelevantPost(post, keyword) {
  if (!keyword) return true;
  const title = String(post.title || '');
  if (title.includes(keyword)) return true;
  const sample = (post.comments || []).slice(0, 10).map((c) => c.content || '').join(' ');
  return sample.includes(keyword);
}

function buildAnalysis(result, keyword) {
  const posts = [];
  for (const post of result.posts || []) {
    if (!isRelevantPost(post, keyword)) continue;

    const users = new Map();
    for (const c of post.comments || []) {
      const hit = detectInterest(c.content);
      if (!hit) continue;
      const username = c.username || c.userName || '未知用户';
      const userId = c.userId || '';
      const key = `${username}::${userId}`;
      if (!users.has(key)) {
        users.set(key, {
          username,
          userId,
          ipLocation: c.ipLocation || '',
          profileUrl: c.profileUrl || (userId ? `https://www.xiaohongshu.com/user/profile/${userId}` : ''),
          comments: [],
          scores: [],
          tags: new Set(),
          reasons: [],
        });
      }
      const user = users.get(key);
      user.comments.push(String(c.content || '').trim());
      user.scores.push(hit.interestScore);
      hit.interestTags.split(/[,，]/).map((x) => x.trim()).filter(Boolean).forEach((t) => user.tags.add(t));
      user.reasons.push(hit.reason);
    }

    const validComments = [...users.values()].map((u) => ({
      username: u.username,
      userId: u.userId,
      content: u.comments.map((text, i) => `${i + 1}.${text}`).join(' '),
      ipLocation: u.ipLocation,
      interestTags: [...u.tags].join(', '),
      interestScore: Math.max(...u.scores),
      reason: [...new Set(u.reasons)].join('；').slice(0, 120),
      profileUrl: u.profileUrl,
    })).filter((u) => u.interestScore >= 6).sort((a, b) => b.interestScore - a.interestScore);

    if (validComments.length) {
      posts.push({
        title: post.title || '',
        url: post.url || '',
        screenshotFile: post.screenshotFile || '',
        totalComments: post.commentCount || (post.comments || []).length,
        collectedComments: (post.comments || []).length,
        validComments,
      });
    }
  }
  return { keyword, posts };
}

function runNodeScript(scriptPath, args = []) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`脚本执行失败: ${path.basename(scriptPath)} (exit ${result.status})`);
  }
}

function runPostPipeline(opts, result) {
  const skillDir = path.join(__dirname, '..');
  const safeKeyword = sanitizeKeywordForFilename(opts.keyword);
  const filteredPath = path.join(skillDir, 'data', `filtered_${safeKeyword}.json`);
  const analysisPath = path.join(skillDir, 'data', `analysis_${safeKeyword}.json`);
  const filterScript = path.join(__dirname, 'filter-comments.js');
  const excelScript = path.join(__dirname, 'generate-excel.js');

  console.log('\n🔁 开始自动执行后处理流程...');
  runNodeScript(filterScript, ['--input', opts.output, '--output', filteredPath]);

  const analysis = buildAnalysis(result, opts.keyword);
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8');
  const prospectCount = analysis.posts.reduce((sum, p) => sum + (p.validComments || []).length, 0);
  console.log(`✅ 分析文件已生成: ${analysisPath}`);
  console.log(`   相关帖子: ${analysis.posts.length}`);
  console.log(`   潜客数量: ${prospectCount}`);

  runNodeScript(excelScript, ['--input', analysisPath]);
}

// ─── 主流程 ───
async function main() {
  const opts = parseArgs();
  console.log("🚀 小红书评论采集器启动（人类化模式）");
  console.log(`   关键词: ${opts.keyword}`);
  console.log(`   最大帖子数: ${opts.maxPosts}`);
  console.log(`   每帖最大评论数: ${opts.maxComments === 0 ? "全部（硬上限 500）" : opts.maxComments}`);
  console.log(`   运行模式: ${opts.headed ? "有头" : "无头"}`);
  console.log(`   滚动速度: ${opts.speed}`);

  await ensureBrowserInstalled();

  const browser = await chromium.launch({
    headless: !opts.headed,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });

  // viewport 随机偏移，避免指纹固定
  const context = await browser.newContext({
    viewport: {
      width: 1280 + randomInt(-20, 20),
      height: 800 + randomInt(-20, 20),
    },
    userAgent: randomUserAgent(),
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });

  const page = await context.newPage();

  // 注入反检测脚本
  await page.addInitScript(ANTI_DETECT_SCRIPT);

  try {
    // 1. 加载 cookie + 检测登录态
    const hasCookies = await loadCookies(context, opts.cookiePath);
    const isLoggedIn = hasCookies && (await checkLogin(page));

    if (!isLoggedIn) {
      await manualLogin(page, context, opts.cookiePath, opts);
    } else {
      console.log("✅ 已登录");
    }

    // 2. 加载已有数据（帖子级去重）
    const { existingPosts, collectedUrls } = loadExistingData(opts.output, opts.keyword);

    // 3. 搜索帖子
    const allPosts = await searchPosts(page, opts.keyword, opts.maxPosts, context, opts.cookiePath);

    // 过滤已采集的帖子
    const posts = allPosts.filter((p) => !collectedUrls.has(p.url));
    if (collectedUrls.size > 0 && allPosts.length !== posts.length) {
      console.log(`🔄 跳过 ${allPosts.length - posts.length} 篇已采集帖子，剩余 ${posts.length} 篇新帖子`);
    }

    if (posts.length === 0 && existingPosts.length === 0) {
      console.error("❌ 未找到任何帖子，请检查关键词或登录状态");
      process.exit(1);
    }

    if (posts.length === 0) {
      console.log("ℹ️ 所有搜索结果已采集过，无需重复采集");
    }

    // 4. 逐篇提取评论
    const newPosts = [];

    for (let i = 0; i < posts.length; i++) {
      console.log(`\n📌 [${i + 1}/${posts.length}] 处理帖子...`);
      try {
        await dismissOverlays(page);
        const postData = await extractComments(
          page,
          posts[i].url,
          opts.maxComments,
          opts.speed
        );
        newPosts.push({
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

      // 帖子间间隔：5-10s 基础间隔 + 1-2.5s 模拟阅读，防止频率限制
      if (i < posts.length - 1) {
        await sleepRandom(...DELAYS.POST_GAP);
        await navigationDelay();
        const waitSec = Math.round((DELAYS.POST_GAP[0] + DELAYS.POST_GAP[1]) / 2000);
        console.log(`  ⏱️ 帖子间等待 ~${waitSec}s 完成`);
      }
    }

    // 5. 合并已有数据 + 新数据，保存输出
    const mergedPosts = [...existingPosts, ...newPosts];
    const result = {
      keyword: opts.keyword,
      scrapeTime: new Date().toISOString(),
      posts: mergedPosts,
    };

    const outputDir = path.dirname(opts.output);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");

    const totalComments = mergedPosts.reduce(
      (sum, p) => sum + p.comments.length,
      0
    );
    console.log(`\n✅ 采集完成!`);
    console.log(`   新采集帖子: ${newPosts.length}`);
    console.log(`   已有帖子: ${existingPosts.length}`);
    console.log(`   合计帖子: ${mergedPosts.length}`);
    console.log(`   合计评论: ${totalComments}`);
    console.log(`   输出: ${opts.output}`);

    runPostPipeline(opts, result);

    await saveCookies(context, opts.cookiePath);
  } catch (e) {
    console.error("❌ 运行出错:", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
