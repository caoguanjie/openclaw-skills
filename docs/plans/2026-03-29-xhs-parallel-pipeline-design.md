# xiaohongshu-playwright 并行流水线设计

> 日期: 2026-03-29
> 状态: 待实现

## 背景

当前 SKILL.md 的步骤全部串行：环境检查 → 任务规格生成 → 采集 → 精筛 → 导出。
本次优化将引入三处并行化：

1. **步骤 1 [并行启动]**：环境检查与任务规格生成同时发起
2. **步骤 5 [并行精筛]**：采集后每个帖子独立派一个 sub-agent 精筛
3. **多关键词并行**：多关键词时各自独立走完整流水线

---

## 新步骤命名体系

| 步骤 | 名称 | 并行 |
|------|------|------|
| 步骤 1 | 并行启动（1a 环境检查 \|\| 1b 任务规格生成） | ✅ |
| 步骤 2 | 运行模式确认（首次询问，后续跳过） | — |
| 步骤 3 | 数据采集（xhs-scraper.js） | — |
| 步骤 4 | 粗筛（filter-comments.js） | — |
| 步骤 5 | 并行精筛（每帖 1 sub-agent） | ✅ |
| 步骤 6 | 合并精筛结果（merge-analysis.js） | — |
| 步骤 7 | 生成 Excel（generate-excel.js） | — |
| 步骤 8 | 清理临时文件 | — |

---

## 新数据管道图

```
用户输入关键词
    ↓
步骤 1 [并行启动]
  ├── 1a：读取站点经验 + 确认本地环境
  └── 1b：生成任务规格 → data/task-specs/<ts>_<kw>.json
    ↓ (1a 和 1b 都完成)
步骤 2：运行模式确认
    ↓
步骤 3：xhs-scraper.js → data/comments_<kw>.json
    ↓
步骤 4：filter-comments.js → data/candidates_<kw>.json
    ↓
步骤 5 [并行精筛]
  ├── sub-agent (帖子1) → data/analysis_posts/<kw>/post1.json
  ├── sub-agent (帖子2) → data/analysis_posts/<kw>/post2.json
  └── sub-agent (帖子N) → data/analysis_posts/<kw>/postN.json
    ↓ (全部完成)
步骤 6：merge-analysis.js → data/analysis_<kw>.json
    ↓
步骤 7：generate-excel.js → output/<kw>_<YYYYMMDD>_<HH-mm>.xlsx
    ↓
步骤 8：清空 data/task-specs/ + data/analysis_posts/<kw>/
```

---

## 步骤 1 详细设计

**触发时机**：AI 收到用户输入后立即执行，两路同时发起。

### 步骤 1a：环境检查

等同于原 Step 1 + Step 1.2：
- 读取 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落
- 如环境未就绪：安装 npm 依赖 + Playwright Chromium
- 完成后更新站点经验文件的「本地环境」段落

### 步骤 1b：生成任务规格

**不依赖 1a，立即从用户原始提示词生成 task spec**。

```bash
node "${SKILL_DIR}/scripts/save-task-spec.js" \
  --keyword "<关键词>" \
  --json '<task-spec-json>'
```

输出路径：`data/task-specs/<timestamp>_<keyword>.json`

---

## 步骤 5 详细设计

### 平台分支逻辑

读取 `data/candidates_<kw>.json`，对每个帖子独立分发精筛任务。

#### Claude Code / Openclaw（推荐路径）

对 candidates 中每个帖子，**调用 Agent tool（Claude Code）或 Sub-Agent（Openclaw）** 派出独立 sub-agent。

**每个 sub-agent 接收**：
- 帖子数据：title、url、screenshotFile、totalComments、collectedComments、候选评论列表
- task spec 路径（读取 `semantic_focus`）
- 输出路径：`data/analysis_posts/<kw>/<postId>.json`

**每个 sub-agent 的完整指令**：

```
你是一个评论语义分析 agent，只负责分析一篇帖子的评论。

任务：
1. 读取 task spec 文件，获取 semantic_focus 字段
2. 对以下候选评论逐条判断：
   - interest_tags: 数组，如 ["购买意向", "深度讨论", "咨询"]
   - interest_score: 1-10 分
   - reason: 判断理由（一句话）
3. 只保留 interest_score >= 6 的评论
4. 禁止用关键词匹配代替语义判断
5. 将结果写入指定输出路径

帖子信息：
- title: <帖子标题>
- url: <帖子链接>
- screenshotFile: <截图路径>
- totalComments: N
- collectedComments: N
- 候选评论: [...]

输出格式（JSON）：
{
  "postId": "<从URL提取的ID>",
  "title": "...",
  "url": "...",
  "screenshotFile": "...",
  "totalComments": N,
  "collectedComments": N,
  "validComments": [
    {
      "username": "...",
      "userId": "...",
      "content": "...",
      "ipLocation": "...",
      "interestTags": "购买意向, 咨询",
      "interestScore": 8,
      "reason": "...",
      "profileUrl": "..."
    }
  ]
}

输出路径：data/analysis_posts/<kw>/<postId>.json
```

所有 sub-agent **并行运行**，等待全部完成后进入步骤 6。

#### 其他平台（串行降级）

> ⚠️ 当前平台不支持 Agent 并行分发，将**串行**逐帖精筛。
> 这会比并行模式慢，所有帖子顺序处理后直接写入 `data/analysis_<kw>.json`，**跳过步骤 6**。

---

## 步骤 6 详细设计

### merge-analysis.js 新脚本

```bash
node "${SKILL_DIR}/scripts/merge-analysis.js" \
  --keyword "<kw>" \
  --candidates "${SKILL_DIR}/data/candidates_<kw>.json" \
  --posts-dir "${SKILL_DIR}/data/analysis_posts/<kw>" \
  --output "${SKILL_DIR}/data/analysis_<kw>.json"
```

**脚本逻辑**：
1. 读取 `candidates.json`，提取帖子列表（保持原始顺序）
2. 对每个帖子，从 `posts-dir` 中读取对应的 `<postId>.json`
3. 如某帖子的分片文件缺失，记录警告但不阻断（跳过该帖子）
4. 合并为标准 `analysis_<kw>.json` 格式：
   ```json
   { "keyword": "...", "posts": [...] }
   ```
5. 输出路径由 `--output` 指定

---

## 多关键词处理策略（v2 修订）

> ⚠️ 原设计中多关键词全程并行，经 Opus 审核发现以下 P0 问题：
> - 多个 scraper 实例并发读写同一 `data/cookies.json`，会产生竞争条件
> - 多个 Chromium 实例并行，内存压力大 + 反爬检测风险
>
> **修订后策略：采集串行 + 精筛并行**

**步骤 3-4（采集 + 粗筛）**：按关键词顺序串行执行，共享同一 cookie 文件。

**步骤 5（并行精筛）**：每个关键词完成粗筛后，其帖子即可开始并行精筛（不等其他关键词）。

**步骤 6-8（合并 + 导出 + 清理）**：每个关键词独立执行。

每个关键词的输出文件完全独立，互不影响：
- `data/comments_<kw>.json`
- `data/candidates_<kw>.json`
- `data/analysis_<kw>.json`
- `data/analysis_posts/<kw>/`
- `output/<kw>_<日期>.xlsx`

---

## P0/P1 修复清单（Opus 审核后更新）

| # | 严重度 | 问题 | 修复方案 |
|---|--------|------|---------|
| 1 | P0 | Cookie 竞争条件 | 多关键词采集改为串行，共享 cookie 文件 |
| 2 | P0 | cleanup-task-specs 误删其他关键词 task spec | 改为只删当前关键词文件（按文件名匹配） |
| 3 | P0 | Agent tool 并发 10+ 不现实 | 加并发限制：MAX_CONCURRENT_AGENTS = 3（SKILL.md 明确注明） |
| 4 | P1 | noteId 未持久化 | xhs-scraper.js 输出中加 `noteId` 字段 |
| 5 | P1 | 串行降级清理不存在目录 | 步骤 8 清理前检查目录是否存在 |
| 6 | P1 | interestTags 格式矛盾 | 统一为逗号分隔字符串，在 SKILL.md + sub-agent 指令中对齐 |
| 7 | P1 | 合并缺失帖子不可感知 | merge-analysis.js 输出统计信息，失败 > 50% 时中止并告知用户 |
| 8 | P1 | 多浏览器资源耗尽 | 采集串行解决（见多关键词策略 v2） |

---

## 改动文件清单（更新后）

| 文件 | 类型 | 说明 |
|------|------|------|
| `SKILL.md` | 修改 | 全步骤重命名（1-8）、并行启动、sub-agent 分发（并发限制 3）、串行降级警告、多关键词采集串行说明 |
| `scripts/xhs-scraper.js` | 修改 | 输出 JSON 中加 `noteId` 字段 |
| `scripts/merge-analysis.js` | 新增 | 合并 analysis_posts 分片为完整 analysis.json（含统计、失败阈值） |
| `scripts/cleanup-task-specs.js` | 修改 | 按关键词删除而非清空整个目录 |
| `data/analysis_posts/<kw>/` | 新增目录 | 每帖 sub-agent 的精筛结果（由步骤 5 开始前主动创建） |

**不改动**：`filter-comments.js`、`generate-excel.js`、`save-task-spec.js`

---

## 强制执行规则（更新）

> **全流程自动串联执行，只有遇到报错或异常时才暂停通知用户。**
>
> 步骤 1 [并行启动] → 步骤 2 → 步骤 3 → 步骤 4 → 步骤 5 [并行精筛] → 步骤 6 → 步骤 7 → 步骤 8，全部自动执行。
>
> **串行降级时必须告知用户**：`⚠️ 当前环境不支持并行精筛，改为串行模式，速度较慢。`
