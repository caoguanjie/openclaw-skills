# Sprint 1.4: 提取共享工具模块重构方案

## Context

### 问题背景
`xhs-scraper.js` 文件当前有 **1564 行代码**，包含大量通用工具函数和业务逻辑混杂在一起，导致：
1. **代码难以维护**：单文件过大，难以快速定位和修改
2. **代码重复**：`normalizeStringArray` 等函数在多个脚本中重复定义
3. **复用性差**：通用工具函数无法被其他脚本（如未来的微博、抖音 scraper）复用
4. **测试困难**：业务逻辑和工具函数耦合，难以单独测试

### 重构目标
- 将 xhs-scraper.js 从 **1564 行减少到约 400 行**（减少 74%）
- 提取约 **600 行通用代码**到独立模块
- 提高代码复用性、可维护性和可测试性
- 为未来扩展其他平台 scraper 奠定基础

---

## 目录结构设计

```
.claude/skills/xiaohongshu-playwright/
├── scripts/
│   ├── xhs-scraper.js          (~400 行，核心业务逻辑)
│   ├── filter-comments.js      (保持不变)
│   ├── save-task-spec.js       (保持不变)
│   └── bootstrap-playwright.js (保持不变)
├── lib/
│   ├── utils/                  (通用工具，跨平台复用)
│   │   ├── string.js           (字符串处理)
│   │   ├── file.js             (文件操作)
│   │   ├── process.js          (进程管理)
│   │   └── index.js            (导出汇总)
│   ├── playwright/             (Playwright 专用工具)
│   │   ├── delay.js            (人类化延迟)
│   │   ├── scroll.js           (滚动操作)
│   │   ├── session.js          (会话探测)
│   │   ├── context-recovery.js (上下文恢复)
│   │   └── index.js            (导出汇总)
│   └── xhs/                    (小红书业务工具)
│       ├── cookies.js          (Cookie 管理)
│       ├── data-persistence.js (数据持久化)
│       ├── parser.js           (数据解析)
│       └── index.js            (导出汇总)
└── data/
    └── ...
```

---

## 模块划分详细设计

### 1. utils/string.js (字符串处理)
**职责**：字符串解析和转换

**函数列表**：
- `extractNoteId(urlOrText)` - 从 URL/文本提取 noteId
- `sanitizeKeywordForFilename(keyword)` - 关键词转文件名
- `normalizeStringArray(value)` - 数组规范化

**导出方式**：
```javascript
module.exports = {
  extractNoteId,
  sanitizeKeywordForFilename,
  normalizeStringArray
};
```

---

### 2. utils/file.js (文件操作)
**职责**：文件读写和跨平台操作

**函数列表**：
- `loadJsonFile(filePath)` - 加载 JSON 文件
- `openFile(filePath)` - 跨平台打开文件

**依赖**：
- `fs`, `path`, `child_process`

**导出方式**：
```javascript
module.exports = {
  loadJsonFile,
  openFile
};
```

---

### 3. utils/process.js (进程管理)
**职责**：子进程执行

**函数列表**：
- `runNodeScript(scriptPath, args = [])` - 运行 Node 脚本

**依赖**：
- `child_process`

**导出方式**：
```javascript
module.exports = {
  runNodeScript
};
```

---

### 4. playwright/delay.js (人类化延迟)
**职责**：模拟人类操作延迟

**函数列表**：
- `applyPreGotoHumanDelay(page)` - goto 前的人类化延迟 + 随机滚动
- `applyPostGotoHumanDelay()` - goto 后的人类化延迟

**依赖**：
- `human.js` 的 `sleepRandom`, `randomInt`

**导出方式**：
```javascript
module.exports = {
  applyPreGotoHumanDelay,
  applyPostGotoHumanDelay
};
```

---

### 5. playwright/scroll.js (滚动操作)
**职责**：页面滚动和评论区定位

**函数列表**：
- `getScrollMetrics(page, containerSelector = null)` - 获取滚动指标
- `performScroll(page, delta, containerSelector = null)` - 执行滚动
- `humanScroll(page, options = {})` - 人类化滚动（含回溯逻辑）
- `scrollToCommentsArea(page)` - 滚动到评论区

**依赖**：
- `human.js` 的滚动相关函数

**导出方式**：
```javascript
module.exports = {
  getScrollMetrics,
  performScroll,
  humanScroll,
  scrollToCommentsArea
};
```

---

### 6. playwright/session.js (会话探测)
**职责**：探测页面会话状态

**函数列表**：
- `probeDetailSession(page)` - 探测详情页会话状态

**返回值**：
```javascript
{
  hasLoginModal: boolean,
  hasRateLimit: boolean,
  hasInaccessible: boolean
}
```

**导出方式**：
```javascript
module.exports = {
  probeDetailSession
};
```

---

### 7. playwright/context-recovery.js (上下文恢复)
**职责**：处理页面上下文丢失和错误恢复

**函数列表**：
- `recoverOrThrow(page, error, context)` - 会话恢复或抛出错误
- `safeEval(page, fn, ...args)` - 安全执行 page.evaluate
- `safeLocatorOp(locator, operation, ...args)` - 安全执行 locator 操作

**依赖**：
- `playwright/session.js` 的 `probeDetailSession`

**导出方式**：
```javascript
module.exports = {
  recoverOrThrow,
  safeEval,
  safeLocatorOp
};
```

---

### 8. xhs/cookies.js (Cookie 管理)
**职责**：小红书 Cookie 加载和保存

**函数列表**：
- `loadCookies(cookiePath)` - 加载 cookie
- `saveCookies(context, cookiePath)` - 保存 cookie

**依赖**：
- `fs`, `path`

**导出方式**：
```javascript
module.exports = {
  loadCookies,
  saveCookies
};
```

---

### 9. xhs/data-persistence.js (数据持久化)
**职责**：小红书采集数据的增量保存

**函数列表**：
- `loadExistingData(outputPath)` - 加载已有采集数据
- `appendPostResult(outputPath, postData)` - 增量保存帖子结果

**依赖**：
- `fs`, `path`

**导出方式**：
```javascript
module.exports = {
  loadExistingData,
  appendPostResult
};
```

---

### 10. xhs/parser.js (数据解析)
**职责**：解析小红书页面数据

**函数列表**：
- `parseStateComments(stateJson)` - 从 __INITIAL_STATE__ 解析评论

**导出方式**：
```javascript
module.exports = {
  parseStateComments
};
```

---

## 重构步骤（5 阶段渐进式）

### 阶段 1：创建目录结构（5 分钟）
**操作**：
```bash
mkdir -p .claude/skills/xiaohongshu-playwright/lib/{utils,playwright,xhs}
touch .claude/skills/xiaohongshu-playwright/lib/utils/{string,file,process,index}.js
touch .claude/skills/xiaohongshu-playwright/lib/playwright/{delay,scroll,session,context-recovery,index}.js
touch .claude/skills/xiaohongshu-playwright/lib/xhs/{cookies,data-persistence,parser,index}.js
```

**验证**：
```bash
tree .claude/skills/xiaohongshu-playwright/lib
```

---

### 阶段 2：抽离通用工具模块（30 分钟）
**优先级**：P0（低风险，零依赖）

**操作顺序**：
1. 创建 `utils/string.js`，复制 `extractNoteId`, `sanitizeKeywordForFilename`, `normalizeStringArray`
2. 创建 `utils/file.js`，复制 `loadJsonFile`, `openFile`
3. 创建 `utils/process.js`，复制 `runNodeScript`
4. 创建 `utils/index.js`，汇总导出
5. 在 `xhs-scraper.js` 顶部添加：
   ```javascript
   const { extractNoteId, sanitizeKeywordForFilename, normalizeStringArray } = require("../lib/utils/string");
   const { loadJsonFile, openFile } = require("../lib/utils/file");
   const { runNodeScript } = require("../lib/utils/process");
   ```
6. 注释掉原函数定义（不删除，保留备份）

**验证**：
```bash
node .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js --help
```

---

### 阶段 3：抽离 Playwright 工具模块（1 小时）
**优先级**：P1（中风险，依赖 human.js）

**操作顺序**：
1. 创建 `playwright/delay.js`，复制 `applyPreGotoHumanDelay`, `applyPostGotoHumanDelay`
2. 创建 `playwright/scroll.js`，复制滚动相关函数
3. 创建 `playwright/session.js`，复制 `probeDetailSession`
4. 创建 `playwright/context-recovery.js`，复制恢复相关函数
5. 创建 `playwright/index.js`，汇总导出
6. 在 `xhs-scraper.js` 中添加导入
7. 注释掉原函数定义

**验证**：
```bash
# 运行一个简单的搜索任务
node .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js \
  --keyword "测试" --max-posts 1 --max-comments 5
```

---

### 阶段 4：抽离小红书业务模块（45 分钟）
**优先级**：P1（中风险，XHS 特定）

**操作顺序**：
1. 创建 `xhs/cookies.js`，复制 `loadCookies`, `saveCookies`
   - ⚠️ **重要**: 抽离 `saveCookies()` 时，必须保留 `fs.writeFileSync()` 的第三个参数 `"utf-8"`
   - 这是为了解决 Windows 文件编码问题（参见 ISSUE.md #2）
   - 正确示例：`fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), "utf-8");`
2. 创建 `xhs/data-persistence.js`，复制 `loadExistingData`, `appendPostResult`
3. 创建 `xhs/parser.js`，复制 `parseStateComments`
4. 创建 `xhs/index.js`，汇总导出
5. 在 `xhs-scraper.js` 中添加导入
6. 注释掉原函数定义

**验证**：
```bash
# 运行完整的采集任务
node .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js \
  --keyword "露营" --max-posts 3 --max-comments 10
```

---

### 阶段 5：清理与优化（1 小时）
**优先级**：P2（低风险，收尾工作）

**操作**：
1. 删除 `xhs-scraper.js` 中被注释的原函数定义
2. 整理导入语句顺序（external → lib → local）
3. 更新 `xhs-scraper.js` 顶部注释，说明模块化结构
4. 检查是否有遗漏的可抽离函数
5. 统一代码风格（缩进、空行、注释）

**验证**：
```bash
# 统计代码行数
wc -l .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
wc -l .claude/skills/xiaohongshu-playwright/lib/**/*.js

# 运行完整测试
node .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js \
  --keyword "露营装备" --max-posts 5 --max-comments 20
```

---

## 关键文件路径

**主要修改文件**：
- `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js` (1564 行 → ~400 行)

**新增文件**（共 13 个）：
- `.claude/skills/xiaohongshu-playwright/lib/utils/string.js`
- `.claude/skills/xiaohongshu-playwright/lib/utils/file.js`
- `.claude/skills/xiaohongshu-playwright/lib/utils/process.js`
- `.claude/skills/xiaohongshu-playwright/lib/utils/index.js`
- `.claude/skills/xiaohongshu-playwright/lib/playwright/delay.js`
- `.claude/skills/xiaohongshu-playwright/lib/playwright/scroll.js`
- `.claude/skills/xiaohongshu-playwright/lib/playwright/session.js`
- `.claude/skills/xiaohongshu-playwright/lib/playwright/context-recovery.js`
- `.claude/skills/xiaohongshu-playwright/lib/playwright/index.js`
- `.claude/skills/xiaohongshu-playwright/lib/xhs/cookies.js`
- `.claude/skills/xiaohongshu-playwright/lib/xhs/data-persistence.js`
- `.claude/skills/xiaohongshu-playwright/lib/xhs/parser.js`
- `.claude/skills/xiaohongshu-playwright/lib/xhs/index.js`

**参考文件**（不修改）：
- `.claude/skills/xiaohongshu-playwright/scripts/human.js`
- `.claude/skills/xiaohongshu-playwright/scripts/filter-comments.js`

---

## 验证方案

### 单元测试（可选）
为每个模块编写简单的单元测试：
```bash
# 测试 utils/string.js
node -e "const {extractNoteId} = require('./.claude/skills/xiaohongshu-playwright/lib/utils/string'); console.log(extractNoteId('https://www.xiaohongshu.com/explore/abc123'));"
```

### 集成测试（必须）
运行完整的采集任务，确保功能不变：
```bash
# 测试搜索 + 采集
node .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js \
  --keyword "露营装备" \
  --max-posts 3 \
  --max-comments 10 \
  --output /tmp/test-output.json

# 检查输出文件
cat /tmp/test-output.json | jq '.posts | length'
```

### 代码行数验证
```bash
# 验证 xhs-scraper.js 减少到约 400 行
wc -l .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js

# 验证总代码量
find .claude/skills/xiaohongshu-playwright/lib -name "*.js" | xargs wc -l
```

---

## 风险控制

### 低风险策略
1. **渐进式重构**：分 5 个阶段，每阶段独立验证
2. **保留备份**：注释原函数而非直接删除，出问题可快速回滚
3. **优先低风险**：先抽离零依赖的通用工具，再处理复杂模块
4. **充分验证**：每阶段完成后运行实际采集任务验证

### 回滚方案
如果某阶段出现问题：
1. 删除对应的 `lib/` 模块文件
2. 取消注释 `xhs-scraper.js` 中的原函数定义
3. 删除新增的 require 语句
4. 运行验证命令确认恢复正常

---

## 预期成果

### 代码量变化
- **xhs-scraper.js**：1564 行 → ~400 行（减少 74%）
- **新增模块代码**：~650 行
- **总代码量**：1564 行 → ~1050 行（减少 33%）

### 质量提升
1. **可维护性**：单文件从 1564 行降到 400 行，易于理解和修改
2. **可复用性**：通用工具可被其他 scraper 复用
3. **可测试性**：独立模块可单独测试
4. **可扩展性**：为未来添加微博、抖音等平台奠定基础

### 后续优化空间
1. 为 `lib/` 模块添加 JSDoc 注释
2. 编写单元测试覆盖核心工具函数
3. 考虑将 `human.js` 也纳入 `lib/playwright/` 体系
4. 探索 TypeScript 类型定义（可选）
