# 问题汇总

记录项目开发过程中遇到的问题和解决方案，方便后续归纳总结。

---

## Windows PowerShell 参数传递问题

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright/save-task-spec`  
**状态**: ✅ 已修复

### 问题描述

在 Windows PowerShell 环境下，使用 `--json '<JSON字符串>'` 传递包含中文的 JSON 参数时，JSON 内部的双引号会被 PowerShell 剥离，导致 `JSON.parse()` 解析失败。

例如：
```bash
node save-task-spec.js --keyword "露营装备" --json '{"keyword":"露营装备",...}'
```

实际传递给脚本的是：`{keyword:露营装备,...}`，缺少双引号导致解析错误。

### 解决方案

添加 `--json-file` 参数支持，通过临时文件传递 JSON 数据，避免 PowerShell 对命令行参数的处理问题。

**修改内容**：
- 在 `save-task-spec.js` 中添加 `--json-file` 参数解析
- 实现从文件读取 JSON 的功能
- 保持向后兼容性（优先级：`--json-file` > `stdin` > `--json`）

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/save-task-spec.js`

---

## Windows 文件编码问题

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已修复

### 问题描述

Windows PowerShell 的 `echo` 命令默认使用系统编码（GBK），而非 UTF-8。当使用 stdin 传递包含中文的 JSON 数据时，中文字符会出现乱码。

例如："露营装备" 变成 "闇茶惀瑁呭"。

### 解决方案

采用临时文件方案，配合显式的 UTF-8 编码参数，确保跨平台编码一致性。

**修改内容**：
1. 更新 `SKILL.md` 步骤 1b，改用临时文件方案：
   ```bash
   TEMP_JSON="${SKILL_DIR}/.temp-task-spec-$(date +%s).json"
   echo '<task-spec-json>' > "$TEMP_JSON"
   node save-task-spec.js --keyword "<关键词>" --json-file "$TEMP_JSON"
   rm -f "$TEMP_JSON"
   ```

2. 在 `xhs-scraper.js` 的 cookie 写入处添加 UTF-8 编码参数：
   ```javascript
   fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), "utf-8");
   ```

3. 在 `.gitignore` 中添加临时文件忽略规则：
   ```
   .claude/skills/xiaohongshu-playwright/.temp-*.json
   ```

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/SKILL.md`
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `.gitignore`

---

## INACCESSIBLE_KEYWORDS 未启用检测

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright/xhs-scraper`  
**状态**: ✅ 已修复

### 问题描述

`human.js` 文件中定义并导出了 `INACCESSIBLE_KEYWORDS` 数组（包含"当前笔记暂时无法浏览"、"该笔记已被删除"等关键词），但 `xhs-scraper.js` 在 require 解构中未引入该变量。

导致访问已删除/私密帖子时，脚本会一直滚动到超时才放弃，浪费大量时间。

### 解决方案

在 `xhs-scraper.js` 中启用 `INACCESSIBLE_KEYWORDS` 检测，在访问帖子后立即检测页面是否包含不可访问关键词。

**修改内容**：
1. 在 `xhs-scraper.js` 的 require 语句中添加 `INACCESSIBLE_KEYWORDS` 导入
2. 在 `processPost()` 函数中，goto 完成后、开始滚动前检测页面文本
3. 检测到不可访问关键词后打印警告并返回 null，跳过该帖子

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `.claude/skills/xiaohongshu-playwright/scripts/human.js`

---

## rebrowser-patches 缺失无警告

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright/xhs-scraper`  
**状态**: ✅ 已修复

### 问题描述

`xhs-scraper.js` 在启动时尝试加载 `rebrowser-patches` 反检测补丁，但当该依赖未安装时，catch 块静默跳过，用户无法感知反检测能力已降级。

这会导致在小红书等反爬虫严格的平台上，脚本更容易被检测和封禁，但用户不知道问题所在。

### 解决方案

在 catch 块中添加明确的警告信息，提示用户安装缺失的依赖。

**修改内容**：
```javascript
try {
  require("rebrowser-patches/patch");
} catch {
  console.warn("⚠️  rebrowser-patches 未安装，反检测能力降低");
  console.warn("   建议运行: node scripts/bootstrap-playwright.js");
}
```

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

---

## 提取共享工具模块重构

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

`xhs-scraper.js` 文件有 1564 行代码，包含大量通用工具函数和业务逻辑混杂，导致代码难以维护、复用性差、测试困难。

### 解决方案

采用 5 阶段渐进式重构，将通用工具函数抽离到 lib/ 目录的独立模块。

**修改内容**：
- 创建 lib/utils（string, file, process）
- 创建 lib/playwright（delay, scroll, session, context-recovery）
- 创建 lib/xhs（cookies, data-persistence, parser）
- xhs-scraper.js: 1564行 → 1210行（减少22%）
- 新增 lib 模块: 573行

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `.claude/skills/xiaohongshu-playwright/lib/**/*`

---

## 环境设置参考文档创建

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

SKILL.md 文件包含大量环境设置细节（bootstrap 流程、镜像回退逻辑、package-lock 重建步骤），导致文档冗长（530 行），超出 skill-creator 推荐的 500 行上限。

环境配置细节混杂在主流程中，影响文档可读性和维护性。

### 解决方案

将环境设置细节迁移到独立的参考文档 `references/environment-setup.md`，SKILL.md 保留简洁的流程描述并添加参考链接。

**修改内容**：
1. 创建 `references/environment-setup.md`（4.6KB）：
   - 系统要求
   - 依赖安装（自动化脚本、镜像源策略、依赖重建）
   - 环境验证
   - 常见问题排查（4 个场景）
   - 环境检查清单
   - 首次运行准备

2. 精简 SKILL.md：
   - 步骤 1a：44 行 → 18 行
   - 依赖部分：9 行 → 3 行
   - 总行数：530 → 503 行（减少 27 行）
   - 添加两处参考链接

**效果**：
- 环境设置细节集中管理，便于维护
- SKILL.md 流程更清晰，为后续瘦身打好基础
- 保持文档完整性，无信息丢失

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/SKILL.md`
- `.claude/skills/xiaohongshu-playwright/references/environment-setup.md`

---

## SKILL.md 瘦身与质量提升

**日期**: 2026-03-31  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

SKILL.md 文件有 503 行，虽然通过 Sprint 1.5 减少了 27 行，但仍超出 skill-creator 推荐的 460 行以下目标。

主要问题：
1. 步骤 5 包含 44 行的 sub-agent 完整任务描述模板
2. 步骤 7 包含 Excel 布局的 16 列详细表格说明
3. 部分「强制执行规则」使用刚性 MUST 指令，缺乏 why 解释
4. 「注意事项」段落与其他步骤内容重复

### 解决方案

采用类似 `environment-setup.md` 的方式，将详细内容迁移到独立参考文档，同时优化规则表达方式。

**修改内容**：

1. 创建 `references/subagent-task-template.md`（2.3KB）：
   - 完整的 sub-agent 任务描述模板
   - 占位符替换说明
   - 使用场景和注意事项

2. 创建 `references/excel-format.md`（1.6KB）：
   - 16 列布局详细定义
   - 条件格式规则
   - 下拉选择字段配置

3. 优化「强制执行规则」：
   - Task spec 必须在步骤 3 前完成 → 解释：粗筛脚本需要读取 task spec 字段
   - 并行精筛限制 3 并发 → 解释：超过 3 个会导致上下文窗口争抢
   - 串行降级必须告知用户 → 解释：让用户了解性能差异
   - 每条约束都包含原因说明

4. 精简「注意事项」：
   - 从 6 条减少到 4 条核心提示
   - 移除与步骤 1a、步骤 3 重复的环境配置说明

5. 更新「参考文件」表格：
   - 新增 `environment-setup.md`、`subagent-task-template.md`、`excel-format.md` 三个条目
   - 明确各文档的使用场景

**效果**：
- SKILL.md：503 → 439 行（减少 64 行，达到 skill-creator 推荐标准）
- Sub-agent 模板完整性保留，便于维护和复用
- Excel 格式规范集中管理
- 强制执行规则从刚性指令改为解释性语言，更易理解
- 文档结构更清晰，可读性提升

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/SKILL.md`
- `.claude/skills/xiaohongshu-playwright/references/subagent-task-template.md`
- `.claude/skills/xiaohongshu-playwright/references/excel-format.md`

---

## 完善 Eval 断言

**日期**: 2026-04-01  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

`evals/evals.json` 文件只有 `expected_output` 文本描述，缺少 `assertions` 字段，不符合 skill-creator 的 evals schema 标准，无法进行自动化验证。

### 解决方案

为现有 3 个测试用例添加 `assertions` 数组字段，每个断言明确可验证的输出条件。

**修改内容**：

1. **Eval 1（医美/热玛吉）** - 添加 7 条断言：
   - output/ 目录存在 Excel 文件（文件名包含'热玛吉'）
   - Excel 包含 16 列表头
   - 至少有 1 个用户的 interestScore >= 6
   - data/ 目录存在 analysis_热玛吉.json 文件
   - analysis.json 中 posts 数组长度 <= 5
   - data/comments_热玛吉.json 文件被创建
   - data/screenshots/ 目录包含 .png 截图文件

2. **Eval 2（考研英语）** - 添加 6 条断言：
   - output/ 目录存在 Excel 文件（文件名包含'考研英语'）
   - Excel 中所有用户的 interestScore >= 7
   - data/analysis_考研英语.json 中 posts 数组长度 <= 3
   - analysis.json 的 validComments 中每条都有 interestTags 字段
   - analysis.json 的 validComments 中每条都有 reason 字段
   - 筛选标准应体现'报班意向'和'求资料需求'

3. **Eval 3（多关键词）** - 添加 7 条断言：
   - output/ 目录存在两个独立的 Excel 文件
   - data/ 目录存在 comments_露营装备.json 文件
   - data/ 目录存在 comments_户外徒步.json 文件
   - data/ 目录存在 analysis_露营装备.json 文件
   - data/ 目录存在 analysis_户外徒步.json 文件
   - 脚本执行日志显示使用了 --speed slow 参数
   - 两个关键词的流程均无报错完成

**效果**：
- 符合 skill-creator 的 evals schema 标准
- 支持自动化测试验证
- 覆盖文件输出、数据完整性、参数传递等关键场景
- JSON 格式验证通过

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/evals/evals.json`
---

## 反检测指纹系统优化

**日期**: 2026-04-01  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

反检测指纹系统存在三个 P1 级问题：
1. UA 版本过时（Chrome 124/125，应为 131+）
2. `navigator.platform` 硬编码为 `'MacIntel'`，Windows 机器上与 UA 矛盾
3. `hardwareConcurrency` 和 `deviceMemory` 固定为 8，每次运行指纹完全一致

### 解决方案

实现动态指纹系统，根据 UA 自动匹配 platform 并随机生成硬件参数。

**修改内容**：

1. 更新 `scripts/human.js` 的 USER_AGENTS 列表：
   - Chrome 124/125 → Chrome 131/132
   - 新增 Safari 18.x、Edge 131
   - 覆盖 macOS、Windows、Linux 三平台（7 个 UA）

2. 新增 `getFingerprint(ua)` 函数：
   - 根据 UA 自动返回匹配的 platform（MacIntel/Win32/Linux x86_64）
   - 随机返回 hardwareConcurrency（4/8/12/16）
   - 随机返回 deviceMemory（4/8/16）

3. 修改 `scripts/xhs-scraper.js`：
   - ANTI_DETECT_SCRIPT 改用占位符（__PLATFORM__、__HARDWARE_CONCURRENCY__、__DEVICE_MEMORY__）
   - 浏览器上下文创建后调用 getFingerprint() 获取动态指纹
   - 通过字符串替换注入到反检测脚本

**验证结果**：
- ✅ 语法检查通过
- ✅ getFingerprint() 单元测试通过
- ✅ macOS UA → platform: 'MacIntel'
- ✅ Windows UA → platform: 'Win32'
- ✅ Linux UA → platform: 'Linux x86_64'

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/human.js`
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `eventual-imagining-harbor.md`
- `.codex/skills/xiaohongshu-playwright/ISSUES.md`

---

## Sprint 4.3 搜索排序和时间筛选

**日期**: 2026-04-26  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

搜索只使用默认排序（综合），无法按热度或时间筛选，导致错过高质量内容或时效性内容。

### 解决方案

添加 `--sort` 和 `--time-range` CLI 参数，映射到小红书搜索 URL 的查询参数。

**修改内容**：

1. `scripts/xhs-scraper.js` — `parseArgs()` 新增两个选项：
   - `sort`（默认 `general`）
   - `timeRange`（默认 `all`）

2. switch case 解析 `--sort` 和 `--time-range`

3. `searchPosts()` 函数签名增加两个新参数，构建 URL 时映射：
   - `general` → `sort=general`
   - `hot` → `sort=popularity_descending`
   - `new` → `sort=time_descending`
   - `timeRange` 非 `all` 时追加 `&search_filter_time=1d|1w|6m`

4. `SKILL.md` — 步骤 3 CLI 参数表新增 `--sort` 和 `--time-range` 说明

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `.claude/skills/xiaohongshu-playwright/SKILL.md`


**日期**: 2026-04-01  
**模块**: `xiaohongshu-playwright`  
**状态**: ✅ 已完成

### 问题描述

`searchPosts` 只加载搜索结果首屏，`maxPosts=10` 但首屏不足 10 篇时无法补足。

### 解决方案

添加滚动加载循环，自动滚动直到收集够候选帖子或无新结果。

**修改内容**：
- `scripts/xhs-scraper.js` — searchPosts 添加 while 循环（最多 10 次）
- 每轮按 noteId 去重合并，用 `prevCount` 对比检测是否有新帖子
- 无新增时立即 break，避免无效滚动触发风控（修复 Codex P2）

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

---

## 模块导入函数名不一致导致运行时错误

**日期**: 2026-04-01  
**模块**: `xiaohongshu-playwright/xhs-scraper`  
**状态**: ✅ 已修复

### 问题描述

`xhs-scraper.js` 从 `lib/xhs` 和 `lib/playwright` 模块导入函数时，使用了带 `FromModule` 后缀的别名（如 `loadExistingDataFromModule`），但在代码中调用时使用了不带后缀的函数名（如 `loadExistingData`），导致运行时报错 `is not defined`。

具体错误：
1. `loadExistingData is not defined` (line 1138)
2. `applyPreGotoHumanDelay is not defined` (line 933)
3. `appendPostResult is not defined` (line 1194)

### 根本原因

重构时将函数抽离到 lib 模块，导入时为避免命名冲突添加了 `FromModule` 后缀，但忘记更新调用处的函数名。

### 解决方案

统一函数调用名称，使用导入时的别名。

**修改内容**：

1. 修复 `loadExistingData` 调用：
```javascript
// 修改前
const { existingPosts, collectedUrls } = loadExistingData(opts.output, opts.keyword);

// 修改后
const { existingPosts, collectedUrls } = loadExistingDataFromModule(opts.output, opts.keyword);
```

2. 补充缺失的 `applyPreGotoHumanDelay` 和 `applyPostGotoHumanDelay` 导入：
```javascript
const {
  applyPreGotoHumanDelay,
  applyPostGotoHumanDelay,
  getScrollMetrics,
  // ...其他导入
} = require("../lib/playwright");
```

3. 修复 `appendPostResult` 调用：
```javascript
// 修改前
const saved = appendPostResult(opts.output, opts.keyword, postResult);

// 修改后
const saved = appendPostResultFromModule(opts.output, opts.keyword, postResult);
```

**相关文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`

**经验教训**：
- 重构时应使用 IDE 的重命名功能或全局搜索替换，避免遗漏
- 导入别名应保持简洁，避免不必要的后缀
- 建议在重构后运行完整测试验证



## 新电脑首次运行卡死问题

**日期**: 2026-04-01  
**状态**: 已修复  
**模块**: xiaohongshu-playwright

### 问题描述

在空白电脑上首次执行 skill 时流程卡死，报错：
- `references/site-patterns/xiaohongshu.md` 缺失
- `node_modules` 未安装（exceljs、rebrowser-patches 不可用）

### 根本原因

**步骤 1a 逻辑缺陷**：直接要求"读取 `xiaohongshu.md`"，但新电脑上该文件不存在，导致流程无法继续。

### 修复方案

修改步骤 1a 为三段式检查：

```bash
# 1. 文件不存在 → 创建默认文件 + 执行安装
# 2. 文件存在但未就绪 → 执行安装  
# 3. 文件存在且已就绪 → 跳过
```

新增自动创建默认 `xiaohongshu.md` 的逻辑，包含：
- 本地环境状态（未设置）
- 用户习惯（未设置）
- 已知选择器（默认值）

### 修复位置

- **文件**: `skill.md` 步骤 1a 部分
- **改动**: 增加文件不存在时的创建逻辑

### 验证方法

在全新电脑上运行，应自动：
1. 创建 `references/site-patterns/xiaohongshu.md`
2. 执行 `bootstrap-playwright.js` 安装依赖
3. 正常进入后续流程


## Windows 环境 bootstrap 脚本报错

  **日期**: 2026-04-01
  **状态**: 已修复
  **模块**: xiaohongshu-playwright

  ### 问题描述

  在 Windows 环境运行 `bootstrap-playwright.js` 时报错：
  ```
  spawnSync npm.cmd EINVAL
  ```

  ### 根本原因

  `spawnSync` 在 Windows 上执行 `.cmd` 文件时，需要 `shell: true` 选项才能正确调用。

  ### 修复方案

  在 `runCommand` 函数的 `spawnSync` 调用中添加：
  ```javascript
  shell: process.platform === "win32"
  ```



## 扫码登录误判问题（登录态检测失效）

日期: 2026-04-03
模块: xiaohongshu-playwright / xhs-scraper.js
状态: ✅ 已修复

### 问题描述

扫码登录成功后，脚本仍判断"未登录"，一直等到 5 分钟超时才退出。

根因：登录态判定依赖 `document.cookie.includes("customer_id")`，但小红书的 `customer_id`、`access-token` 等认证 cookie 极可能是 `HttpOnly`。`document.cookie` 无法读取 `HttpOnly` cookie，导致检测逻辑天然为 `false`，即使扫码成功也无法退出轮询。

次因：轮询内的 `page.evaluate()` 无 try/catch，扫码后页面跳转时容易抛出 `Execution context was destroyed` 异常，将整个轮询打崩。

### 解决方案

**修改 1 — 登录判定从 document.cookie 改为 context.cookies()**
- 位置：`scripts/xhs-scraper.js` 约 411–444行（`manualLogin()` while 循环内）
- 核心逻辑改为：
  ```javascript
  const cookies = await context.cookies("https://www.xiaohongshu.com");
  const authCookieNames = ["customer_id", "web_session", "access-token", "galaxy_cookie"];
  const hasAuthCookie = cookies.some(c => authCookieNames.includes(c.name));
  ```
- `context.cookies()` 能读取 HttpOnly cookie，是解决根因的关键
- 降级方案：cookie 层没有时再看 DOM 层，防止误判

**修改 2 — page.evaluate() 加 try/catch 防崩溃**
- 位置：同上 while 循环内
- 捕获 `Execution context was destroyed` 等异常后继续轮询，不打崩登录流程

**修改 3 — 二维码输出路径规范化**
- 位置：`scripts/xhs-scraper.js` 约 393行
- 删掉 `openFile(qrPath)`（无头环境下 xdg-open 可能静默失败）
- 改为 `fs.copyFileSync(qrPath, "/tmp/xhs_qr.png")` + `console.log("[QR_CODE_PATH]:/tmp/xhs_qr.png")`
- 上层 Playwright/Agent 可通过解析 `[QR_CODE_PATH]:` 前缀稳定获取二维码路径

**修改 4 — storageState() 双重持久化**
- 位置：3处登录成功/退出的位置（约 455行、498行、1262行）
- 原来只存 cookie，现在同时保存 `context.storageState()`
- storageState 路径：`data/storage_state.json`
- 效果：恢复会话时更完整，还原 cookie + localStorage + sessionStorage

**效果**：
- 扫码后登录态检测从"永远误判 false"变为"正确识别 HttpOnly cookie"
- 轮询异常不再打崩流程
- 二维码路径投递链路稳定
- 会话恢复完整性提升

**相关文件**：
- scripts/xhs-scraper.js

---

## IP 风控导致 error_code=300012

日期: 2026-04-03
模块: xiaohongshu-playwright / xhs-scraper.js
状态: ⚠️ 已知问题（需用户介入）

### 问题描述

脚本登录成功（cookie 有效），但打开搜索页时直接被小红书重定向到错误页：

```
https://www.xiaohongshu.com/website-login/error?...&error_code=300012&error_msg=IP存在风险
```

这是**纯 IP 层面风控**，与账号无关。腾讯云轻量应用服务器等 IDC 出口 IP 段被小红书批量标记为爬虫/机器人高风险 IP，服务端直接拒绝。

### 症状

1. `checkLogin()` 通过（cookie 有效）
2. `manualLogin()` 不触发（已登录）
3. `searchPosts()` 打开搜索页时被重定向到错误 URL
4. 错误 URL 包含 `error_code=300012`
5. 页面内容为"IP存在风险，请切换可靠网络环境后重试"

### 解决方案

**代码层面无法绕过**（服务端根据真实出口 IP 拦截，UA/Header/Referrer 均无效）。

必须换 IP，方案如下：

| 方案 | 成本 | 可靠性 | 难度 |
|------|------|--------|------|
| 住宅代理（芝麻/快代理等）| 低（按流量） | 中高 | 低，一行配置 |
| 手机热点 SSH 隧道 | 零 | 低 | 中 |
| VPN 隧道到家庭宽带 | 低 | 高 | 高 |

**推荐步骤**：
1. 购买住宅代理（国内节点）
2. 在 `chromium.launch()` 中配置 `proxy` 参数
3. 验证搜索页可正常加载后再按流量/时长续费

### SKILL.md 错误处理规则

当脚本输出/页面 URL 包含 `error_code=300012` 或 `error_msg=IP存在风险` 时：
- **必须**立即告知用户这是 IP 风控，停止发二维码
- 告知用户这是云服务器 IP 被封，需要住宅代理或换网络
- 提供上述解决方案供用户选择
- **不得**继续重试登录流程（会循环失败）

**相关文件**：
- scripts/xhs-scraper.js（搜索流程中无专门拦截，需上层 AI 判断 URL 特征）
- SKILL.md（二维码推送规则 + 错误识别规则）

---
