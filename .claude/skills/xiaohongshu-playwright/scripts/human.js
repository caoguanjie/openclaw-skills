/**
 * 人类行为模拟参数（延迟、滚动、悬停）。
 * 对应 Python 版 xhs/human.py，保持相同数值范围和计算逻辑。
 */

// ========== 配置常量 ==========
const CONFIG = {
  DEFAULT_MAX_ATTEMPTS: 500,
  STAGNANT_LIMIT: 20,
  MIN_SCROLL_DELTA: 10,
  MIN_BACKTRACK_DELTA: 60,
  MAX_CLICK_PER_ROUND: 3,
  STAGNANT_CHECK_THRESHOLD: 2,
  LARGE_SCROLL_TRIGGER: 5,
  BUTTON_CLICK_INTERVAL: 3,
  FINAL_SPRINT_PUSH_COUNT: 15,
  MAX_COMMENTS_HARD_LIMIT: 500,
  WORKER_REBUILD_INTERVAL: 5,       // 每 5 帖主动重建 worker page
  WORKER_MAX_CONTEXT_ERRORS: 2,     // 连续 2 次上下文销毁触发重建
  WORKER_MAX_RATE_LIMITS: 2,        // 连续 2 次限流触发重建
  DETAIL_CONTEXT_REPROBE_INTERVAL: 15, // 每 15 次滚动循环重新探测 detailContext
};

// ========== 延迟范围（毫秒） ==========
const DELAYS = {
  HUMAN_DELAY: [300, 700],
  REACTION_TIME: [300, 800],
  HOVER_TIME: [100, 300],
  READ_TIME: [500, 1200],
  SHORT_READ: [600, 1200],
  SCROLL_WAIT: [100, 200],
  POST_SCROLL: [300, 500],
  BROWSE_SEARCH: [1500, 3000],
  HOVER_CARD: [200, 500],
  MODAL_CLOSE_WAIT: [500, 1000],
  BACK_NAVIGATION: [1000, 2000],
  POST_GAP: [5000, 10000],       // 帖子间基础间隔 5-10s
  RATE_LIMIT_WAIT: [15000, 30000], // 遇到限流后等待 15-30s
};

// ========== 页面不可访问关键词 ==========
const INACCESSIBLE_KEYWORDS = [
  "当前笔记暂时无法浏览",
  "该内容因违规已被删除",
  "该笔记已被删除",
  "内容不存在",
  "笔记不存在",
  "已失效",
  "私密笔记",
  "仅作者可见",
  "因用户设置，你无法查看",
  "因违规无法查看",
];

// ========== 频率限制关键词 ==========
const RATE_LIMIT_KEYWORDS = [
  "安全限制",
  "访问频繁",
  "300013",
  "请稍后再试",
];

// ========== 常用 User-Agent 列表 ==========
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

// ========== 核心函数 ==========

/**
 * 随机延迟。
 * @param {number} minMs - 最小毫秒
 * @param {number} maxMs - 最大毫秒
 */
function sleepRandom(minMs, maxMs) {
  if (maxMs <= minMs) {
    return new Promise((r) => setTimeout(r, minMs));
  }
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, delay));
}

/**
 * 页面导航后的随机等待，模拟人类阅读。
 */
function navigationDelay() {
  return sleepRandom(1000, 2500);
}

/**
 * 根据速度获取滚动间隔（毫秒 → 返回毫秒数用于 sleepRandom）。
 * @param {"slow"|"normal"|"fast"} speed
 * @returns {number} 间隔毫秒
 */
function getScrollInterval(speed) {
  if (speed === "slow") {
    return 1200 + Math.floor(Math.random() * 300);
  }
  if (speed === "fast") {
    return 300 + Math.floor(Math.random() * 100);
  }
  // normal
  return 600 + Math.floor(Math.random() * 200);
}

/**
 * 根据速度获取滚动比例。
 * @param {"slow"|"normal"|"fast"} speed
 * @returns {number}
 */
function getScrollRatio(speed) {
  if (speed === "slow") return 0.5;
  if (speed === "fast") return 0.9;
  return 0.7;
}

/**
 * 计算滚动距离。
 * @param {number} viewportHeight - 视口高度
 * @param {number} baseRatio - 基准比例
 * @returns {number} 滚动像素数
 */
function calculateScrollDelta(viewportHeight, baseRatio) {
  let scrollDelta = viewportHeight * (baseRatio + Math.random() * 0.2);
  if (scrollDelta < 400) {
    scrollDelta = 400;
  }
  return scrollDelta + Math.floor(Math.random() * 101) - 50; // jitter -50 ~ +50
}

/**
 * 是否执行一次小幅向上回拉，避免滚动轨迹过于机械。
 * @param {"slow"|"normal"|"fast"} speed
 * @param {boolean} largeMode
 * @param {number} currentTop
 * @param {number} viewportHeight
 * @returns {boolean}
 */
function shouldBacktrackScroll(speed, largeMode, currentTop, viewportHeight) {
  if (currentTop <= Math.max(viewportHeight * 0.35, CONFIG.MIN_BACKTRACK_DELTA * 2)) {
    return false;
  }

  let chance = 0.22;
  if (speed === "slow") chance = 0.3;
  if (speed === "fast") chance = 0.12;
  if (largeMode) chance *= 0.45;

  return Math.random() < chance;
}

/**
 * 计算一次小幅向上回拉距离。
 * @param {number} viewportHeight
 * @param {number} forwardDelta
 * @param {number} currentTop
 * @returns {number}
 */
function calculateBacktrackDelta(viewportHeight, forwardDelta, currentTop) {
  const baseDelta = Math.min(
    currentTop - CONFIG.MIN_BACKTRACK_DELTA,
    forwardDelta * (0.15 + Math.random() * 0.2),
    viewportHeight * (0.1 + Math.random() * 0.12)
  );

  return Math.max(CONFIG.MIN_BACKTRACK_DELTA, Math.round(baseDelta));
}

/**
 * 从 User-Agent 列表中随机选择。
 * @returns {string}
 */
function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 生成随机整数 [min, max]。
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  CONFIG,
  DELAYS,
  INACCESSIBLE_KEYWORDS,
  RATE_LIMIT_KEYWORDS,
  USER_AGENTS,
  sleepRandom,
  navigationDelay,
  getScrollInterval,
  getScrollRatio,
  calculateScrollDelta,
  shouldBacktrackScroll,
  calculateBacktrackDelta,
  randomUserAgent,
  randomInt,
};
