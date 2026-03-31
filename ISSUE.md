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
