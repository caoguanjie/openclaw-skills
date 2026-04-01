# /xiaohongshu-playwright Skill 测试用例

> 版本：2026-04-01  
> 适用对象：`/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright`  
> 关联文档：`docs/xiaohongshu-playwright-test-plan.md`  
> 用途：把总测试计划拆成可直接执行的场景化测试用例，便于后续人工回归、缺陷复现和版本验收。

## 1. 使用说明

这份文档不是总纲，而是测试执行手册。

建议搭配使用：

- `docs/xiaohongshu-playwright-test-plan.md`：看全局流程、范围和验收标准
- 本文档：按场景逐条执行
- `.claude/skills/xiaohongshu-playwright/references/execution-checklist.md`：单次运行的临场核对

如果一次只做快速回归，建议至少覆盖：

1. `TC-BASE-001`
2. `TC-ENV-002`
3. `TC-MODE-002`
4. `TC-FLOW-001`
5. `TC-FLOW-002`
6. `TC-EXCEL-001`
7. `TC-CLEAN-001`

## 2. 统一约定

### 2.1 路径变量

```bash
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
DATA_DIR="$SKILL_DIR/data"
OUTPUT_DIR="$SKILL_DIR/output"
REF_FILE="$SKILL_DIR/references/site-patterns/xiaohongshu.md"
```

### 2.2 建议测试关键词

| 类型 | 关键词 | 目的 |
|------|--------|------|
| 高意向 | `医美` | 验证标准主链路 |
| 泛兴趣 | `露营装备` | 验证普通链路和多关键词能力 |
| 学习需求 | `考研英语` | 验证自定义筛选语义 |
| 低相关/噪声 | `赛道分析` | 验证粗筛排除和结果为空的情况 |
| 边界关键词 | `热玛吉 深圳` | 验证空格、地区词、文件名清洗 |

### 2.3 统一采证要求

每条用例都至少记录：

- 用例编号
- 测试日期
- 执行人
- 触发方式
- 输入提示词或命令
- 清理动作
- stdout / stderr 摘要
- 退出码或最终对话结果
- 生成文件清单
- 删除文件清单
- 是否通过
- 备注或缺陷编号

### 2.4 执行顺序建议

建议按下面顺序跑，避免一上来就做真实站点长链路：

1. 基线清理与目录验证
2. 环境与运行模式
3. 脚本契约类用例
4. 单关键词完整主链路
5. 多关键词和隔离场景
6. 失败与恢复场景
7. Excel 与清理场景
8. 已知风险回归场景

## 3. 每个场景开始前的清理规则

### 3.1 基线清理

除非该用例明确要求“复用上次结果”或“验证增量行为”，否则执行前都先做一次基线清理。

```bash
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
DATA_DIR="$SKILL_DIR/data"
OUTPUT_DIR="$SKILL_DIR/output"

mkdir -p "$DATA_DIR/task-specs" "$DATA_DIR/screenshots" "$DATA_DIR/analysis_posts" "$OUTPUT_DIR"

rm -f "$DATA_DIR"/comments_*.json
rm -f "$DATA_DIR"/candidates_*.json
rm -f "$DATA_DIR"/analysis_*.json
rm -f "$DATA_DIR/task-specs"/*.json
rm -f "$DATA_DIR/screenshots"/*.png
rm -rf "$DATA_DIR/analysis_posts"/*
rm -f "$OUTPUT_DIR"/*.xlsx
```

执行后应确认：

- `data/task-specs/` 为空
- `data/screenshots/` 为空
- `data/analysis_posts/` 为空
- `output/` 中没有旧的 `.xlsx`

### 3.2 按关键词清理

如果只想清理某个关键词，不影响其他关键词，用下面的方式：

```bash
KW="医美"
SAFE_KW="${KW// /_}"
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
DATA_DIR="$SKILL_DIR/data"
OUTPUT_DIR="$SKILL_DIR/output"

node "$SKILL_DIR/scripts/cleanup-task-specs.js" --keyword "$KW"
rm -f "$DATA_DIR/comments_${KW}.json"
rm -f "$DATA_DIR/candidates_${KW}.json"
rm -f "$DATA_DIR/analysis_${KW}.json"
rm -rf "$DATA_DIR/analysis_posts/$SAFE_KW"
rm -f "$OUTPUT_DIR"/"${KW}"_*.xlsx
```

适用场景：

- 重跑单个关键词
- 多关键词场景中只重测一个关键词
- 验证成功后精确清理是否生效

### 3.3 登录类场景额外清理

仅在需要验证首次登录、二维码登录、cookie 失效重登时执行：

```bash
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
DATA_DIR="$SKILL_DIR/data"

rm -f "$DATA_DIR/cookies.json"
rm -f "$DATA_DIR/login_qrcode.png"
```

### 3.4 环境安装类场景额外说明

环境安装类用例会破坏 `node_modules` 或浏览器依赖，建议在 skill 目录副本中执行，避免影响日常使用。

如果必须在正式目录执行，至少先记录当前状态：

- `node_modules` 是否存在
- `package-lock.json` 是否存在
- Playwright Chromium 是否已安装
- `references/site-patterns/xiaohongshu.md` 中“本地环境”段落当前值

## 4. 通过 / 失败判定标准

### 4.1 通过

满足以下任意一种：

- 脚本型用例返回退出码 `0`，且产物与结构都符合预期
- 技能型用例完整走完流程，且最终产出 Excel 或预期中的失败提示
- 失败类用例按预期失败，并保留了指定中间产物

### 4.2 失败

出现以下任一情况即判失败：

- 静默卡住，无阶段性输出
- 进入了错误步骤顺序
- 中间文件命名或位置不符合约定
- 成功路径未清理临时产物
- 失败路径误删了复盘文件
- Excel 结构不对，缺列、缺截图、缺下拉
- 多关键词结果互相污染

## 5. 测试用例总表

| 编号 | 场景 | 类型 | 核心目标 |
|------|------|------|----------|
| `TC-BASE-001` | 基线清理可执行 | 准备 | 每轮测试前能清空旧数据 |
| `TC-ENV-001` | 首次运行环境未就绪 | 环境 | 触发步骤 1a 安装 |
| `TC-ENV-002` | 环境已就绪快速跳过 | 环境 | 不重复安装 |
| `TC-MODE-001` | 首次询问运行模式 | 配置 | 正确记录用户选择 |
| `TC-MODE-002` | 已记录模式直接复用 | 配置 | 不重复询问 |
| `TC-MODE-003` | 用户主动切换模式 | 配置 | 正确修改站点经验 |
| `TC-SPEC-001` | 任务规格落盘 | 契约 | `save-task-spec.js` 正常产出 |
| `TC-FILTER-001` | 粗筛强制依赖 task spec | 契约 | 无 `--task-spec` 必须失败 |
| `TC-MERGE-001` | 合并分片全部成功 | 契约 | 正常生成 `analysis_<kw>.json` |
| `TC-MERGE-002` | 合并分片部分缺失 | 契约 | 缺失率不超过 50% 时允许成功 |
| `TC-MERGE-003` | 合并失败率过高 | 契约 | 失败率超过 50% 必须非 0 退出 |
| `TC-FLOW-001` | 单关键词完整成功链路 | 主链路 | 从 prompt 到 Excel 全成功 |
| `TC-FLOW-002` | 多关键词完整成功链路 | 主链路 | 结果隔离、顺序合理 |
| `TC-FLOW-003` | 同关键词重复执行增量去重 | 主链路 | 不重复采集已有帖子 |
| `TC-SCRAPER-001` | 首次无 cookie 二维码登录 | 登录 | 正确引导人工扫码 |
| `TC-SCRAPER-002` | cookie 失效重新登录 | 登录 | 可恢复并继续运行 |
| `TC-SCRAPER-003` | 排序/时间范围/边界参数 | 边界 | 参数被正确传递和处理 |
| `TC-EXCEL-001` | Excel 结构验收 | 输出 | 16 列、截图、下拉全部正确 |
| `TC-CLEAN-001` | 成功后清理临时文件 | 清理 | 仅删 task spec 和分片 |
| `TC-CLEAN-002` | 失败后保留复盘现场 | 清理 | 失败时中间产物不应被删 |
| `TC-ERR-001` | 登录超时 | 异常 | 超时退出且归类正确 |
| `TC-ERR-002` | 平台限流/验证码 | 异常 | 观察提示、记录缺陷或恢复行为 |
| `TC-ISO-001` | 多关键词数据隔离 | 隔离 | 文件、Excel、分片互不污染 |
| `TC-RISK-001` | 动态评论加载不完整 | 风险回归 | 识别 `__INITIAL_STATE__` 缺口 |

## 6. 详细测试用例

### TC-BASE-001 基线清理可执行

- 目标：确保进入任何测试场景前，都能把旧的 comments、candidates、analysis、task spec、截图、Excel 清干净。
- 执行前清理：无，直接执行 3.1 的基线清理命令。
- 操作步骤：
  1. 先手工确认当前目录中存在旧文件。
  2. 执行基线清理命令。
  3. 用 `ls` 或 `find` 检查相关目录。
- 预期结果：
  - `data/task-specs/` 为空。
  - `data/screenshots/` 为空。
  - `data/analysis_posts/` 为空。
  - `data/comments_*.json`、`data/candidates_*.json`、`data/analysis_*.json`、`output/*.xlsx` 均被清理。
- 失败判定：
  - 仍残留旧文件。
  - 命令删除范围错误，误删无关目录。

### TC-ENV-001 首次运行环境未就绪

- 目标：验证环境未就绪时会执行步骤 1a，而不是直接进入采集。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 额外清理安装状态或在目录副本中执行。
  - 把 `references/site-patterns/xiaohongshu.md` 中本地环境字段改为 `未就绪`。
- 触发方式：
  - 自然语言：`帮我在小红书搜“医美”，找出有兴趣的用户`
- 操作步骤：
  1. 触发 skill。
  2. 观察是否先输出环境检查/安装日志。
  3. 记录是否在环境完成前询问运行模式。
- 预期结果：
  - 先执行步骤 1a。
  - 有持续可见的阶段反馈，不是长时间无输出。
  - 环境完成后才进入步骤 2。
  - `xiaohongshu.md` 中本地环境字段被更新为已就绪状态。

### TC-ENV-002 环境已就绪快速跳过

- 目标：验证环境已就绪时不会重复安装。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 保留已有 `node_modules`、浏览器依赖和环境状态记录。
- 触发方式：
  - `/xiaohongshu-playwright 搜索"露营装备"，找出想买的人`
- 操作步骤：
  1. 触发 skill。
  2. 观察日志是否仍试图安装 npm 依赖或 Chromium。
- 预期结果：
  - 1a 很快完成。
  - 不重复安装依赖。
  - 正常进入任务规格生成、运行模式、采集链路。

### TC-MODE-001 首次询问运行模式

- 目标：验证首次使用时会询问“后台静默运行 / 打开浏览器运行”。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 在 `xiaohongshu.md` 中把“运行模式”改为 `未设置`。
- 操作步骤：
  1. 触发任意有效关键词任务。
  2. 观察是否出现运行模式询问文案。
  3. 选择 `B. 打开浏览器运行`。
- 预期结果：
  - 仅在环境就绪后出现询问。
  - 不会在步骤 1a 未完成前询问。
  - `xiaohongshu.md` 中更新为 `运行模式: 打开浏览器运行`。

### TC-MODE-002 已记录模式直接复用

- 目标：验证非首次运行不会重复询问模式。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 确保 `xiaohongshu.md` 中已有 `运行模式: 后台静默运行` 或 `打开浏览器运行`。
- 操作步骤：
  1. 再次触发 skill。
  2. 观察中间对话或日志。
- 预期结果：
  - 不再询问模式。
  - 直接使用记录模式执行采集。

### TC-MODE-003 用户主动切换模式

- 目标：验证用户要求切换模式时，skill 会更新记录并按新模式运行。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 预设当前模式为 `后台静默运行`。
- 触发方式：
  - `切换到打开浏览器模式，然后帮我搜“医美”`
- 预期结果：
  - `xiaohongshu.md` 中模式被改为 `打开浏览器运行`。
  - 后续采集使用有头模式。

### TC-SPEC-001 任务规格落盘

- 目标：验证 `save-task-spec.js` 能正确保存结构化 task spec。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 操作步骤：
  1. 准备一份包含 `keyword / post_relevance / comment_filter / semantic_focus` 的 JSON。
  2. 执行：

```bash
SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright"
TMP_FILE="$SKILL_DIR/.temp-task-spec-test.json"

cat > "$TMP_FILE" <<'EOF'
{
  "keyword": "医美",
  "post_relevance": {
    "include": ["医美", "热玛吉"],
    "exclude": ["加盟", "招聘"]
  },
  "comment_filter": {
    "include": ["多少钱", "想做"],
    "exclude": ["加我", "私信"]
  },
  "semantic_focus": "只保留明确购买意向用户"
}
EOF

node "$SKILL_DIR/scripts/save-task-spec.js" --keyword "医美" --json-file "$TMP_FILE"
```

  3. 检查输出路径和 JSON 内容。
- 预期结果：
  - 在 `data/task-specs/` 下生成 `时间戳_医美.json`。
  - 内容字段齐全，数组被正常规范化。
  - 脚本退出码为 `0`。

### TC-FILTER-001 粗筛强制依赖 task spec

- 目标：验证 `filter-comments.js` 缺少 `--task-spec` 时会失败。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 准备一份最小可用的 `comments_<kw>.json` fixture。
- 操作步骤：
  1. 执行 `node scripts/filter-comments.js --input <comments.json> --output <candidates.json>`。
  2. 记录退出码和错误信息。
- 预期结果：
  - 脚本非 `0` 退出。
  - 日志明确提示“必须传入 `--task-spec`”。
  - 不生成候选文件。

### TC-MERGE-001 合并分片全部成功

- 目标：验证 `merge-analysis.js` 在分片齐全时正常输出完整分析文件。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 使用仓库内已有 merge fixture，或自行准备 `candidates_mergecase.json` 与完整分片目录。
- 操作步骤：
  1. 执行 `node scripts/merge-analysis.js --keyword "mergecase_full"`。
  2. 检查输出文件。
- 预期结果：
  - 退出码为 `0`。
  - 生成 `data/analysis_mergecase_full.json`。
  - 日志显示成功合并统计。

### TC-MERGE-002 合并分片部分缺失

- 目标：验证分片缺失但失败率不超过 50% 时允许成功。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 准备 3 个帖子里缺 1 个分片的 fixture。
- 操作步骤：
  1. 执行 `node scripts/merge-analysis.js --keyword "mergecase_partial"`。
  2. 观察输出和日志。
- 预期结果：
  - 退出码为 `0`。
  - 日志有缺失警告。
  - 输出文件存在，且只包含成功分片对应的帖子。

### TC-MERGE-003 合并失败率过高

- 目标：验证缺失率超过 50% 时必须中止。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 准备 3 个帖子里只有 1 个分片存在的 fixture。
- 操作步骤：
  1. 执行 `node scripts/merge-analysis.js --keyword "mergecase_fail"`。
  2. 记录退出码。
- 预期结果：
  - 脚本非 `0` 退出。
  - 日志明确指出失败率过高。
  - 不应把缺损结果当成成功产物交付。

### TC-FLOW-001 单关键词完整成功链路

- 目标：验证单关键词从 prompt 到 Excel 的完整主链路。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 如果要验证首次登录，再执行 3.3 登录清理；否则保留可用 cookie。
- 触发方式：
  - `/xiaohongshu-playwright 搜索"医美"，分析 5 篇帖子，每篇最多 30 条评论，找出明确想做医美的人`
- 操作步骤：
  1. 触发 skill。
  2. 记录步骤 1a、1b、2、3、4、5、6、7、8 是否按顺序执行。
  3. 检查中间产物。
- 预期结果：
  - 先完成 1a 和 1b，再进入步骤 2。
  - 生成 `comments_医美.json`、`candidates_医美.json`、`analysis_医美.json`、Excel。
  - `screenshots/` 下有对应帖子截图。
  - 最终返回 Excel 路径。

### TC-FLOW-002 多关键词完整成功链路

- 目标：验证多关键词时步骤 3-4 串行，结果分别导出，互不干扰。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 触发方式：
  - `分别搜索“露营装备”和“户外徒步”，各分析 3 篇帖子，找出有购买意向的用户，用慢速模式`
- 预期结果：
  - 至少生成两个独立的 `comments_*.json`、`analysis_*.json` 和两个 Excel。
  - 日志或对话中体现慢速模式。
  - 两个关键词的 task spec、候选文件、分析结果互不覆盖。

### TC-FLOW-003 同关键词重复执行增量去重

- 目标：验证相同关键词重复运行时会跳过已采集的帖子 URL。
- 执行前清理：
  - 只做按关键词清理一次，先完成首轮成功运行。
- 操作步骤：
  1. 先执行一轮 `医美` 完整任务。
  2. 不删除 `comments_医美.json`，再次执行同一任务。
  3. 对比前后帖子数量和日志。
- 预期结果：
  - 第二轮应读取旧文件并跳过已采集帖子。
  - 不应把同一帖子重复写多次。
  - 如果新抓到长尾帖子，可增量合并。

### TC-SCRAPER-001 首次无 cookie 二维码登录

- 目标：验证无 cookie 时，脚本能引导人工扫码而不是直接失败。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 执行 3.3 登录类场景额外清理。
- 操作步骤：
  1. 触发单关键词任务。
  2. 观察是否生成二维码文件或弹出浏览器。
  3. 在等待窗口内扫码登录。
- 预期结果：
  - 日志明确提示扫码登录。
  - 登录后保存 `data/cookies.json`。
  - 任务继续执行而非从头失败。

### TC-SCRAPER-002 cookie 失效重新登录

- 目标：验证 cookie 失效或过期时可以恢复。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 保留一个故意过期或无效的 `cookies.json`。
- 预期结果：
  - 任务检测到登录失效。
  - 提示重新登录。
  - 完成登录后继续执行。

### TC-SCRAPER-003 排序/时间范围/边界参数

- 目标：验证 `--sort`、`--time-range`、`max_comments` 等边界参数生效。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 测试子场景：
  - 子场景 A：`搜索“考研英语”，按最热排序，最近一周，分析 3 篇`
  - 子场景 B：`搜索“露营装备”，每篇最多 0 条评论`
  - 子场景 C：`搜索“医美”，每篇最多 999 条评论`
- 预期结果：
  - A：日志或命令映射能体现 `sort=hot`、`timeRange=1w`。
  - B：`0` 代表“全部”，但仍受脚本硬上限控制。
  - C：最终实际抓取数不应超过硬上限 `500`。

### TC-EXCEL-001 Excel 结构验收

- 目标：验证 Excel 由 `generate-excel.js` 生成，且结构完整。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 先准备一份有效的 `analysis_<kw>.json`，可来自真实运行或 fixture。
- 操作步骤：
  1. 执行 `node scripts/generate-excel.js --input <analysis.json>`。
  2. 打开输出文件检查。
- 预期结果：
  - 输出到 `output/<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`。
  - 含 16 列。
  - 有截图列。
  - “已关注”和“跟进状态”存在下拉。
  - 帖子下多条评论的同一用户会被合并。

### TC-CLEAN-001 成功后清理临时文件

- 目标：验证成功链路结束后，只清理 task spec 和 `analysis_posts/<kw>`。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 操作步骤：
  1. 运行一次完整成功任务。
  2. 检查运行后目录状态。
- 预期结果：
  - `data/task-specs/` 中当前关键词对应文件被删除。
  - `data/analysis_posts/<kw>/` 被删除。
  - `comments_<kw>.json`、`candidates_<kw>.json`、`analysis_<kw>.json`、Excel 保留。

### TC-CLEAN-002 失败后保留复盘现场

- 目标：验证流程异常时不误删中间证据。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 通过中断分片写入、制造 merge 失败或登录超时来触发失败。
- 预期结果：
  - 当前关键词的 task spec 仍保留。
  - `candidates_<kw>.json` 保留。
  - 已生成的分片保留。
  - 日志能支持复盘。

### TC-ERR-001 登录超时

- 目标：验证人工不扫码时，系统按登录超时失败，而不是误报脚本崩溃。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 执行 3.3 登录清理。
- 操作步骤：
  1. 触发需要登录的任务。
  2. 故意不扫码，等待脚本自然超时。
- 预期结果：
  - 运行期间持续表现为等待登录，不是卡死无输出。
  - 超时后明确归类为登录超时。
  - 不应把该问题归类成采集脚本崩溃。

### TC-ERR-002 平台限流或验证码

- 目标：验证限流、验证码、异常弹窗等真实站点异常的处理表现。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 操作步骤：
  1. 在高风险关键词、频繁请求或人工触发验证码的环境下运行。
  2. 观察脚本表现。
- 预期结果：
  - 如果当前版本能识别，应给出明确提示并暂停等待人工处理。
  - 如果当前版本无法识别，应记录为缺陷并关联 `已知缺陷.md` 中对应问题，不得误判为“正常通过”。

### TC-ISO-001 多关键词数据隔离

- 目标：验证文件命名、分片目录、输出 Excel 都按关键词隔离。
- 执行前清理：
  - 执行 `TC-BASE-001`。
- 操作步骤：
  1. 运行 `医美` 和 `露营装备` 双关键词任务。
  2. 检查 `comments_*.json`、`candidates_*.json`、`analysis_*.json`、`analysis_posts/<kw>/`、Excel。
- 预期结果：
  - 每个关键词都有自己的文件。
  - 任一关键词重跑时，不会覆盖另一个关键词的结果。

### TC-RISK-001 动态评论加载不完整

- 目标：针对当前已知高风险问题，检查滚动后的评论量是否真正进入最终 JSON。
- 执行前清理：
  - 执行 `TC-BASE-001`。
  - 选择评论特别多的热门帖子关键词，如 `医美`、`热玛吉`。
- 操作步骤：
  1. 运行抓取任务，记录页面上人工可见的评论数或滚动日志。
  2. 对比 `comments_<kw>.json` 内实际落盘评论数。
- 预期结果：
  - 如果页面已滚动加载很多评论，但输出仍接近初始评论数，应判定为风险命中。
  - 该场景可作为版本回归观察项，不应直接算通过。

## 7. 推荐回归组合

### 7.1 冒烟回归

- `TC-BASE-001`
- `TC-ENV-002`
- `TC-MODE-002`
- `TC-FLOW-001`
- `TC-EXCEL-001`
- `TC-CLEAN-001`

### 7.2 发版前完整回归

- `TC-BASE-001`
- `TC-ENV-001`
- `TC-ENV-002`
- `TC-MODE-001`
- `TC-MODE-002`
- `TC-MODE-003`
- `TC-SPEC-001`
- `TC-FILTER-001`
- `TC-MERGE-001`
- `TC-MERGE-002`
- `TC-MERGE-003`
- `TC-FLOW-001`
- `TC-FLOW-002`
- `TC-FLOW-003`
- `TC-SCRAPER-001`
- `TC-SCRAPER-002`
- `TC-SCRAPER-003`
- `TC-EXCEL-001`
- `TC-CLEAN-001`
- `TC-CLEAN-002`
- `TC-ERR-001`
- `TC-ERR-002`
- `TC-ISO-001`
- `TC-RISK-001`

## 8. 执行备注

- 环境安装类和真实站点类用例不要混在同一轮里跑，避免互相污染。
- 涉及登录、限流、验证码的场景，应单独标注“人工协助”。
- 任何失败场景都不要先手工清理目录，先保存日志和中间文件路径，再进入下一轮。
- 如果后续 skill 流程有增删步骤，这份文档也需要同步更新编号、清理动作和验收点。
