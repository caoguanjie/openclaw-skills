# 计划：为 xiaohongshu-playwright skill 创建可执行测试套件

## Context

`xiaohongshu-playwright` skill 已有一份描述性测试计划（`docs/xiaohongshu-playwright-test-plan.md`），但目前 `package.json` 的 `test` 脚本只是 `echo "Error: no test specified" && exit 1`，没有任何可执行测试文件。

用户需要：把测试计划中的用例实现为可直接运行的 Node.js 测试脚本，每个场景测试前清理旧数据，涵盖各类边界场景。

## 目标产物

新增文件位于：
```
.claude/skills/xiaohongshu-playwright/
├── tests/
│   ├── run-all.js                        # 测试总入口（orchestrator）
│   ├── MANUAL-TESTS.md                   # 需要真实浏览器的手动测试清单
│   ├── helpers/
│   │   ├── cleanup.js                    # 清理工具（每个测试文件调用）
│   │   ├── fixtures.js                   # 测试 fixture 工厂函数
│   │   └── run-script.js                 # spawnSync 包装器
│   └── scripts/
│       ├── save-task-spec.test.js         # TC-SPEC-001 到 004
│       ├── filter-comments.test.js        # TC-FILTER-001 到 005
│       ├── merge-analysis.test.js         # TC-MERGE-001 到 004
│       ├── generate-excel.test.js         # TC-EXCEL-001 到 005
│       └── cleanup-task-specs.test.js     # TC-CLEANUP-001 到 003
```

同时更新：
- `package.json`：将 `test` 脚本改为 `node tests/run-all.js`

## 测试框架约定

与项目现有惯例一致（参考 `.claude/plugins/everything-claude-code/tests/`）：
- 纯 Node.js `assert` 模块，无外部测试框架
- 自定义 `test(name, fn)` 辅助函数
- 每个文件末尾打印 `Passed: N, Failed: M`
- `run-all.js` 用 `spawnSync` 驱动各测试文件

## 测试隔离策略

**使用测试专属关键词**防止污染真实数据：
- 固定测试关键词：`__TEST__SPEC__`、`__TEST__FILTER__`、`__TEST__MERGE__`、`__TEST__EXCEL__`、`__TEST__CLEANUP__`
- 测试前：`cleanup.removeTestData(keyword)` 删除对应 `data/` 下的 task-specs、candidates、comments、analysis 文件和 `output/` 下的 xlsx
- 测试后：同样清理（放在 `try/finally`）
- 所有 fixture 写入 `data/` 目录（脚本期望的路径），不用独立 `tmp/` 目录

## 各测试文件详细规划

### 1. `helpers/run-script.js`

```js
// 封装 spawnSync，返回 { status, stdout, stderr }
// 路径基于 SKILL_DIR = path.resolve(__dirname, '../..')
// 命令：node <SKILL_DIR>/scripts/<scriptName> ...args
```

### 2. `helpers/cleanup.js`

提供以下方法：
- `removeTestData(keyword)` — 删除 `data/task-specs/*${keyword}*.json`、`data/comments_${keyword}.json`、`data/candidates_${keyword}.json`、`data/analysis_${keyword}.json`、`data/analysis_posts/${keyword}/`
- `removeTestOutput(keyword)` — 删除 `output/${keyword}_*.xlsx`
- `cleanAll(keyword)` — 调用以上两个
- `writeFile(path, content)` — 写入 fixture 文件的快捷方法

### 3. `helpers/fixtures.js`

提供以下 fixture 工厂：
- `makeTaskSpec(keyword, overrides)` — 返回合法 task spec 对象
- `makeComments(keyword, posts)` — 返回合法 comments JSON（xhs-scraper 输出格式）
- `makeCandidates(keyword, taskSpecPath, posts)` — 返回合法 candidates JSON（filter-comments 输出格式）
- `makeAnalysisShard(noteId, comments)` — 返回单个分片 JSON（sub-agent 输出格式）
- `makeAnalysis(keyword, posts)` — 返回合并后的 analysis JSON（generate-excel 输入格式）

### 4. `scripts/save-task-spec.test.js`

| 用例 | 对应 TC | 操作 | 断言 |
|------|---------|------|------|
| 生成合法 task spec | TC-SPEC-001 | 传 --keyword + --json | exit 0，stdout 含绝对路径，文件存在，JSON 包含 keyword/post_relevance/comment_filter/semantic_focus |
| 输出文件路径规范 | 新增 | 检查文件名格式 | 文件名匹配 `<timestamp>_<sanitized-kw>.json` |
| 缺少 --keyword | TC-SPEC-002 | 不传 --keyword | exit 1，stderr 含 `--keyword` |
| 缺少 --json | TC-SPEC-003 | 不传 --json/--json-file | exit 1，stderr 含提示 |
| include 非数组 | TC-SPEC-004 | include 传字符串 | exit 1，stderr 含 `必须为数组` |
| --json 非法 JSON | 新增 | 传 `{invalid}` | exit 1，stderr 含解析错误 |
| keyword 含特殊字符 | 新增 | keyword = "医美/露营" | exit 0，文件名中特殊字符被 sanitize |

**前置清理**：`cleanAll('__TEST__SPEC__')`  
**后置清理**：`cleanAll('__TEST__SPEC__')` in finally

### 5. `scripts/filter-comments.test.js`

| 用例 | 对应 TC | 操作 | 断言 |
|------|---------|------|------|
| 正常粗筛输出结构 | TC-FILTER-001 | fixture comments + task spec | exit 0，输出包含 keyword/taskSpecPath/taskSpec/posts/skippedPosts/stats |
| 缺少 --task-spec | TC-FILTER-002 | 不传 | exit 1 |
| 输入文件不存在 | TC-FILTER-003 | 传不存在路径 | exit 1，stderr 含 `不存在` |
| 纯表情被过滤 | TC-FILTER-004a | fixture 含纯表情评论 | stats.filterReasons 含表情计数，评论不进入 posts |
| 广告引流被过滤 | TC-FILTER-004b | fixture 含 "加我微信" | 同上 |
| 作者自回复被过滤 | TC-FILTER-004c | fixture 含 author == 评论者 | 同上 |
| 纯@引用被过滤 | TC-FILTER-004d | 只含 "@user" 无实质内容 | 同上 |
| 帖子 include 关键词匹配 | TC-FILTER-005a | task spec include=["热玛吉"]，帖子标题含/不含 | 不含的进 skippedPosts |
| 帖子 exclude 关键词排除 | TC-FILTER-005b | exclude=["避雷"] | 含 "避雷" 的帖子进 skippedPosts |
| stats 字段完整性 | 新增 | 正常运行 | stats 包含 totalPosts/keptPosts/totalComments/filteredComments/keptComments/filterReasons |

**前置清理**：`cleanAll('__TEST__FILTER__')`，写入 fixture 文件  
**后置清理**：`cleanAll('__TEST__FILTER__')` in finally

### 6. `scripts/merge-analysis.test.js`

| 用例 | 对应 TC | 操作 | 断言 |
|------|---------|------|------|
| 正常合并，顺序一致 | TC-MERGE-001 | 3 个分片全存在 | exit 0，output JSON posts 顺序与 candidates 一致 |
| 1/3 分片缺失（<50%） | TC-MERGE-002 | 删掉 1 个分片 | exit 0，stdout/stderr 含缺失警告，output 仍生成 |
| 2/3 分片缺失（>50%） | TC-MERGE-003 | 删掉 2 个分片 | exit 1，stderr 含 `失败率过高` |
| candidates 文件不存在 | TC-MERGE-004 | 传不存在路径 | exit 1，stderr 含 `不存在` |
| 分片目录不存在 | 新增 | posts-dir 指向不存在目录 | exit 1 |
| 空 candidates（0 帖子） | 新增 | candidates.posts = [] | exit 0，output.posts = [] |

**前置清理**：`cleanAll('__TEST__MERGE__')`，写入 fixture candidates + 分片  
**后置清理**：in finally

### 7. `scripts/generate-excel.test.js`

| 用例 | 对应 TC | 操作 | 断言 |
|------|---------|------|------|
| 正常导出，文件存在 | TC-EXCEL-001 | 合法 analysis fixture | exit 0，xlsx 文件存在，stdout 含路径 |
| 文件名格式 | 新增 | 检查输出路径 | 文件名匹配 `<keyword>_<YYYYMMDD>_<HH-mm>.xlsx` |
| 16 列验证 | TC-EXCEL-002 | 用 exceljs 读输出文件 | columnCount == 16 |
| 多评论合并显示 | TC-EXCEL-003 | 同一用户在同帖 2 条评论 | 内容含 "①" 和 "②" 编号 |
| 输入 posts 非数组 | TC-EXCEL-006 | `{posts: "bad"}` | exit 1，stderr 含 `生成失败` 或类似 |
| 输入文件不存在 | 新增 | 传不存在路径 | exit 1 |
| output 目录自动创建 | 新增 | 手动删 output 目录 | exit 0，xlsx 仍生成 |

注：TC-EXCEL-004（分数高亮）和 TC-EXCEL-005（截图嵌入）需要 exceljs 读取验证，或标记为半手动。

**前置清理**：`cleanAll('__TEST__EXCEL__')`，写入 fixture analysis  
**后置清理**：in finally

### 8. `scripts/cleanup-task-specs.test.js`

| 用例 | 对应 TC | 操作 | 断言 |
|------|---------|------|------|
| --keyword 只删对应文件 | TC-CLEANUP-001 | 建 3 个不同关键词 task spec，删其中 1 个 | 目标文件不存在，其余 2 个存在 |
| 无 --keyword 删全部 | 新增 | 建 2 个 task spec，不传 keyword | 两个文件都被删 |
| 目录不存在时不报错 | 新增 | 删除 task-specs 目录后运行 | exit 0 |

**前置清理**：手动删测试用 task spec 文件  
**后置清理**：in finally

### 9. `run-all.js` orchestrator

```js
// 驱动顺序：save-task-spec → filter-comments → merge-analysis → generate-excel → cleanup-task-specs
// 用 spawnSync 运行每个 .test.js，解析 "Passed: N, Failed: M"
// 全部通过 → exit 0；任一失败 → exit 1
// 汇总行：=== Total: X passed, Y failed ===
```

### 10. `MANUAL-TESTS.md` 手动测试清单

覆盖：
- TC-ENV-001 to 007（环境安装，需要真实网络/清空 node_modules）
- TC-MODE-001 to 003（运行模式，需要 Claude 交互）
- TC-SCRAPER-001 to 009（需要真实浏览器 + XHS 账号）
- TC-AI-001 to 007（需要 sub-agent 支持）
- TC-PATTERN-001 to 002（依赖真实运行结果）
- TC-MULTI-001 to 003（多关键词完整链路）

每条手动用例包含：前置清理命令、执行步骤、预期结果验证点。

### 11. `package.json` 更新

```json
{
  "scripts": {
    "bootstrap:playwright": "node scripts/bootstrap-playwright.js",
    "test": "node tests/run-all.js",
    "test:spec": "node tests/scripts/save-task-spec.test.js",
    "test:filter": "node tests/scripts/filter-comments.test.js",
    "test:merge": "node tests/scripts/merge-analysis.test.js",
    "test:excel": "node tests/scripts/generate-excel.test.js",
    "test:cleanup": "node tests/scripts/cleanup-task-specs.test.js"
  }
}
```

## 覆盖的测试用例统计

| 脚本 | 自动化测试数 | 覆盖的 TC |
|------|------------|-----------|
| save-task-spec.js | 7 | TC-SPEC-001~004 + 3 新增 |
| filter-comments.js | 10 | TC-FILTER-001~005 + 5 场景细化 |
| merge-analysis.js | 6 | TC-MERGE-001~004 + 2 新增 |
| generate-excel.js | 7 | TC-EXCEL-001~003,006 + 3 新增 |
| cleanup-task-specs.js | 3 | TC-CLEANUP-001 + 2 新增 |
| **合计** | **33** | — |

手动测试文档覆盖：TC-ENV-001~007、TC-MODE-001~003、TC-SCRAPER-001~009、TC-AI-001~007、TC-PATTERN-001~002、TC-MULTI-001~003

## 关键文件路径（待修改/新建）

- 新建：`.claude/skills/xiaohongshu-playwright/tests/run-all.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/MANUAL-TESTS.md`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/helpers/cleanup.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/helpers/fixtures.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/helpers/run-script.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/scripts/save-task-spec.test.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/scripts/filter-comments.test.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/scripts/merge-analysis.test.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/scripts/generate-excel.test.js`
- 新建：`.claude/skills/xiaohongshu-playwright/tests/scripts/cleanup-task-specs.test.js`
- 修改：`.claude/skills/xiaohongshu-playwright/package.json`（更新 test 脚本）

## 验证方式

实现完成后运行：
```bash
cd /Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright
npm test
# 预期输出：=== Total: 33 passed, 0 failed ===（或类似）
```

单独运行某个文件：
```bash
npm run test:spec
npm run test:filter
# 等等
```
