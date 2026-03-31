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
