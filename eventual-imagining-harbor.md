# xiaohongshu-playwright Skill 优化方案

## Context

xiaohongshu-playwright 是一个基于 Playwright 的小红书潜客挖掘工具，已经过近一周的密集开发（worker page 重构、增量保存、安全上下文包装等）。当前功能基本可用，但存在 3 个 P0 级数据完整性问题、反检测指纹过时、SKILL.md 超出 skill-creator 推荐的 500 行上限、测试用例缺少断言等问题。

本方案基于 skill-creator 指南的质量标准，按优先级分 4 个 Sprint 推进优化。

---

## Sprint 1：P0 关键修复 + 工程基础

> 目标：修复三个直接导致数据丢失或资源浪费的 P0 问题，同时提取重复代码为共享模块。
> 预计：5 个独立任务，可全部并行。

### 1.1 启用 INACCESSIBLE_KEYWORDS 检测

**问题**：`human.js:42-52` 导出了 `INACCESSIBLE_KEYWORDS`，但 `xhs-scraper.js:24-37` 的 require 解构中未引入，导致访问已删除/私密帖子时白白滚动到超时。

**改动**：
- `scripts/xhs-scraper.js` — 在 require 解构中加入 `INACCESSIBLE_KEYWORDS`
- 在帖子页面 goto 完成后、开始滚动前，检测页面文本是否包含不可访问关键词，命中则 log 并跳过
- 复杂度：**小**

### 1.2 添加验证码检测与暂停

**问题**：遇到滑块验证码后脚本盲目继续滚动直到超时。

**改动**：
- `scripts/xhs-scraper.js` — 新增 `detectCaptcha(page)` 函数
- 检测选择器：`#captcha-div`, `.verify-bar--slider`, `[class*="captcha"]`, `[class*="verify"]`
- 检测到后：headed 模式暂停等待用户手动处理（轮询检测消失）；headless 模式打印提示并退出
- 在 `loadAllComments` 滚动循环和 `processPost` 入口处调用
- 复杂度：**中**

### 1.3 rebrowser-patches 强制警告

**问题**：`xhs-scraper.js:14-19` 中 rebrowser-patches 未安装时静默跳过，用户不知道反检测失效。

**改动**：
- `scripts/xhs-scraper.js` — catch 块中打印明确警告 `⚠️ rebrowser-patches 未安装，反检测能力降低，建议运行 node scripts/bootstrap-playwright.js`
- 复杂度：**小**

### 1.4 提取共享工具模块

**问题**：`sanitizeKeywordForFilename`、`normalizeStringArray` 等函数在 3+ 个脚本中重复定义。

**改动**：
- 新建 `scripts/utils.js` — 收录：
  - `sanitizeKeywordForFilename(kw)` （来自 xhs-scraper.js、save-task-spec.js、cleanup-task-specs.js）
  - `normalizeStringArray(arr)` （来自 xhs-scraper.js、filter-comments.js、save-task-spec.js）
  - `extractNoteId(url)` （来自 xhs-scraper.js、merge-analysis.js）
- 更新所有引用脚本的 require 语句
- 复杂度：**中**

### 1.5 创建环境设置参考文档 ✅

**目的**：为 Sprint 2 的 SKILL.md 瘦身做准备，将 bootstrap 流程和环境检查细节提前迁移。

**改动**：
- 新建 `references/environment-setup.md` — 从 SKILL.md 步骤 1a 的详细安装流程、镜像回退逻辑、package-lock 重建步骤迁移过来
- SKILL.md 步骤 1a 改为简短描述 + 指向此参考文件
- 复杂度：**小**

**完成情况**：
- ✅ 创建 `references/environment-setup.md`（4.6KB，包含 6 个章节）
- ✅ 精简 SKILL.md 步骤 1a（从 44 行减少到 18 行）
- ✅ 精简 SKILL.md 依赖部分（从 9 行减少到 3 行）
- ✅ SKILL.md 总行数：530 → 503 行（减少 27 行）
- ✅ 两处添加参考链接指向新文档

**验证**：
- `node -c scripts/xhs-scraper.js` 语法检查通过
- `node -c scripts/utils.js` 语法检查通过
- `node -e "require('./scripts/utils')"` 模块加载正常
- 用一个已知已删除的帖子 URL 测试不可访问检测是否跳过

---

## Sprint 2：数据完整性 + SKILL.md 瘦身

> 目标：解决最严重的 P0 #1（`__INITIAL_STATE__` 数据断裂）；将 SKILL.md 压缩到 460 行以下。
> 预计：2 个任务串行执行（先数据修复，再文档优化）。

### 2.1 添加评论 API 拦截 + DOM 降级提取

**问题**：脚本通过 DOM 滚动触发评论加载，但只从 `__INITIAL_STATE__` 提取数据。滚动加载的评论通过 XHR 追加到 DOM 但不一定回写到 state，导致大量评论丢失。

**改动**：
- `scripts/xhs-scraper.js` — 在 `processPost` 中添加 `page.on('response')` 监听评论 API 响应
  - 拦截 URL 匹配 `/api/sns/web/v2/comment/` 的响应
  - 解析 JSON，累积到 `apiComments` 数组
- 添加 DOM 降级提取函数 `extractCommentsFromDOM(page)`
  - 选择器：`.comment-item` 或 `.note-comment` 内的用户名、内容、IP 等
- 在 `extractComments` 中实现三源合并：
  1. `__INITIAL_STATE__` 数据（现有逻辑）
  2. API 拦截数据（新增）
  3. DOM 提取数据（降级后备）
  - 按 `userId + content` 去重合并
- 复杂度：**大**（核心改动，需要仔细处理 XHS API 的响应格式变化）

**降级策略**：如果 XHS API 接口格式变更导致拦截失败，仍可依赖 `__INITIAL_STATE__` + DOM 双源提取。

### 2.2 SKILL.md 瘦身与质量提升

**问题**：当前 521 行，超出 skill-creator 推荐的 500 行上限。部分内容过于实现细节化，且存在刚性的 MUST 指令缺乏 why 解释。

**改动**：
- 将步骤 1a 的详细 bootstrap 流程迁移到 `references/environment-setup.md`（Sprint 1.5 已创建）
- 将步骤 7 的 Excel 布局 16 列详细表格迁移到 `references/excel-format.md`
- 精简步骤 5 的 sub-agent 完整任务描述模板（保留关键字段，去除冗余注释）
- 将「强制执行规则」中的刚性 MUST 改为解释性语言：
  - 原文：`必须先生成 task spec（步骤 1b）` → 改为解释：`task spec 在步骤 3 的脚本中作为输入必需，所以需要在步骤 3 前就绪`
  - 原文：`步骤 5 并行精筛最多同时运行 3 个 sub-agent` → 解释：`限制 3 并发是因为超过 3 个 sub-agent 会导致上下文窗口争抢，反而降低精筛质量`
- 目标：压缩到 ~450 行
- 复杂度：**中**

**验证**：
- 用已有的 `data/comments_留学.json` 做 dry-run，对比新旧提取逻辑的评论数量差异
- `wc -l SKILL.md` 确认行数 < 460
- 通读 SKILL.md 确认流程完整、无遗漏步骤

---

## Sprint 3：反检测加固 + 测试体系

> 目标：更新过时的反检测指纹；按 skill-creator 标准完善 eval 断言和触发描述。
> 预计：3 个独立任务可并行。

### 3.1 更新反检测指纹系统

**改动**：
- `scripts/human.js` — 更新 `USER_AGENTS` 列表：
  - Chrome 124/125 → Chrome 131/132（2026 年当前主流版本）
  - 保留 macOS、Windows、Linux 三平台覆盖
  - 增加 Safari 18.x、Edge 131 各一条
- `scripts/human.js` — 新增 `getFingerprint(ua)` 函数：
  - 根据 UA 字符串自动返回匹配的 `navigator.platform`（Windows → "Win32"，macOS → "MacIntel"，Linux → "Linux x86_64"）
  - 随机返回 `hardwareConcurrency`（从 [4, 8, 12, 16] 中选取）
  - 随机返回 `deviceMemory`（从 [4, 8, 16] 中选取）
- `scripts/xhs-scraper.js` — 用 `getFingerprint()` 替换硬编码的 platform/hardware 值
- 复杂度：**中**

### 3.2 完善 Eval 断言

**改动**：
- `evals/evals.json` — 为现有 3 个测试用例添加 assertions 字段：

**Eval 1（医美/热玛吉）断言**：
```
- 生成的 Excel 文件存在于 output/ 目录
- Excel 包含 16 列表头
- 至少有 1 个用户的 interestScore >= 6
- analysis.json 中 posts 数量 <= 5
- data/comments_热玛吉.json 文件被创建
- data/screenshots/ 目录包含 .png 文件
```

**Eval 2（考研英语，>=7 阈值）断言**：
```
- Excel 中所有用户的 interestScore >= 7（无 <7 的行）
- analysis.json 中 posts 数量 <= 3
- validComments 中每条都有 interestTags 和 reason 字段
```

**Eval 3（多关键词）断言**：
```
- 生成两个独立的 Excel 文件（露营装备 + 户外徒步）
- 两个 comments.json 文件分别创建
- xhs-scraper.js 使用了 --speed slow 参数
```

- 复杂度：**小**

### 3.3 描述优化 + 触发评估

**改动**：
- 创建 20 条触发评估查询（10 should-trigger + 10 should-not-trigger）
- 优化 description 字段，增加更多触发边界场景描述
- 当前描述已不错，主要补充：
  - 英文触发场景（"find potential customers on Xiaohongshu"）
  - 间接表达（"我想了解某领域的用户画像"、"市场调研"）
  - 竞品 skill 区分（与 xiaohongshu-python、xiaohongshu-browser-use 的边界）
- 运行 skill-creator 的 `run_loop.py` 做描述优化
- 复杂度：**中**

**验证**：
- 断言格式符合 `references/schemas.md` 的 evals schema
- 触发评估的 should-trigger 查询实际触发率 > 80%
- should-not-trigger 查询误触发率 < 20%

---

## Sprint 4：健壮性 + 工程质量

> 目标：提升长时间运行稳定性，添加便捷开发工具。
> 预计：4 个独立任务可并行。

### 4.1 搜索结果翻页加载

**问题**：当前只加载搜索第一屏，`maxPosts=10` 但首屏不足 10 篇时无法补足。

**改动**：
- `scripts/xhs-scraper.js` 的 `searchPosts()` 函数 — 添加搜索结果页滚动加载逻辑
- 滚动搜索结果容器，等待新卡片出现，直到收集够 `2 × maxPosts` 候选帖子或无更多结果
- 复杂度：**中**

### 4.2 运行中登录态监控

**问题**：长时间运行过程中 cookie 可能过期，但不会重新检测。

**改动**：
- `scripts/xhs-scraper.js` — 在主循环每处理 N 篇帖子（N = 5）后，快速检查登录态
- 检测方式：检查页面是否出现登录弹窗或 cookie 中 `web_session` 是否还在
- 失效时触发重新登录流程
- 复杂度：**中**

### 4.3 搜索排序和时间筛选

**改动**：
- `scripts/xhs-scraper.js` — 添加 `--sort` CLI 参数（综合/最热/最新）和 `--time-range` 参数（一天内/一周内/半年内）
- 映射到小红书搜索 URL 的 `sort` 和 `search_filter_time` 查询参数
- `scripts/human.js` — SKILL.md 参数表更新
- 复杂度：**小**

### 4.4 npm scripts + 冒烟测试

**改动**：
- `package.json` — 添加便捷脚本：
  ```json
  "scripts": {
    "scrape": "node scripts/xhs-scraper.js",
    "filter": "node scripts/filter-comments.js",
    "excel": "node scripts/generate-excel.js",
    "bootstrap": "node scripts/bootstrap-playwright.js",
    "smoke": "node scripts/smoke-test.js"
  }
  ```
- 新建 `scripts/smoke-test.js` — 基础冒烟测试：
  - 验证所有脚本可加载（`require()`不报错）
  - 验证 `--help` 参数输出正常
  - 验证 utils.js 的每个函数基本行为
  - 验证 task-spec 的创建和清理
- 复杂度：**小**

**验证**：
- `npm run smoke` 全部通过
- 用 `--max-posts 1 --speed slow` 做单帖端到端测试
- `node -c scripts/*.js` 所有脚本语法检查通过

---

## 关键文件清单

| 文件 | Sprint | 改动类型 |
|------|--------|---------|
| `scripts/xhs-scraper.js` | 1,2,3,4 | 核心改动（检测、API 拦截、指纹、翻页） |
| `scripts/human.js` | 3 | UA 更新 + getFingerprint() |
| `scripts/utils.js` | 1 | **新建**，共享工具函数 |
| `scripts/smoke-test.js` | 4 | **新建**，冒烟测试 |
| `scripts/filter-comments.js` | 1 | require 改用 utils.js |
| `scripts/save-task-spec.js` | 1 | require 改用 utils.js |
| `scripts/cleanup-task-specs.js` | 1 | require 改用 utils.js |
| `scripts/merge-analysis.js` | 1 | require 改用 utils.js |
| `SKILL.md` | 2,3 | 瘦身 + 描述优化 |
| `ISSUES.md` | 每个 Sprint | 标记已修复项 |
| `evals/evals.json` | 3 | 添加 assertions |
| `references/environment-setup.md` | 1 | **新建**，bootstrap 详情 |
| `references/excel-format.md` | 2 | **新建**，Excel 布局详情 |
| `package.json` | 4 | 添加 npm scripts |

## 复用现有资产

- `processPostWithRetry()` — 已有 3 次重试 + 限流退避，ISSUES.md #13 已部分解决，无需重写
- `appendPostResult()` — 已有增量保存，ISSUES.md #8 已修复，无需改动
- `probeDetailSession()` / `safeEval()` / `safeLocatorOp()` — 近期添加的安全包装函数，Sprint 2 的 API 拦截可复用这些模式
- `INACCESSIBLE_KEYWORDS` — 已定义好完整关键词列表，只需在 scraper 中引入使用

## 不在此方案范围内

以下 P3 功能暂不纳入，等 P0-P2 修复验证后再评估：
- 用户画像增强（抓取粉丝数/笔记数）— 需要额外页面访问，增加风控风险
- 终端 QR 码显示 — 需要新依赖 qrcode-terminal
- 代理/IP 轮换 — 架构变更较大
- CSV 导出 — 优先级低
- 跨关键词用户去重 — 需要跨 Excel 文件合并逻辑
