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
