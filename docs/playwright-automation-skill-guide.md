# Playwright 自动化 Skill 建设指南

> 基于小红书潜客挖掘 Skill 的实战经验提炼，适用于快速构建任何基于 Playwright 的浏览器自动化 Skill。
>
> 最后更新: 2026-03-29

---

## 目录

1. [环境检查与安装](#一环境检查与安装)
2. [浏览器反检测](#二浏览器反检测)
3. [站点经验知识库](#三站点经验知识库)
4. [Playwright 实战架构](#四playwright-实战架构)
5. [Task Spec 驱动的数据管道](#五task-spec-驱动的数据管道)
6. [AI 两阶段筛选](#六ai-两阶段筛选)
7. [子代理并行分发](#七子代理并行分发)
8. [输出层（可插拔）](#八输出层可插拔)
9. [附录](#附录)

---

## 一、环境检查与安装

### 通用原则

自动化 Skill 的环境依赖通常包含三层：

| 层级 | 说明 | 示例 |
|------|------|------|
| 运行时 | Node.js / Python 版本 | Node.js 22+ |
| npm/pip 依赖 | 脚本依赖的第三方包 | playwright, exceljs |
| 浏览器二进制 | Playwright 管理的浏览器 | Chromium |

**核心设计决策：**

1. **首次检查 + 结果缓存**：环境就绪后将状态写入站点经验文件，后续运行跳过安装。避免每次都执行耗时的 `npm install`。
2. **镜像源优先**：国内网络环境必须配置镜像源（如 npmmirror），失败再回退官方源。Playwright 浏览器下载通过 `PLAYWRIGHT_DOWNLOAD_HOST` 环境变量加速。
3. **进度反馈**：安装过程必须持续输出当前阶段，防止用户以为卡死。
4. **环境检查与任务准备并行**：环境安装和 task spec 生成互不依赖，可以同时启动。

### 代码模板

```bash
# === 环境安装模板 ===
SKILL_DIR="<你的 skill 目录的绝对路径>"

# npm 依赖安装（镜像源优先，失败回退官方源）
cd "${SKILL_DIR}" && \
  npm install <依赖列表> --registry=https://registry.npmmirror.com 2>/dev/null || \
  npm install <依赖列表>

# Playwright Chromium 安装（镜像源优先）
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/ \
  npx playwright install chromium 2>/dev/null || \
  npx playwright install chromium
```

**脚本内的浏览器检查（快速验证已安装）：**

```javascript
async function ensureBrowserInstalled() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (e) {
    if (e.message.includes("Executable doesn't exist") ||
        e.message.includes("browserType.launch")) {
      console.error("❌ Playwright 浏览器未安装");
      console.error("   请运行: npx playwright install chromium");
      process.exit(1);
    }
  }
}
```

### 小红书实例

SKILL.md 的步骤 1a 定义了完整的环境检查流程：

- 读取 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落
- 检查三个字段：`环境状态`、`Playwright依赖`、`Chromium浏览器`
- 未就绪时执行安装，完成后更新字段为 `已就绪` + 写入 `最后检查时间`
- 安装失败时将失败原因写入站点经验文件的备注中，避免静默卡死

**关键经验**：`package.json` 中锁定依赖版本。小红书 skill 的依赖是 `playwright: ^1.58.2`、`rebrowser-patches: ^1.0.19`、`exceljs: ^4.4.0`。

---

## 二、浏览器反检测

### 通用原则

现代网站的反爬检测主要集中在三个层面：

| 检测层面 | 检测手段 | 对策 |
|---------|---------|------|
| CDP 协议泄露 | `Runtime.enable` 事件 leak、`navigator.webdriver = true` | rebrowser-patches（npm 包） |
| 浏览器指纹 | UA/platform/plugins/languages 不一致 | initScript 注入 + 随机化 |
| 行为分析 | 滚动轨迹过于均匀、操作间隔固定 | 人类化延迟 + 回拉 + 随机 |

**三层防线架构：**

```
第一层: rebrowser-patches    → 修复 Playwright 底层的 CDP leak
第二层: addInitScript        → 伪装浏览器指纹（plugins, languages, platform）
第三层: 运行时参数            → 随机 viewport、UA 轮换、人类化操作
```

### 代码模板

**第一层：rebrowser-patches（脚本顶部引入）**

```javascript
// 必须在 require("playwright") 之前执行
try {
  require("rebrowser-patches/patch");
} catch {
  console.warn("⚠️ rebrowser-patches 未安装，CDP leak 未修复，反爬系统可能识别出自动化浏览器");
}
```

**第二层：反检测 initScript**

```javascript
const ANTI_DETECT_SCRIPT = `
(() => {
  // 1. 隐藏 webdriver 标志（兜底，rebrowser-patches 可能已处理）
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch {}

  // 2. 伪装 plugins（真实浏览器有 3 个内置插件）
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

  // 3. 伪装 languages
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en-US', 'en'],
    });
  } catch {}

  // 4. 伪装 platform（⚠️ 必须与 UA 匹配，见下文说明）
  try {
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel', // Windows 环境应改为 'Win32'
    });
  } catch {}

  // 5. 伪装硬件参数（建议随机化，不要固定值）
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)],
    });
  } catch {}
  try {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
    });
  } catch {}

  // 6. 隐藏 Chrome DevTools Protocol 痕迹
  try {
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  } catch {}

  // 7. 修复 chrome.runtime（Playwright 默认缺失）
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: () => {},
      sendMessage: () => {},
    };
  }

  // 8. 修复 Permissions API（避免返回 "denied" 暴露自动化）
  try {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  } catch {}
})();
`;

// 使用方式
await page.addInitScript(ANTI_DETECT_SCRIPT);
```

**第三层：运行时随机化**

```javascript
// UA 列表（定期更新到最新 Chrome 版本）
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // ... 更多
];

// 随机 viewport（避免指纹固定）
const context = await browser.newContext({
  viewport: {
    width: 1280 + randomInt(-20, 20),
    height: 800 + randomInt(-20, 20),
  },
  userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

// chromium.launch 参数
const browser = await chromium.launch({
  headless: !opts.headed,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
});
```

### 小红书实例

反检测方面踩过的坑（记录在 `ISSUES.md`）：

| 问题 | 影响 | 状态 |
|------|------|------|
| UA 版本过时（Chrome 124/125） | 明显的机器人指纹 | 已知待修 |
| `navigator.platform` 硬编码 MacIntel | Windows 上指纹矛盾 | 已知待修 |
| `hardwareConcurrency/deviceMemory` 固定值 8 | 每次运行指纹一致 | 已知待修 |
| `rebrowser-patches` 静默降级 | CDP leak 未修复但无警告 | 已知待修 |

**教训**：反检测参数必须与 UA 保持一致。选了 Windows UA 就必须配 `Win32` platform。建议做一个 `createFingerprint()` 函数统一管理这些关联参数。

---

## 三、站点经验知识库

### 通用原则

每个目标站点都需要一个「经验文件」，用于积累选择器、陷阱、有效模式等实战经验。这些经验随着站点的改版不断演化。

**何时记录：**
- 脚本报错、选择器失效时
- 发现新的反爬机制时
- 找到稳定的数据提取方式时
- 每次运行的流程发现

**记什么：**
- 有效的 CSS/XPath 选择器（附日期，方便判断过时）
- 站点 API 行为特征
- 反爬检测触发条件和阈值
- 登录态管理的特殊逻辑
- 环境和用户偏好状态

**怎么维护：**
- 每条记录标注日期（`2026-03-27:`），方便清理过时信息
- 同一主题的旧记录如果被推翻，用 `~~删除线~~` 标记而不是直接删除
- 由 AI 在每次运行结束后自动追加（SKILL.md 的最后一步）

### 文件模板

```markdown
---
domain: <站点域名>
aliases: [<中文名>, <缩写>]
updated: <YYYY-MM-DD>
---

## 平台特征

> 描述该站点的技术架构特点，帮助理解为什么要用特定的采集策略。

- <例: SPA 架构，评论区动态加载>
- <例: xsec_token 反爬机制>
- <例: 搜索结果需登录才能完整显示>

## 有效模式

> 经过验证可用的选择器、URL 模式、数据提取方式。每条带日期。

- YYYY-MM-DD: <描述>

## 已知陷阱

> 踩过的坑。帮助后续开发避免重复犯错。每条带日期。

- YYYY-MM-DD: <描述>

## 本地环境

> 由 AI 在首次环境检查完成后自动填写，后续运行先读这里判断是否需要再次安装。

- 环境状态: 未设置
- Playwright依赖: 未安装
- Chromium浏览器: 未安装
- 最后检查时间: -
- 备注: -

## 用户习惯

> 由 AI 在首次运行时根据用户选择自动填写，后续运行自动读取。

- 运行模式: 未设置
- 设置时间: -
```

### 小红书实例

小红书的站点经验文件（`xiaohongshu.md`）从空白开始，经过约一周的开发迭代，积累了以下内容：

**平台特征**（6 条）：SPA 架构、xsec_token 反爬、搜索需登录、SSR 注入 `__INITIAL_STATE__`等。

**有效模式**（10+ 条）：搜索 URL 格式、评论区选择器、登录检测多重策略、弹窗模式容器选择器等。

**已知陷阱**（20+ 条）：未登录 API 行为、裸 fetch 失败、频率限制 300013、cookie 过期处理、评论区滚动容器判定等。

**关键洞察**：最有价值的经验往往是「失败记录」。比如 `2026-03-27: 帖子间隔过短（<4s）会触发频率限制 300013` 这条经验直接催生了 `POST_GAP: [5000, 10000]` 和 `checkRateLimit()` 函数。

---

## 四、Playwright 实战架构

### 4.1 模块拆分模式

一个完整的采集脚本建议拆成三个文件：

```
scripts/
├── <domain>-scraper.js    # 主流程：CLI 解析、浏览器启动、业务逻辑编排
├── human.js               # 人类化模块：延迟常量、滚动算法、UA 列表
└── filter-<data>.js       # 粗筛脚本：确定性规则过滤
```

**拆分理由：**
- `human.js` 跨站点复用，不含业务逻辑
- 主流程脚本是站点特定的，包含选择器、页面导航、数据提取
- 粗筛脚本独立于浏览器，可以本地快速迭代和调试

### 4.2 核心流程模式

以下是每个 Playwright 自动化 skill 几乎都会遇到的核心流程，逐一给出模式和代码。

#### 4.2.1 Cookie 管理

**模式**：加载→验证→使用→保存。Cookie 文件存为 JSON，加载前过滤过期条目。

```javascript
// Cookie 文件路径约定: data/cookies.json
async function loadCookies(context, cookiePath) {
  if (!fs.existsSync(cookiePath)) return false;
  try {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
    if (!Array.isArray(cookies) || cookies.length === 0) return false;

    const now = Date.now() / 1000;
    // ⚠️ 过滤过期 cookie（小红书 expires 为 Unix 时间戳/秒）
    const valid = cookies.filter(
      (c) => !c.expires || c.expires === -1 || c.expires > now
    );
    if (valid.length === 0) {
      console.warn("所有 cookie 已过期");
      return false;
    }

    await context.addCookies(valid);
    console.log(`已加载 ${valid.length} 个有效 cookie`);
    return true;
  } catch (e) {
    console.warn("Cookie 文件解析失败:", e.message);
    return false;
  }
}

async function saveCookies(context, cookiePath) {
  const cookies = await context.cookies();
  const dir = path.dirname(cookiePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
  console.log(`已保存 ${cookies.length} 个 cookie`);
}
```

#### 4.2.2 登录流程

**模式**：三种登录场景需要分别处理。

| 场景 | 策略 |
|------|------|
| 有头模式 | 提示用户在浏览器窗口中手动登录 |
| 无头模式 | 从 DOM 提取 QR 码 base64 → 保存为 PNG → 系统程序打开 |
| 搜索页二次登录 | Cookie 对首页有效但搜索页弹出登录层，需独立处理 |

**关键设计**：

```javascript
// 登录检测（多重判断，单一信号不可靠）
async function checkLogin(page) {
  const isLoggedIn = await page.evaluate(() => {
    // 信号1: Cookie 中有关键字段
    const hasCookieUser = document.cookie.includes("关键cookie名");
    // 信号2: 是否有登录弹窗（有弹窗=未登录）
    const hasLoginModal = !!document.querySelector("登录弹窗选择器");
    // 信号3: 是否有用户头像等已登录标识
    const hasUserEl = !!document.querySelector("用户头像选择器");
    // 信号4: __INITIAL_STATE__ 中的用户信息
    let hasStateUser = false;
    try {
      hasStateUser = !!window.__INITIAL_STATE__?.user?.userInfo?.userId;
    } catch {}

    if (hasLoginModal) return false; // 弹窗存在 = 一定未登录
    return hasCookieUser || hasStateUser || hasUserEl;
  });
  return isLoggedIn;
}
```

**无头 QR 码登录（跨平台）：**

```javascript
// QR 码从 DOM 提取并保存为本地文件
const qrSrc = await page.evaluate(() => {
  const img = document.querySelector("QR码图片选择器");
  return img?.src || "";
});

if (qrSrc && qrSrc.includes("base64,")) {
  const base64Data = qrSrc.split("base64,")[1];
  const qrPath = path.join(dataDir, "login_qrcode.png");
  fs.writeFileSync(qrPath, Buffer.from(base64Data, "base64"));
  openFile(qrPath); // 跨平台打开
}

// 跨平台文件打开
function openFile(filePath) {
  const { spawn } = require("child_process");
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", filePath], { stdio: "ignore" });
  } else if (process.platform === "darwin") {
    spawn("open", [filePath], { stdio: "ignore" });
  } else {
    spawn("xdg-open", [filePath], { stdio: "ignore" });
  }
}

// 轮询登录完成
const maxWait = 5 * 60 * 1000;
const pollInterval = 3000;
const startTime = Date.now();
while (Date.now() - startTime < maxWait) {
  await new Promise((r) => setTimeout(r, pollInterval));
  const loggedIn = await checkLogin(page);
  if (loggedIn) break;
  process.stdout.write(`\r⏳ 已等待 ${Math.round((Date.now() - startTime) / 1000)}s，请扫码登录...`);
}
```

#### 4.2.3 页面状态检测

**模式**：点击后进入的页面可能有多种状态（弹窗模式、全页模式、加载失败）。需要轮询判断。

```javascript
// 状态检测函数
async function detectPageState(page) {
  return page.evaluate(({ modalSelectors, contentSelector }) => {
    const isVisible = (el) =>
      !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const modalVisible = modalSelectors.some((sel) =>
      isVisible(document.querySelector(sel))
    );
    const hasContent = !!document.querySelector(contentSelector);
    return { modalVisible, hasContent, url: location.href };
  }, { modalSelectors: [...], contentSelector: "..." });
}

// 带超时的状态等待
async function waitForPageReady(page, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await detectPageState(page);
    if (state.modalVisible) return { mode: "modal", state };
    if (state.hasContent) return { mode: "fullpage", state };
    await sleepRandom(300, 500);
  }
  return { mode: "fallback", state: await detectPageState(page) };
}
```

#### 4.2.4 人类化滚动状态机

**模式**：滚动行为是反爬检测的重点。需要模拟真人的阅读节奏。

```
状态机设计：

  [开始] → 定位到内容区 → 多段推进滚动
                              ↓
                     检查是否到底（THE END / 无更多内容）
                        ├── 是 → [完成]
                        └── 否 → 计数停滞检查
                                    ├── 停滞 < 5 次 → 继续滚动
                                    ├── 停滞 5-20 次 → 切换 largeMode（加大幅度）
                                    └── 停滞 > 20 次 → 大冲刺（一次性多推）
                                                          └── 还是停滞 → [放弃]
```

**关键参数（human.js）：**

```javascript
const CONFIG = {
  STAGNANT_LIMIT: 20,          // 停滞多少次后放弃
  MIN_SCROLL_DELTA: 10,        // 最小有效滚动距离
  LARGE_SCROLL_TRIGGER: 5,     // 连续停滞多少次切换大幅滚动
  BUTTON_CLICK_INTERVAL: 3,    // 每 N 次滚动尝试点击"展开更多"
  FINAL_SPRINT_PUSH_COUNT: 15, // 最终冲刺的推进次数
  MAX_COMMENTS_HARD_LIMIT: 500,// 单帖评论硬上限
};

const DELAYS = {
  HUMAN_DELAY: [300, 700],     // 基础人类操作间隔
  REACTION_TIME: [300, 800],   // 反应时间
  READ_TIME: [500, 1200],      // 阅读等待
  SCROLL_WAIT: [100, 200],     // 滚动后等待内容加载
  POST_GAP: [5000, 10000],     // 帖子间冷却间隔
  RATE_LIMIT_WAIT: [15000, 30000], // 触发限流后的等待
};
```

**回拉机制（核心反检测手段）：**

```javascript
// 真人阅读时会偶尔向上翻回去看之前的内容
function shouldBacktrackScroll(speed, largeMode, currentTop, viewportHeight) {
  if (currentTop <= viewportHeight * 0.35) return false; // 距离顶部太近不回拉
  let chance = 0.22; // 约 22% 概率回拉
  if (speed === "slow") chance = 0.3;
  if (speed === "fast") chance = 0.12;
  if (largeMode) chance *= 0.45; // 大幅滚动时减少回拉
  return Math.random() < chance;
}

function calculateBacktrackDelta(viewportHeight, forwardDelta, currentTop) {
  // 回拉距离 = 前进距离的 15-35%，但不超过视口的 10-22%
  const baseDelta = Math.min(
    currentTop - MIN_BACKTRACK_DELTA,
    forwardDelta * (0.15 + Math.random() * 0.2),
    viewportHeight * (0.1 + Math.random() * 0.12)
  );
  return Math.max(MIN_BACKTRACK_DELTA, Math.round(baseDelta));
}
```

#### 4.2.5 数据提取策略

**模式**：优先从 JS 运行时状态提取（更完整），DOM 提取作为后备。

```javascript
// 策略1：从页面注入的全局状态提取（SPA 站点常见）
const stateData = await page.evaluate(() => {
  try {
    const state = window.__INITIAL_STATE__;
    return JSON.stringify(state?.note?.noteDetailMap || {});
  } catch { return ""; }
});

// 策略2：DOM fallback（当 __INITIAL_STATE__ 不完整时）
const domComments = await page.evaluate(() => {
  const items = document.querySelectorAll(".comment-item");
  return Array.from(items).map(el => ({
    username: el.querySelector(".username")?.textContent?.trim(),
    content: el.querySelector(".content")?.textContent?.trim(),
    // ...
  }));
});
```

**注意**：小红书的 `__INITIAL_STATE__` 只包含初始加载的评论。通过滚动加载的新评论可能不在其中（这是小红书 skill 的 P0 已知问题）。建议同时部署两种策略。

#### 4.2.6 频率限制检测与退避

**模式**：检测限流关键词，触发后等待重试。

```javascript
const RATE_LIMIT_KEYWORDS = [
  "安全限制", "访问频繁", "请稍后再试",
  // 添加目标站点特有的限流提示文本
];

async function checkRateLimit(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText || '');
    return RATE_LIMIT_KEYWORDS.some((kw) => text.includes(kw));
  } catch {
    return false;
  }
}

// 在导航到新页面后立即检查
await page.goto(url, { waitUntil: "domcontentloaded" });
if (await checkRateLimit(page)) {
  console.warn("⚠️ 触发频率限制，等待 15-30s 后重试...");
  await sleepRandom(15000, 30000);
  // 重试或跳过
}
```

### 4.3 坑点速查表

| 坑点 | 症状 | 解法 |
|------|------|------|
| Cookie 过期字段格式 | 加载 cookie 报错或无效 | 加载前过滤 `expires > now`，注意单位（秒 vs 毫秒） |
| 搜索页二次登录 | Cookie 对首页有效但搜索页弹窗 | 在 `searchPosts()` 中独立检测并等待 |
| 弹窗模式 vs 全页模式 | DOM 结构不同，选择器失效 | 优先检测弹窗 DOM，不依赖 URL 判断 |
| 弹窗内滚动容器 | 滚动 `window` 不加载评论 | 找到弹窗内的 `.note-scroller` 容器操作 `scrollTop` |
| `page.pause()` 不弹窗 | 需要 `PWDEBUG=1` 环境变量 | 不用 `page.pause()` 做登录等待，改用轮询 |
| 关闭弹窗不稳定 | 点击 mask 不一定关闭 | 优先找 close 按钮 → Escape → mask 兜底 |
| 同一帖子多种 URL 格式 | noteId 提取失败 | 用正则 `/([a-f0-9]{24})\b/` 统一提取 |
| 帖子间隔过短 | 触发 300013 频率限制 | `POST_GAP: [5000, 10000]` + `checkRateLimit()` |
| `window.scrollBy` vs `scrollTop` | 弹窗容器内无法用 `window.scrollBy` | 检测滚动上下文，container 模式用 `scrollTo` |

---

## 五、Task Spec 驱动的数据管道

### 通用原则

Task Spec 是整个数据管道的「指令书」，定义了：
- **筛选什么**（关键词、包含/排除词）
- **怎么筛**（粗筛规则、语义聚焦方向）

**为什么需要 Task Spec：**
1. 同一个 skill 对不同关键词的筛选策略不同（"医美" vs "考研英语"）
2. 粗筛脚本和精筛 sub-agent 都需要读取同一份配置，保持一致
3. 落盘后可追溯、可复盘

**Task Spec 结构模板（通用）：**

```json
{
  "keyword": "搜索关键词",
  "target_filter": {
    "include": ["与目标相关的词"],
    "exclude": ["明确无关的词"]
  },
  "item_filter": {
    "include": ["单条数据中的兴趣信号"],
    "exclude": ["噪声信号"]
  },
  "semantic_focus": "一句话描述 AI 精筛的判断标准"
}
```

### 数据管道

```
用户输入
    ↓
[Task Spec 生成] → data/task-specs/<timestamp>_<keyword>.json
    ↓
[数据采集] → data/raw_<keyword>.json
    ↓
[粗筛] → data/candidates_<keyword>.json
    ↓
[并行精筛] → data/analysis_posts/<keyword>/<itemId>.json (分片)
    ↓
[合并] → data/analysis_<keyword>.json
    ↓
[输出生成] → output/<keyword>_<date>_<time>.<ext>
    ↓
[清理] → 删除 task spec + 分片目录
```

**命名约定**：
- 文件名包含关键词，多关键词时各自独立文件
- 时间戳使用 ISO 格式，方便排序
- 分片目录按关键词隔离

### 代码模板

**save-task-spec.js**（生成 + 验证 + 落盘）：

```javascript
// CLI: node save-task-spec.js --keyword "医美" --json '<task-spec-json>'
// 输出: 打印生成的文件路径到 stdout

function validateTaskSpec(rawSpec, keyword) {
  return {
    keyword: String(rawSpec.keyword || keyword).trim(),
    target_filter: {
      include: normalizeStringArray(rawSpec.target_filter?.include || []),
      exclude: normalizeStringArray(rawSpec.target_filter?.exclude || []),
    },
    item_filter: {
      include: normalizeStringArray(rawSpec.item_filter?.include || []),
      exclude: normalizeStringArray(rawSpec.item_filter?.exclude || []),
    },
    semantic_focus: String(rawSpec.semantic_focus || "").trim(),
  };
}

function buildOutputPath(keyword) {
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
  const safeKw = keyword.replace(/[\\/:*?"<>|\s]+/g, "_");
  return path.join(__dirname, "..", "data", "task-specs", `${stamp}_${safeKw}.json`);
}
```

**cleanup-task-specs.js**（按关键词清理）：

```javascript
// CLI: node cleanup-task-specs.js --keyword "医美"
// 只删除匹配关键词的文件，不影响其他关键词的 spec
```

### 小红书实例

小红书的 task spec 使用 `post_relevance`（帖子级）和 `comment_filter`（评论级）两层过滤：

```json
{
  "keyword": "医美",
  "post_relevance": {
    "include": ["医美", "热玛吉", "超声刀", "鼻子", "双眼皮"],
    "exclude": ["避雷", "翻车", "政策", "赛道"]
  },
  "comment_filter": {
    "include": ["多少钱", "想做", "求推荐", "适合做什么"],
    "exclude": ["我是做", "加我", "合作", "私信"]
  },
  "semantic_focus": "只保留明确购买意向用户"
}
```

---

## 六、AI 两阶段筛选

### 通用原则

两阶段筛选的核心思路：**脚本做减法，AI 做判断**。

| 阶段 | 执行者 | 目标 | 特征 |
|------|--------|------|------|
| 粗筛 | Node.js 脚本 | 去除明确的噪声 | 确定性规则，零 AI 成本，毫秒级 |
| 精筛 | AI sub-agent | 语义理解、打分、打标签 | 非确定性，有 token 成本，秒级 |

**为什么不直接全量精筛：**
- 一次采集可能有 500+ 条评论，全量交给 AI 成本高
- 纯表情（"666""👍"）、广告引流（"加我v"）无需 AI 判断
- 粗筛可以过滤掉 30-60% 的无效数据

### 6.1 粗筛（确定性脚本）

**原则：只做减法，不做语义判断。宁可漏筛（让噪声流入精筛），不可误杀（高价值数据被错误过滤）。**

**通用粗筛规则模板：**

```javascript
// 1. 内容为空
if (!content || !content.trim()) return "空内容";

// 2. 来源方自己的回复
if (username === authorName) return "作者回复";

// 3. 纯引用/转发（无实质内容）
const withoutMentions = text.replace(/@[\S]+/g, "").trim();
if (countChinese(withoutMentions) < 2) return "纯引用";

// 4. 纯表情（有效中文字符不足）
const withoutEmoji = text
  .replace(/\[[\u4e00-\u9fffA-Za-z]+R?\]/g, "")  // 平台表情
  .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
  .trim();
if (countChinese(withoutEmoji) < 3 && withoutEmoji.length < 5) return "纯表情";

// 5. 广告引流（关键词匹配）
const AD_PATTERNS = ["加我微信", "免费领取", "点击链接", ...];
if (AD_PATTERNS.some((p) => text.includes(p))) return "广告引流";

// 6. Task Spec 驱动的排除词
const matchedExclude = findMatchedTerms(text, taskSpec.item_filter.exclude);
if (matchedExclude.length > 0) return `命中排除词: ${matchedExclude.join(", ")}`;

// 7. Task Spec 驱动的包含词（如果配了 include，未命中则排除）
const matchedInclude = findMatchedTerms(text, taskSpec.item_filter.include);
if (taskSpec.item_filter.include.length > 0 && matchedInclude.length === 0) {
  return "未命中粗筛包含词";
}

return null; // 保留为候选
```

**粗筛输出格式：**

```json
{
  "keyword": "医美",
  "taskSpecPath": "/abs/path/to/task-spec.json",
  "taskSpec": { ... },
  "posts": [
    {
      "title": "...",
      "url": "...",
      "comments": [
        {
          "username": "...",
          "content": "...",
          "matchedSignals": ["多少钱", "求推荐"],
          "candidateReason": "命中粗筛词"
        }
      ]
    }
  ],
  "skippedPosts": [...],
  "stats": {
    "totalPosts": 10,
    "keptPosts": 8,
    "totalComments": 200,
    "filteredComments": 80,
    "keptComments": 120,
    "filterReasons": { "纯表情": 30, "广告引流": 15, ... }
  }
}
```

### 6.2 精筛（AI 语义分析）

**原则：**
- **per-item 独立判断**：每条数据独立评分，不受其他数据影响
- **结构化输出**：必须输出固定格式（score/tags/reason），不要自由文本
- **禁止用关键词匹配代替语义判断**：task spec 只用于粗筛，精筛必须理解上下文

**Sub-agent Prompt 模板：**

```
你是一个<领域>语义分析 agent，只负责分析一批数据。

任务：
1. 读取以下 task spec 文件，获取 semantic_focus 字段：<task-spec-path>
2. 对以下候选数据逐条进行语义判断（禁止用关键词匹配代替语义判断）：
   - tags: 逗号分隔字符串，如 "购买意向, 咨询"
   - score: 1-10 分
   - reason: 判断理由（一句话）
3. 只保留 score >= <阈值> 的数据
4. 将结果写入指定输出路径（JSON 格式）

数据：
- 源标识: <sourceId>
- 上下文: <标题/描述等上下文信息>
- 候选数据列表: <items-json>

输出格式（写入 <output-path>）：
{
  "sourceId": "<sourceId>",
  "context": "<上下文>",
  "totalItems": <候选总数>,
  "validItems": [
    {
      "id": "...",
      "content": "...",
      "tags": "标签1, 标签2",
      "score": 8,
      "reason": "..."
    }
  ]
}

输出路径：<分片目录>/<sourceId>.json
```

### 6.3 合并

**原则：**
- 按原始数据顺序合并分片（保持可预测的输出）
- 分片缺失时警告但不中断
- 失败率超过 50% 时中止整个流程

```javascript
// merge-analysis.js 核心逻辑
const merged = [];
const missing = [];

for (const source of sources) {
  const shardPath = path.join(postsDir, `${source.id}.json`);
  if (!fs.existsSync(shardPath)) {
    missing.push(source.id);
    continue;
  }
  merged.push(JSON.parse(fs.readFileSync(shardPath, "utf-8")));
}

const failRate = missing.length / sources.length;
if (failRate > 0.5) {
  console.error(`❌ 精筛失败率过高 (${Math.round(failRate * 100)}%)，中止`);
  process.exit(1);
}
```

### 小红书实例

**粗筛结果示例（filter-comments.js）：**

```
✅ 粗筛完成
   帖子: 保留 8 / 10
   总评论: 200
   过滤: 80 (40.0%)
   候选: 120
   过滤原因:
     纯表情: 30
     广告引流: 15
     作者回复: 12
     纯@引用: 8
     未命中粗筛包含词: 15
```

**精筛 sub-agent 输出示例：**

```json
{
  "postId": "6612a...",
  "title": "做了热玛吉三个月后的真实感受",
  "validComments": [
    {
      "username": "小美同学",
      "content": "姐妹这个多少钱啊？在哪做的？效果看着好自然",
      "interestTags": "购买意向, 咨询",
      "interestScore": 8,
      "reason": "明确询问价格和机构，有强烈消费意向"
    }
  ]
}
```

---

## 七、子代理并行分发

### 通用原则

精筛阶段的数据天然按「源」（帖子/页面/文档）独立，适合并行处理。

**分发策略：**

| 平台 | 机制 | 并发控制 |
|------|------|---------|
| Claude Code | Agent tool | MAX_CONCURRENT_AGENTS = 3 |
| Openclaw | Sub-Agent | 同上 |
| 其他平台 | 串行降级 | 逐一处理 |

**关键设计：**

1. **并发上限**：同时运行的 sub-agent 不超过 3 个。超出排队。过多并发会导致上下文爆炸和 token 浪费。
2. **每个 sub-agent 完全独立**：不依赖其他 sub-agent 的输出。
3. **输出分片**：每个 sub-agent 写入独立文件（`<sourceId>.json`），主流程负责合并。
4. **串行降级必须通知用户**：`⚠️ 当前环境不支持并行精筛，改为串行模式，速度较慢。`

### Claude Code Agent Tool 用法

```
对 candidates 中的每个数据源，调用 Agent tool 派出独立 sub-agent：

Agent({
  description: "精筛帖子 <noteId>",
  prompt: "<完整的 sub-agent prompt，包含数据和输出路径>",
  subagent_type: "general-purpose"
})
```

**启动前准备：**

```bash
# 确保分片目录存在且干净（幂等）
mkdir -p "${SKILL_DIR}/data/analysis_posts/<关键词>"
rm -f "${SKILL_DIR}/data/analysis_posts/<关键词>"/*.json
```

### 小红书实例

小红书 skill 的精筛对 candidates 中每篇帖子独立分发 sub-agent。每个 sub-agent 的任务描述包含：

1. Task spec 路径（读取 semantic_focus）
2. 帖子元数据（标题、URL、截图路径）
3. 候选评论 JSON
4. 输出文件路径

所有 sub-agent 完成后，执行 `merge-analysis.js` 合并分片。

**并发限制的理由**：实测发现同时 5+ 个 sub-agent 时，部分 agent 会因上下文竞争超时。3 个是实践中的平衡点。

---

## 八、输出层（可插拔）

### 设计原则

输出生成应该与数据管道解耦。`analysis_<keyword>.json` 是管道的最终产物，输出脚本只负责「格式转换」。

**解耦的好处：**
- 同一份 analysis 可以生成 Excel、PDF、CSV 等多种格式
- 输出脚本可以独立开发和测试，不依赖浏览器
- 换一个 skill（如招聘简历下载），只需替换输出脚本

**输出脚本约定：**

```bash
# 统一接口
node "${SKILL_DIR}/scripts/generate-<format>.js" \
  --input "${SKILL_DIR}/data/analysis_<关键词>.json"

# 输出路径由脚本自动生成
# 格式: output/<keyword>_<YYYYMMDD>_<HH-mm>.<ext>
```

### 两个实例对比

| 维度 | 小红书潜客挖掘 | 招聘简历下载（假想） |
|------|--------------|-------------------|
| 采集目标 | 帖子评论 | 简历页面 |
| 粗筛标准 | 去表情/广告/作者回复 | 去不匹配岗位/过期简历 |
| 精筛标准 | 购买意向评分 | 技能匹配度评分 |
| 输出格式 | Excel 潜客管理表 | PDF 简历文件 + 汇总表 |
| 输出脚本 | generate-excel.js | generate-pdf-bundle.js |

**小红书的 Excel 输出（16 列 4 区域）：**

| 区域 | 列数 | 说明 |
|------|------|------|
| 用户信息 | 3 | 用户名、主页链接、IP属地 |
| 兴趣分析 | 5 | 评论数量、评论内容、得分、标签、理由 |
| 来源帖子 | 5 | 标题、链接、截图、总评论数、采集评论数 |
| 跟进管理 | 3 | 已关注（下拉）、跟进状态（下拉）、负责人 |

**关键实现细节**：
- 同一用户在同一帖子的多条评论合并为一行（`groupCommentsByUser`）
- 帖子截图嵌入 Excel（`wb.addImage`）
- 兴趣得分条件格式（>=8 绿色，>=6 黄色）
- 下拉选择数据验证（已关注、跟进状态）

---

## 附录

### A. SKILL.md 编写 Checklist

写一个新 skill 的 SKILL.md 时，确保包含以下部分：

- [ ] **描述区**（frontmatter）：name、description（触发条件写清楚）
- [ ] **依赖清单**：所有 npm/pip 依赖 + 浏览器依赖
- [ ] **使用方式**：自然语言 + 命令行两种方式
- [ ] **参数表**：所有可调参数、默认值、说明
- [ ] **强制执行规则**：哪些步骤必须自动串联、哪些步骤不允许中断
- [ ] **工作流程**：按步骤编号，每步包含命令模板和输出说明
- [ ] **数据管道总览**：ASCII 流程图
- [ ] **参考文件表**：何时读取什么文件

### B. Execution Checklist 模板

```markdown
# 执行 Checklist

> 每个 Step 完成后必须逐项确认。未勾选的项需要说明原因。

## Step 1: 环境准备
- [ ] 已读取站点经验文件
- [ ] 环境状态确认（依赖 + 浏览器）
- [ ] task spec 已生成并落盘
- [ ] task spec 包含所有必要字段

## Step 2: 数据采集
- [ ] 采集脚本执行成功
- [ ] 输出 JSON 已生成且包含数据
- [ ] 终端输出的数量符合预期

❌ **常见错误**:
- cookie 过期需重新登录
- 搜索页二次登录弹窗
- 数据为空可能是延迟加载

## Step 3: 粗筛
- [ ] 粗筛脚本执行成功
- [ ] 候选文件包含预期字段
- [ ] 过滤统计合理（过滤率 30-60% 为正常）

## Step 4: 精筛
- [ ] 已对候选数据执行语义精筛
- [ ] 每条数据有 score/tags/reason
- [ ] 输出文件格式正确
- [ ] 抽查 3-5 条高分数据确认合理

❌ **常见错误**:
- ⚠️ **禁止用关键词匹配代替语义分析**
- 遗漏嵌套数据中的高价值项

## Step 5: 输出生成
- [ ] ⚠️ **必须调用输出脚本，禁止手写替代代码**
- [ ] 脚本执行成功
- [ ] 输出文件验证通过

## Step 6: 清理与经验更新
- [ ] task spec 已清理
- [ ] 分片目录已清理
- [ ] 新发现已追加到站点经验文件（附日期）
```

### C. 快速启动清单（新建 Skill 的前 10 步）

1. **创建目录结构**
   ```
   .claude/skills/<skill-name>/
   ├── SKILL.md
   ├── package.json
   ├── scripts/
   │   ├── <domain>-scraper.js
   │   ├── human.js              # 可从小红书 skill 直接复制
   │   ├── filter-<data>.js
   │   ├── generate-<output>.js
   │   ├── merge-analysis.js     # 如果有并行精筛
   │   ├── save-task-spec.js
   │   └── cleanup-task-specs.js
   ├── references/
   │   ├── execution-checklist.md
   │   └── site-patterns/
   │       └── <domain>.md       # 从模板创建
   ├── data/                     # 运行时数据（gitignore）
   └── output/                   # 输出文件（gitignore）
   ```

2. **复制 human.js**：延迟常量和滚动算法跨站点通用，可直接复用

3. **创建站点经验文件**：从本文档的模板开始，填写基本的「平台特征」

4. **编写主采集脚本骨架**：
   - CLI 参数解析
   - 浏览器启动（含反检测）
   - Cookie 管理
   - 登录流程
   - 目标页面导航
   - 数据提取（先 hardcode 选择器，后续迭代）

5. **手动跑通一次完整流程**：用 `--headed` 模式观察浏览器行为

6. **编写粗筛脚本**：从通用模板开始，添加站点特有的噪声规则

7. **设计 task spec 结构**：确定 include/exclude 词和 semantic_focus

8. **编写 SKILL.md**：定义完整工作流程和参数

9. **编写 execution-checklist.md**：从模板创建

10. **迭代站点经验**：每次运行后将新发现追加到站点经验文件

---

> **最后提醒**：这份指南基于小红书潜客挖掘 skill 的实战经验。每个目标站点都有自己的特殊性（反爬策略、页面结构、数据格式），但上述 8 个模块的架构模式是通用的。建设新 skill 时，先按模板搭骨架，再针对目标站点逐步填充和迭代。
