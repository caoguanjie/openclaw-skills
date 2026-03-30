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
  shouldBacktrackScroll,
  calculateBacktrackDelta,
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
    taskSpecPath: "",
    postProcessOnly: false,
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
      case "--task-spec":
        opts.taskSpecPath = args[++i] || "";
        break;
      case "--post-process-only":
        opts.postProcessOnly = true;
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

const SEARCH_RESULT_CARD_SELECTOR =
  'section.note-item, [class*="note-item"], .feeds-page section';
const SEARCH_RESULT_LINK_SELECTORS = [
  'section.note-item a.cover',
  'section.note-item a[href*="/search_result/"]',
  'section.note-item a[href*="/explore/"]',
  '[class*="note-item"] a[href*="/search_result/"]',
  '[class*="note-item"] a[href*="/explore/"]',
  '.feeds-page section a[href*="/search_result/"]',
];
const LOGIN_MODAL_SELECTOR =
  ".login-container, [class*='login-modal'], [class*='LoginModal']";
const DETAIL_MODAL_SELECTORS = [
  '[class*="note-detail-modal"]',
  '[class*="NoteDetailModal"]',
  '.note-detail-mask',
];
const DETAIL_CLOSE_SELECTORS = [
  '[class*="note-detail-modal"] [class*="close"]',
  '[class*="NoteDetailModal"] [class*="close"]',
  '[class*="close-circle"]',
  '[class*="close-button"]',
  '[class*="CloseBtn"]',
];
const DETAIL_SCROLL_SELECTORS = [
  '.note-scroller',
  '[class*="note-scroller"]',
  '[class*="NoteScroller"]',
];

function extractNoteId(value) {
  const text = String(value || "");
  const match = text.match(/\/([a-f0-9]{24})\b/i);
  return match ? match[1] : "";
}

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

async function hasSearchLoginModal(page) {
  try {
    return await page.evaluate((selector) => !!document.querySelector(selector), LOGIN_MODAL_SELECTOR);
  } catch {
    return false;
  }
}

async function waitForSearchLogin(page, context, cookiePath) {
  if (!(await hasSearchLoginModal(page))) {
    return false;
  }

  console.log("⚠️  搜索页检测到登录弹窗，等待用户扫码...");
  const maxWait = 5 * 60 * 1000;
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const state = await page.evaluate((selector, resultSelector) => {
      const hasLogin = !!document.querySelector(selector);
      const cards = document.querySelectorAll(resultSelector).length;
      return {
        hasLogin,
        cards,
        hasCookieUser:
          document.cookie.includes("customer_id") ||
          document.cookie.includes("access-token"),
      };
    }, LOGIN_MODAL_SELECTOR, SEARCH_RESULT_CARD_SELECTOR);
    if (!state.hasLogin && (state.cards > 0 || state.hasCookieUser)) {
      console.log("\n✅ 登录完成");
      await saveCookies(context, cookiePath);
      await navigationDelay();
      return true;
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ 已等待 ${elapsed}s，请在浏览器中完成登录...`);
  }

  console.error("\n❌ 搜索页登录超时（5分钟）");
  process.exit(1);
}

async function waitForSearchResults(page) {
  try {
    await page.waitForSelector(SEARCH_RESULT_CARD_SELECTOR, { timeout: 10000 });
  } catch {
    console.warn("搜索结果加载超时，尝试继续...");
  }
}

async function ensureSearchPage(page, searchUrl, context, cookiePath) {
  if (!page.url().includes("search_result")) {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await navigationDelay();
  }
  await waitForSearchLogin(page, context, cookiePath);
  await waitForSearchResults(page);
  await sleepRandom(...DELAYS.HUMAN_DELAY);
}

// ─── 搜索帖子 ───
async function searchPosts(page, keyword, maxPosts, context, cookiePath) {
  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_search_result_note`;
  console.log(`🔍 搜索关键词: ${keyword}`);

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await navigationDelay();
  await sleepRandom(...DELAYS.READ_TIME);
  await waitForSearchLogin(page, context, cookiePath);
  await waitForSearchResults(page);
  await sleepRandom(...DELAYS.HUMAN_DELAY);

  const candidateLimit = maxPosts * 2;
  const posts = await page.evaluate(
    ({ max, selectors }) => {
      const items = [];
      const seenUrls = new Set();
      const extractNoteId = (value) => {
        const match = String(value || "").match(/\/([a-f0-9]{24})\b/i);
        return match ? match[1] : "";
      };

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length === 0) continue;

        els.forEach((el) => {
          const href = el.href || el.closest("a")?.href;
          if (!href || items.length >= max) return;

          const absoluteUrl = new URL(href, location.origin).toString();
          if (!absoluteUrl.includes("xiaohongshu.com") || seenUrls.has(absoluteUrl)) {
            return;
          }

          const noteId = extractNoteId(absoluteUrl);
          if (!noteId) return;

          seenUrls.add(absoluteUrl);
          const title =
            el.querySelector('[class*="title"]')?.innerText?.trim() ||
            el.closest("section")?.querySelector('[class*="title"]')?.innerText?.trim() ||
            "";
          const author =
            el
              .closest("section")
              ?.querySelector('[class*="author"], [class*="name"]')
              ?.innerText?.trim() || "";

          items.push({ url: absoluteUrl, title, author, noteId });
        });

        if (items.length > 0) break;
      }

      return items;
    },
    { max: candidateLimit, selectors: SEARCH_RESULT_LINK_SELECTORS }
  );

  console.log(`📋 找到 ${posts.length} 篇候选帖子`);

  const halfN = Math.ceil(maxPosts / 2);
  const sequential = posts.slice(0, halfN);
  const remaining = posts.slice(halfN);
  for (let j = remaining.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
  }
  const selected = [...sequential, ...remaining].slice(0, maxPosts);
  console.log(
    `📋 选取 ${selected.length} 篇帖子（前 ${Math.min(halfN, selected.length)} 顺序 + 后 ${Math.max(
      0,
      selected.length - halfN
    )} 随机）`
  );
  return { posts: selected, searchUrl };
}

// ─── 关闭搜索页上的通用覆盖层（不关闭详情弹窗） ───
async function dismissOverlays(page) {
  try {
    const overlaySelectors = [
      '[class*="close-button"]',
      '[class*="CloseBtn"]',
      '.close',
    ];
    for (const sel of overlaySelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          await btn.click().catch(() => null);
          await sleepRandom(...DELAYS.REACTION_TIME);
        }
      }
    }
  } catch {}
}

async function findPostCard(page, noteId) {
  for (const base of SEARCH_RESULT_LINK_SELECTORS) {
    const locator = page.locator(`${base}[href*="${noteId}"]`).first();
    if ((await locator.count()) > 0) {
      return locator;
    }
  }
  return null;
}

async function detectDetailState(page) {
  return page.evaluate(
    ({ modalSelectors, resultSelector, scrollSelectors }) => {
      const isVisible = (el) =>
        !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const modalVisible = modalSelectors.some((selector) => {
        const el = document.querySelector(selector);
        return isVisible(el);
      });
      const cards = document.querySelectorAll(resultSelector).length;
      const hasComments = !!document.querySelector(".comments-container");
      const hasScrollContainer = scrollSelectors.some((selector) =>
        isVisible(document.querySelector(selector))
      );
      return {
        url: location.href,
        modalVisible,
        cards,
        hasComments,
        hasScrollContainer,
      };
    },
    {
      modalSelectors: DETAIL_MODAL_SELECTORS,
      resultSelector: SEARCH_RESULT_CARD_SELECTOR,
      scrollSelectors: DETAIL_SCROLL_SELECTORS,
    }
  );
}

async function waitForDetailOpen(page) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const state = await detectDetailState(page);
    if (state.modalVisible) {
      return { mode: "modal", state };
    }
    if (!state.modalVisible && state.hasComments && state.cards === 0) {
      return { mode: "fullpage", state };
    }
    await sleepRandom(300, 500);
  }
  return { mode: "fallback", state: await detectDetailState(page) };
}

async function navigateToPost(page, post, searchUrl, context, cookiePath) {
  await ensureSearchPage(page, searchUrl, context, cookiePath);
  await dismissOverlays(page);

  let card = await findPostCard(page, post.noteId);
  if (!card) {
    await page.evaluate(() => {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" });
    });
    await sleepRandom(...DELAYS.BROWSE_SEARCH);
    card = await findPostCard(page, post.noteId);
  }

  if (!card) {
    console.warn(`  ⚠️ 搜索页未找到 noteId=${post.noteId} 的卡片，降级为 goto`);
    await page.goto(post.url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await navigationDelay();
    return { mode: "fallback" };
  }

  await card.scrollIntoViewIfNeeded();
  await sleepRandom(...DELAYS.HOVER_CARD);
  await card.hover().catch(() => null);
  await sleepRandom(...DELAYS.HOVER_CARD);
  await card.click({ timeout: 5000 });

  const result = await waitForDetailOpen(page);
  console.log(`  🚪 进入帖子模式: ${result.mode}`);
  return result;
}

async function closeDetailModal(page) {
  for (const selector of DETAIL_CLOSE_SELECTORS) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;
      await locator.click().catch(() => null);
      await sleepRandom(...DELAYS.MODAL_CLOSE_WAIT);
      const state = await detectDetailState(page);
      if (!state.modalVisible) {
        return true;
      }
    }
  }

  await page.keyboard.press("Escape").catch(() => null);
  await sleepRandom(...DELAYS.MODAL_CLOSE_WAIT);
  let state = await detectDetailState(page);
  if (!state.modalVisible) {
    return true;
  }

  const mask = page.locator(".note-detail-mask").first();
  if ((await mask.count()) > 0) {
    await mask.click({ position: { x: 10, y: 10 } }).catch(() => null);
    await sleepRandom(...DELAYS.MODAL_CLOSE_WAIT);
    state = await detectDetailState(page);
    if (!state.modalVisible) {
      return true;
    }
  }

  return false;
}

async function returnToSearch(page, mode, searchUrl, context, cookiePath) {
  if (mode === "modal") {
    const closed = await closeDetailModal(page);
    if (closed) {
      await ensureSearchPage(page, searchUrl, context, cookiePath);
      return;
    }
  }

  await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
  await sleepRandom(...DELAYS.BACK_NAVIGATION);
  if (!page.url().includes("search_result")) {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await navigationDelay();
  }
  await ensureSearchPage(page, searchUrl, context, cookiePath);
}

async function browseSearchResults(page) {
  const moves = randomInt(1, 3);
  for (let i = 0; i < moves; i++) {
    const delta = randomInt(100, 400) * (Math.random() > 0.4 ? 1 : -1);
    await page.evaluate((value) => {
      window.scrollBy({ top: value, behavior: "smooth" });
    }, delta);
    await sleepRandom(...DELAYS.BROWSE_SEARCH);
  }

  if (Math.random() < 0.3) {
    const cards = page.locator(SEARCH_RESULT_LINK_SELECTORS.join(", "));
    const count = await cards.count();
    if (count > 0) {
      const index = randomInt(0, Math.min(count - 1, 4));
      await cards.nth(index).hover().catch(() => null);
      await sleepRandom(...DELAYS.HOVER_CARD);
    }
  }
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

async function resolveDetailContext(page, mode) {
  if (mode !== "modal") {
    return {
      mode,
      rootSelector: "",
      scrollMode: "window",
      scrollSelector: "",
    };
  }

  const context = await page.evaluate(
    ({ modalSelectors, scrollSelectors }) => {
      const isVisible = (el) =>
        !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const rootSelector =
        modalSelectors.find((selector) => isVisible(document.querySelector(selector))) || "";
      const scrollSelector =
        scrollSelectors.find((selector) => {
          const el = document.querySelector(selector);
          return isVisible(el) && el.scrollHeight > el.clientHeight + 20;
        }) || "";

      return {
        rootSelector,
        scrollMode: scrollSelector ? "container" : "window",
        scrollSelector,
      };
    },
    { modalSelectors: DETAIL_MODAL_SELECTORS, scrollSelectors: DETAIL_SCROLL_SELECTORS }
  );

  return { mode, ...context };
}

async function getScrollMetrics(page, detailContext) {
  return page.evaluate((ctx) => {
    const target =
      ctx.scrollMode === "container" && ctx.scrollSelector
        ? document.querySelector(ctx.scrollSelector)
        : document.scrollingElement || document.documentElement;

    if (!target) {
      return {
        top: 0,
        viewportHeight: window.innerHeight,
        scrollHeight: 0,
      };
    }

    if (ctx.scrollMode === "container") {
      return {
        top: target.scrollTop,
        viewportHeight: target.clientHeight || window.innerHeight,
        scrollHeight: target.scrollHeight || target.clientHeight || 0,
      };
    }

    return {
      top: window.scrollY || document.documentElement.scrollTop,
      viewportHeight: window.innerHeight,
      scrollHeight:
        document.scrollingElement?.scrollHeight || document.body?.scrollHeight || 0,
    };
  }, detailContext);
}

async function performScroll(page, detailContext, delta, forceToBottom = false) {
  return page.evaluate(
    ({ ctx, step, toBottom }) => {
      const target =
        ctx.scrollMode === "container" && ctx.scrollSelector
          ? document.querySelector(ctx.scrollSelector)
          : document.scrollingElement || document.documentElement;

      if (!target) {
        return 0;
      }

      if (ctx.scrollMode === "container") {
        const before = target.scrollTop;
        target.scrollTo({
          top: toBottom ? target.scrollHeight : before + step,
          behavior: "smooth",
        });
        return before;
      }

      const before = window.scrollY || document.documentElement.scrollTop;
      if (toBottom) {
        window.scrollTo(0, document.body.scrollHeight);
      } else {
        window.scrollBy({ top: step, behavior: "smooth" });
      }
      return before;
    },
    { ctx: detailContext, step: Math.round(delta), toBottom: forceToBottom }
  );
}

// ─── 人类化滚动（兼容弹窗滚动容器） ───
async function humanScroll(page, speed, largeMode, pushCount, detailContext) {
  const beforeState = await getScrollMetrics(page, detailContext);
  let baseRatio = getScrollRatio(speed);
  if (largeMode) {
    baseRatio *= 2.0;
  }

  let actualDelta = 0;
  let currentScrollTop = beforeState.top;
  let prevTop = beforeState.top;
  let furthestScrollTop = beforeState.top;

  for (let i = 0; i < Math.max(1, pushCount); i++) {
    const scrollDelta = calculateScrollDelta(beforeState.viewportHeight, baseRatio);
    await performScroll(page, detailContext, scrollDelta);
    await sleepRandom(...DELAYS.SCROLL_WAIT);

    const state = await getScrollMetrics(page, detailContext);
    currentScrollTop = state.top;
    furthestScrollTop = Math.max(furthestScrollTop, currentScrollTop);
    const deltaThis = currentScrollTop - prevTop;
    prevTop = currentScrollTop;

    if (
      shouldBacktrackScroll(
        speed,
        largeMode,
        currentScrollTop,
        state.viewportHeight || beforeState.viewportHeight
      )
    ) {
      const backtrackDelta = calculateBacktrackDelta(
        state.viewportHeight || beforeState.viewportHeight,
        Math.max(deltaThis, scrollDelta),
        currentScrollTop
      );
      await performScroll(page, detailContext, -backtrackDelta);
      await sleepRandom(...DELAYS.POST_SCROLL);

      const afterBacktrackState = await getScrollMetrics(page, detailContext);
      currentScrollTop = afterBacktrackState.top;
      prevTop = currentScrollTop;
    }

    actualDelta = furthestScrollTop - beforeState.top;

    if (i < pushCount - 1) {
      await sleepRandom(...DELAYS.HUMAN_DELAY);
    }
  }

  if (actualDelta < CONFIG.MIN_SCROLL_DELTA && pushCount > 0) {
    await performScroll(page, detailContext, 0, true);
    await sleepRandom(...DELAYS.POST_SCROLL);
    const state = await getScrollMetrics(page, detailContext);
    currentScrollTop = state.top;
    actualDelta = currentScrollTop - beforeState.top;
  }

  return { actualDelta, currentScrollTop };
}

// ─── 滚动到评论区（兼容弹窗滚动容器） ───
async function scrollToCommentsArea(page, detailContext) {
  console.log("  📜 滚动到评论区...");
  await page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const container = root?.querySelector(".comments-container") || document.querySelector(".comments-container");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const target =
      ctx.scrollMode === "container" && ctx.scrollSelector
        ? document.querySelector(ctx.scrollSelector)
        : window;
    target.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
      })
    );
  }, detailContext);
  await sleepRandom(500, 1000);
}

// ─── 滚动到最后一条评论（兼容弹窗滚动容器） ───
async function scrollToLastComment(page, detailContext) {
  await page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const comments =
      root?.querySelectorAll(".parent-comment") || document.querySelectorAll(".parent-comment");
    if (comments.length > 0) {
      comments[comments.length - 1].scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, detailContext);
}

// ─── 点击展开回复按钮（兼容弹窗 root） ───
async function clickShowMoreButtons(page, detailContext, maxRepliesThreshold = 50) {
  return page.evaluate(
    ({ ctx, threshold }) => {
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
    },
    { ctx: detailContext, threshold: maxRepliesThreshold }
  );
}

async function getCommentCount(page, detailContext) {
  return page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    return root?.querySelectorAll(".parent-comment").length || 0;
  }, detailContext);
}

async function checkEndContainer(page, detailContext) {
  return page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const el = root?.querySelector(".end-container") || document.querySelector(".end-container");
    if (!el) return false;
    const text = el.textContent.trim().toUpperCase();
    return text.includes("THE END") || text.includes("THEEND");
  }, detailContext);
}

async function checkNoComments(page, detailContext) {
  return page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const el = root?.querySelector(".no-comments-text") || document.querySelector(".no-comments-text");
    return el ? el.textContent.includes("这是一片荒地") : false;
  }, detailContext);
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
async function loadAllComments(page, maxComments, speed, detailContext) {
  // 硬上限 500，防止极端情况
  const effectiveMax = maxComments > 0
    ? Math.min(maxComments, CONFIG.MAX_COMMENTS_HARD_LIMIT)
    : CONFIG.MAX_COMMENTS_HARD_LIMIT;
  const maxAttempts = effectiveMax * 3;
  const scrollInterval = getScrollInterval(speed);

  console.log("  📜 开始加载评论...");
  await scrollToCommentsArea(page, detailContext);
  await sleepRandom(...DELAYS.HUMAN_DELAY);

  const noComments = await checkNoComments(page, detailContext);
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
    if (await checkEndContainer(page, detailContext)) {
      const count = await getCommentCount(page, detailContext);
      console.log(`  ✅ 检测到 THE END，加载完成: ${count} 条评论, 点击: ${totalClicked}, 跳过: ${totalSkipped}`);
      return { hasComments: true };
    }

    if (attempt % CONFIG.BUTTON_CLICK_INTERVAL === 0) {
      const { clicked, skipped } = await clickShowMoreButtons(page, detailContext);
      totalClicked += clicked;
      totalSkipped += skipped;
      if (clicked > 0 || skipped > 0) {
        await sleepRandom(...DELAYS.READ_TIME);
        const r2 = await clickShowMoreButtons(page, detailContext);
        totalClicked += r2.clicked;
        totalSkipped += r2.skipped;
        if (r2.clicked > 0 || r2.skipped > 0) {
          await sleepRandom(...DELAYS.SHORT_READ);
        }
      }
    }

    const currentCount = await getCommentCount(page, detailContext);
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
      await scrollToLastComment(page, detailContext);
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
      detailContext
    );

    if (actualDelta < CONFIG.MIN_SCROLL_DELTA || currentScrollTop === lastScrollTop) {
      stagnantChecks++;
    } else {
      stagnantChecks = 0;
      lastScrollTop = currentScrollTop;
    }

    if (stagnantChecks >= CONFIG.STAGNANT_LIMIT) {
      console.log("  ⚡ 停滞过多，尝试大冲刺...");
      await humanScroll(page, speed, true, 10, detailContext);
      stagnantChecks = 0;
    }

    await new Promise((r) => setTimeout(r, scrollInterval));
  }

  console.log("  🏃 达到最大尝试次数，最后冲刺...");
  await humanScroll(page, speed, true, CONFIG.FINAL_SPRINT_PUSH_COUNT, detailContext);
  const count = await getCommentCount(page, detailContext);
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
async function extractComments(page, post, maxComments, speed, detailContext) {
  console.log(`  📖 提取帖子: ${post.url}`);
  const feedId = post.noteId || extractNoteId(post.url);

  // 等待 __INITIAL_STATE__ 可用
  try {
    await page.waitForFunction(
      () => window.__INITIAL_STATE__?.note?.noteDetailMap,
      { timeout: 10000 }
    );
  } catch {
    console.warn("  ⚠️ __INITIAL_STATE__ 加载超时");
  }

  try {
    await page.waitForSelector(".comments-container", { timeout: 8000 });
  } catch {
    console.warn("  ⚠️ 评论区加载超时");
  }

  const { hasComments } = await loadAllComments(page, maxComments, speed, detailContext);

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

function loadJsonFile(filePath, label = "JSON 文件") {
  const text = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 解析失败: ${error.message}`);
  }
}

function normalizeStringArray(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} 必须为数组`);
  }
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function loadTaskSpec(taskSpecPath, keyword) {
  if (!taskSpecPath) {
    throw new Error("必须传入 --task-spec。先生成 task spec，再运行采集/粗筛流程");
  }

  const absolutePath = path.resolve(taskSpecPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`task spec 不存在: ${absolutePath}`);
  }

  const expectedDir = path.resolve(__dirname, "..", "data", "task-specs");
  if (!absolutePath.startsWith(expectedDir + path.sep)) {
    throw new Error(`task spec 必须位于 data/task-specs/ 目录下: ${absolutePath}`);
  }

  const spec = loadJsonFile(absolutePath, "task spec");
  const normalized = {
    keyword: String(spec.keyword || keyword || "").trim(),
    post_relevance: {
      include: normalizeStringArray(spec.post_relevance?.include || [], "post_relevance.include"),
      exclude: normalizeStringArray(spec.post_relevance?.exclude || [], "post_relevance.exclude"),
    },
    comment_filter: {
      include: normalizeStringArray(spec.comment_filter?.include || [], "comment_filter.include"),
      exclude: normalizeStringArray(spec.comment_filter?.exclude || [], "comment_filter.exclude"),
    },
    semantic_focus: String(spec.semantic_focus || "").trim(),
  };

  if (!normalized.keyword) {
    throw new Error("task spec.keyword 不能为空");
  }
  return { path: absolutePath, spec: normalized };
}

function runNodeScript(scriptPath, args = []) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`脚本执行失败: ${path.basename(scriptPath)} (exit ${result.status})`);
  }
}

function runPostPipeline(opts, result, taskSpec) {
  const skillDir = path.join(__dirname, '..');
  const safeKeyword = sanitizeKeywordForFilename(opts.keyword);
  const candidatesPath = path.join(skillDir, 'data', `candidates_${safeKeyword}.json`);
  const filterScript = path.join(__dirname, 'filter-comments.js');

  console.log('\n🔁 开始自动执行后处理流程...');
  runNodeScript(filterScript, [
    '--input',
    opts.output,
    '--output',
    candidatesPath,
    '--task-spec',
    taskSpec.path,
  ]);

  console.log(`✅ 候选文件已生成: ${candidatesPath}`);
  console.log(`   Task Spec: ${taskSpec.path}`);
  console.log(`ℹ️ 下一步由 AI 读取 candidates_${safeKeyword}.json，完成语义精筛并生成 analysis_${safeKeyword}.json`);

  return { candidatesPath };
}

// ─── 主流程 ───
async function main() {
  const opts = parseArgs();
  const taskSpec = loadTaskSpec(opts.taskSpecPath, opts.keyword);
  console.log("🚀 小红书评论采集器启动（人类化模式）");
  console.log(`   关键词: ${opts.keyword}`);
  console.log(`   最大帖子数: ${opts.maxPosts}`);
  console.log(`   每帖最大评论数: ${opts.maxComments === 0 ? "全部（硬上限 500）" : opts.maxComments}`);
  console.log(`   运行模式: ${opts.headed ? "有头" : "无头"}`);
  console.log(`   滚动速度: ${opts.speed}`);
  console.log(`   Task Spec: ${path.basename(taskSpec.path)}`);

  if (opts.postProcessOnly) {
    const result = loadJsonFile(opts.output, "采集结果");
    runPostPipeline(opts, result, taskSpec);
    return;
  }

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
    const { posts: allPosts, searchUrl } = await searchPosts(
      page,
      opts.keyword,
      opts.maxPosts,
      context,
      opts.cookiePath
    );

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
      let postData = null;
      let handled = false;

      try {
        for (let attempt = 1; attempt <= 3; attempt++) {
          let nav = { mode: "fallback" };
          try {
            nav = await navigateToPost(
              page,
              posts[i],
              searchUrl,
              context,
              opts.cookiePath
            );

            if (await checkRateLimit(page)) {
              if (attempt < 3) {
                console.warn(`  ⚠️ 触发频率限制（300013），第 ${attempt} 次重试前等待...`);
                await returnToSearch(page, nav.mode, searchUrl, context, opts.cookiePath);
                await sleepRandom(...DELAYS.RATE_LIMIT_WAIT);
                continue;
              }
              console.error("  ❌ 连续 3 次触发频率限制，跳过此帖");
              await returnToSearch(page, nav.mode, searchUrl, context, opts.cookiePath);
              handled = true;
              break;
            }

            const detailContext = await resolveDetailContext(page, nav.mode);
            console.log(
              `  🧭 评论滚动上下文: ${detailContext.scrollMode}${
                detailContext.scrollSelector ? ` (${detailContext.scrollSelector})` : ""
              }`
            );
            postData = await extractComments(
              page,
              posts[i],
              opts.maxComments,
              opts.speed,
              detailContext
            );
            await returnToSearch(page, nav.mode, searchUrl, context, opts.cookiePath);
            handled = true;
            break;
          } catch (error) {
            const message = error?.message || String(error);
            const retryable = /Execution context was destroyed|Cannot find context|Target page, context or browser has been closed|Navigation failed/i.test(message);
            console.warn(`  ⚠️ 第 ${attempt} 次处理异常: ${message}`);
            await returnToSearch(page, nav.mode, searchUrl, context, opts.cookiePath).catch(() => null);
            if (retryable && attempt < 3) {
              await sleepRandom(1500, 3000);
              continue;
            }
            throw error;
          }
        }

        if (postData) {
          newPosts.push({
            title: postData.title || posts[i].title,
            url: posts[i].url,
            noteId: posts[i].noteId || extractNoteId(posts[i].url),
            author: postData.author || posts[i].author,
            commentCount: postData.commentCount || "0",
            comments: postData.comments,
            screenshotFile: postData.screenshotFile || "",
          });
        }
      } catch (e) {
        console.error(`  ❌ 帖子处理失败: ${e.message}`);
        await returnToSearch(
          page,
          "fallback",
          searchUrl,
          context,
          opts.cookiePath
        ).catch(() => null);
      }

      if (!handled) {
        console.warn("  ⚠️ 本帖未能完成处理");
      }

      if (i < posts.length - 1) {
        await browseSearchResults(page);
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

    runPostPipeline(opts, result, taskSpec);

    await saveCookies(context, opts.cookiePath);
  } catch (e) {
    console.error("❌ 运行出错:", e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
