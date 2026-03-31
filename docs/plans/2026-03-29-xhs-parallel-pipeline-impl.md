# XHS 并行流水线 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 xiaohongshu-playwright skill 的串行流程改为并行流水线：步骤 1 [环境检查 || task spec 生成]、步骤 5 [每帖 1 sub-agent 并行精筛]、多关键词采集串行+精筛并行。

**Architecture:** 四处改动——(1) `xhs-scraper.js` 输出加 `noteId` 字段；(2) `cleanup-task-specs.js` 改为按关键词删除；(3) 新增 `merge-analysis.js` 合并帖子分片；(4) `SKILL.md` 全步骤重命名为 1-8 并加入并行指令。所有脚本改动不影响现有 CLI 接口。

**Tech Stack:** Node.js 22+，纯 fs/path 标准库，无新依赖

---

## Task 1: 给 `xhs-scraper.js` 的输出加 `noteId` 字段

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js:1511-1519`

**背景：** 当前 `newPosts.push({...})` 不包含 `noteId`，但 `posts[i].noteId` 已在搜索结果解析时提取（见第 510 行）。`merge-analysis.js` 需要这个字段来匹配分片文件名。

### Step 1: 找到 `newPosts.push` 这一段

打开 `.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`，定位第 1511-1519 行：

```js
        if (postData) {
          newPosts.push({
            title: postData.title || posts[i].title,
            url: posts[i].url,
            author: postData.author || posts[i].author,
            commentCount: postData.commentCount || "0",
            comments: postData.comments,
            screenshotFile: postData.screenshotFile || "",
          });
        }
```

### Step 2: 加入 `noteId` 字段

将上面的代码改为：

```js
        if (postData) {
          newPosts.push({
            title: postData.title || posts[i].title,
            url: posts[i].url,
            noteId: posts[i].noteId || extractNoteId(posts[i].url),
            author: postData.author || posts[i].author,
            commentCount: postData.commentCount || "0",
            comments: postData.comments,
            screenshotFile: postData.screenshotFile || "",
          });
        }
```

（`extractNoteId` 已在模块顶部定义，可直接调用）

### Step 3: 手动验证函数可用

搜索文件确认 `extractNoteId` 函数在调用位置的作用域内：

```bash
grep -n "^function extractNoteId" .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
```

期望输出：`243:function extractNoteId(value) {`（顶层函数，全局可用）

### Step 4: Commit

```bash
cd /Users/fits-vue/Documents/openclaw
git add .claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js
git commit -m "fix: add noteId to scraper output JSON for parallel analysis matching"
```

---

## Task 2: 修改 `cleanup-task-specs.js` 按关键词删除

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/scripts/cleanup-task-specs.js`

**背景：** 当前脚本删除 `data/task-specs/` 下所有 `.json` 文件。多关键词场景下，关键词 A 完成时会误删关键词 B 还在使用的 task spec。改为接受 `--keyword` 参数，只删匹配当前关键词的文件。保持无 `--keyword` 时删除全部（向后兼容单关键词流程）。

### Step 1: 完整替换脚本内容

用以下内容替换 `.claude/skills/xiaohongshu-playwright/scripts/cleanup-task-specs.js`：

```js
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  let keyword = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword") keyword = args[++i] || "";
  }
  return { keyword };
}

function sanitizeKeywordForFilename(keyword) {
  return String(keyword || "")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function main() {
  const { keyword } = parseArgs();
  const taskSpecDir = path.join(__dirname, "..", "data", "task-specs");

  if (!fs.existsSync(taskSpecDir)) {
    console.log(taskSpecDir);
    return;
  }

  const sanitized = sanitizeKeywordForFilename(keyword);
  const files = fs.readdirSync(taskSpecDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    // 如果指定了 keyword，只删匹配的文件（文件名包含 _<keyword>.json）
    if (sanitized && !file.endsWith(`_${sanitized}.json`)) continue;
    fs.unlinkSync(path.join(taskSpecDir, file));
  }

  console.log(taskSpecDir);
}

main();
```

### Step 2: 验证向后兼容（无参数时删所有）

```bash
cd /Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright
mkdir -p data/task-specs
echo '{}' > data/task-specs/2026-01-01T00-00-00_医美.json
echo '{}' > data/task-specs/2026-01-01T00-00-00_考研.json

# 只删医美的
node scripts/cleanup-task-specs.js --keyword 医美
ls data/task-specs/
# 期望：只剩 *_考研.json

# 无参数删全部
node scripts/cleanup-task-specs.js
ls data/task-specs/
# 期望：空（或只有 .gitkeep）
```

### Step 3: 清理测试文件

```bash
rm -f data/task-specs/*.json
```

### Step 4: Commit

```bash
cd /Users/fits-vue/Documents/openclaw
git add .claude/skills/xiaohongshu-playwright/scripts/cleanup-task-specs.js
git commit -m "fix: cleanup-task-specs accepts --keyword to avoid deleting concurrent task specs"
```

---

## Task 3: 新建 `merge-analysis.js`

**Files:**
- Create: `.claude/skills/xiaohongshu-playwright/scripts/merge-analysis.js`

**背景：** 步骤 5 的每个 sub-agent 将分析结果写入 `data/analysis_posts/<kw>/<noteId>.json`。此脚本按 `candidates.json` 中的帖子顺序读取各分片，合并为标准 `analysis_<kw>.json`。失败帖子 > 50% 时退出码 1。

### Step 1: 创建脚本文件

创建 `.claude/skills/xiaohongshu-playwright/scripts/merge-analysis.js`：

```js
#!/usr/bin/env node

/**
 * merge-analysis.js — 合并并行精筛分片为完整 analysis.json
 *
 * 用法:
 *   node merge-analysis.js \
 *     --keyword <kw> \
 *     --candidates data/candidates_<kw>.json \
 *     --posts-dir data/analysis_posts/<kw> \
 *     --output data/analysis_<kw>.json
 *
 * 行为:
 *   - 按 candidates.json 中帖子顺序读取分片文件
 *   - 分片文件名：<noteId>.json（由 sub-agent 写入）
 *   - 缺失分片：警告并跳过
 *   - 失败率 > 50%：打印错误摘要并以退出码 1 结束
 *   - 成功：写入 output 文件，打印统计摘要
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { keyword: "", candidates: "", postsDir: "", output: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword") opts.keyword = args[++i] || "";
    else if (args[i] === "--candidates") opts.candidates = args[++i] || "";
    else if (args[i] === "--posts-dir") opts.postsDir = args[++i] || "";
    else if (args[i] === "--output") opts.output = args[++i] || "";
  }
  if (!opts.keyword) throw new Error("--keyword 为必填参数");
  return opts;
}

function resolveDefaults(opts) {
  const skillDir = path.join(__dirname, "..");
  const safeKw = opts.keyword.replace(/[\\/:*?"<>|\s]+/g, "_");
  if (!opts.candidates)
    opts.candidates = path.join(skillDir, "data", `candidates_${safeKw}.json`);
  if (!opts.postsDir)
    opts.postsDir = path.join(skillDir, "data", "analysis_posts", safeKw);
  if (!opts.output)
    opts.output = path.join(skillDir, "data", `analysis_${safeKw}.json`);
  return opts;
}

function extractNoteId(url) {
  const match = String(url || "").match(/\/([a-f0-9]{24})\b/i);
  return match ? match[1] : "";
}

function main() {
  const opts = resolveDefaults(parseArgs());

  // 读 candidates.json
  if (!fs.existsSync(opts.candidates)) {
    console.error(`❌ candidates 文件不存在: ${opts.candidates}`);
    process.exit(1);
  }
  const candidates = JSON.parse(fs.readFileSync(opts.candidates, "utf-8"));
  const posts = candidates.posts || [];

  if (posts.length === 0) {
    console.warn("⚠️  candidates.json 中没有帖子，输出空 analysis");
    const result = { keyword: opts.keyword, posts: [] };
    fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");
    console.log(opts.output);
    return;
  }

  const merged = [];
  const missing = [];

  for (const post of posts) {
    const noteId = post.noteId || extractNoteId(post.url);
    if (!noteId) {
      console.warn(`  ⚠️  无法提取 noteId，跳过帖子: ${post.url}`);
      missing.push(post.url);
      continue;
    }

    const shardPath = path.join(opts.postsDir, `${noteId}.json`);
    if (!fs.existsSync(shardPath)) {
      console.warn(`  ⚠️  分片文件不存在，跳过: ${shardPath}`);
      missing.push(post.url);
      continue;
    }

    try {
      const shard = JSON.parse(fs.readFileSync(shardPath, "utf-8"));
      merged.push(shard);
    } catch (e) {
      console.warn(`  ⚠️  分片文件解析失败，跳过: ${shardPath} — ${e.message}`);
      missing.push(post.url);
    }
  }

  const total = posts.length;
  const successCount = merged.length;
  const failCount = missing.length;
  const failRate = failCount / total;

  console.log(`\n📊 合并统计: ${successCount}/${total} 帖子成功`);
  if (missing.length > 0) {
    console.warn(`  ⚠️  ${failCount} 个帖子分析失败:`);
    missing.forEach((url) => console.warn(`     - ${url}`));
  }

  // 失败率 > 50% 时中止
  if (failRate > 0.5) {
    console.error(
      `\n❌ 精筛失败率过高（${failCount}/${total} = ${Math.round(failRate * 100)}%），中止合并。`
    );
    console.error("   请检查 sub-agent 的执行日志，确认分片文件已写入。");
    process.exit(1);
  }

  // 写输出
  const outputDir = path.dirname(opts.output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const result = { keyword: opts.keyword, posts: merged };
  fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");

  console.log(`✅ 合并完成: ${opts.output}`);
  console.log(opts.output);
}

main();
```

### Step 2: 手动测试——正常路径

```bash
cd /Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright
mkdir -p data/analysis_posts/医美

# 造一个 candidates.json（2 帖子）
cat > /tmp/test-candidates.json << 'EOF'
{
  "keyword": "医美",
  "posts": [
    { "url": "https://www.xiaohongshu.com/explore/aabbcc112233445566778899", "noteId": "aabbcc112233445566778899", "title": "帖子A" },
    { "url": "https://www.xiaohongshu.com/explore/ddeeff001122334455667788", "noteId": "ddeeff001122334455667788", "title": "帖子B" }
  ]
}
EOF

# 造分片文件
echo '{"postId":"aabbcc112233445566778899","title":"帖子A","url":"...","screenshotFile":"","totalComments":10,"collectedComments":5,"validComments":[]}' \
  > data/analysis_posts/医美/aabbcc112233445566778899.json
echo '{"postId":"ddeeff001122334455667788","title":"帖子B","url":"...","screenshotFile":"","totalComments":8,"collectedComments":3,"validComments":[]}' \
  > data/analysis_posts/医美/ddeeff001122334455667788.json

node scripts/merge-analysis.js \
  --keyword 医美 \
  --candidates /tmp/test-candidates.json \
  --posts-dir data/analysis_posts/医美 \
  --output /tmp/test-analysis.json

# 期望：退出码 0，输出 "✅ 合并完成"
echo "退出码: $?"
cat /tmp/test-analysis.json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('帖子数:', d.posts.length)"
# 期望：帖子数: 2
```

### Step 3: 手动测试——失败率超阈值（> 50%）

```bash
# 删掉一个分片，制造 1/2 = 50% 失败（刚好不触发阈值）
rm data/analysis_posts/医美/aabbcc112233445566778899.json
node scripts/merge-analysis.js --keyword 医美 --candidates /tmp/test-candidates.json --posts-dir data/analysis_posts/医美 --output /tmp/test-analysis2.json
echo "退出码: $?"
# 期望：退出码 0（50% 不超过阈值），警告 1 个帖子缺失

# 删掉第二个分片，制造 2/2 = 100% 失败
rm data/analysis_posts/医美/ddeeff001122334455667788.json
node scripts/merge-analysis.js --keyword 医美 --candidates /tmp/test-candidates.json --posts-dir data/analysis_posts/医美 --output /tmp/test-analysis3.json
echo "退出码: $?"
# 期望：退出码 1，输出 "❌ 精筛失败率过高"
```

### Step 4: 清理测试文件

```bash
rm -rf data/analysis_posts/医美
rm -f /tmp/test-candidates.json /tmp/test-analysis.json /tmp/test-analysis2.json /tmp/test-analysis3.json
```

### Step 5: Commit

```bash
cd /Users/fits-vue/Documents/openclaw
git add .claude/skills/xiaohongshu-playwright/scripts/merge-analysis.js
git commit -m "feat: add merge-analysis.js to combine per-post analysis shards"
```

---

## Task 4: 重写 `SKILL.md` — 步骤 1-8 并行流水线

**Files:**
- Modify: `.claude/skills/xiaohongshu-playwright/SKILL.md`

**背景：** 当前 SKILL.md 使用 Step 1、Step 1.2、Step 1.5、Step 1.8、Step 2、Step 3、Step 4、Step 4.5、Step 5 的混合命名。需要重写为步骤 1-8，加入并行指令、sub-agent 分发模板、串行降级警告，并更新数据管道图。

### Step 1: 替换「工作流程」整节

找到 SKILL.md 中的 `## 工作流程` 至 `## 参考文件` 之间的内容，替换为：

```markdown
## 工作流程

### 步骤 1 [并行启动]

AI 收到用户输入后，**立即同时发起以下两路，互不等待**：

#### 步骤 1a：环境检查

读取 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落，检查 `环境状态`、`Playwright依赖`、`Chromium浏览器` 三个字段。

**如果本地环境为「未设置」或「未就绪」**：

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "${SKILL_DIR}" && npm install playwright rebrowser-patches exceljs --registry=https://registry.npmmirror.com 2>/dev/null || npm install playwright rebrowser-patches exceljs
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/ npx playwright install chromium 2>/dev/null || npx playwright install chromium
```

安装完成后，更新 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落：
- `环境状态: 已就绪`
- `Playwright依赖: 已安装`
- `Chromium浏览器: 已安装`
- `最后检查时间: <当前日期>`

**如果环境已就绪**：直接标记 1a 完成。

#### 步骤 1b：生成任务规格

**不依赖 1a，立即从用户原始提示词生成 task spec**（1b 不读取任何本地文件）：

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

落盘：

```bash
node "${SKILL_DIR}/scripts/save-task-spec.js" \
  --keyword "<关键词>" \
  --json '<task-spec-json>'
```

路径：`data/task-specs/<timestamp>_<keyword>.json`

---

**等待**：1a 和 1b **均完成**后，才进入步骤 2。
如果任意一路失败，停止并告知用户失败原因。

---

### 步骤 2：运行模式确认

读取 `references/site-patterns/xiaohongshu.md` 的「用户习惯」段落，检查「运行模式」字段。

**如果运行模式为「未设置」（首次使用）**：

> 首次使用，请选择浏览器运行方式：
>
> **A. 后台静默运行** — 浏览器在后台工作，不弹出窗口。适合已登录过、有 cookie 的场景。
>
> **B. 打开浏览器运行** — 能看到浏览器的操作过程，适合首次使用或需要调试。

用户选择后更新「用户习惯」段落：
- A → `运行模式: 后台静默运行`
- B → `运行模式: 打开浏览器运行`

**如果已有记录**：直接使用记录的模式，跳过询问。

| 用户看到的 | 实际参数 |
|-----------|---------|
| 后台静默运行 | headless: true（默认，不加 --headed） |
| 打开浏览器运行 | --headed |

---

### 步骤 3：数据采集

> 所有路径均相对于 skill 基目录。多关键词时，本步骤按关键词顺序**串行**执行，共享同一 cookie 文件。

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

node "${SKILL_DIR}/scripts/xhs-scraper.js" \
  --keyword "<关键词>" \
  --task-spec "<task-spec-path>" \
  --max-posts <数量> \
  --max-comments <数量> \
  --speed normal \
  --cookie-path "${SKILL_DIR}/data/cookies.json" \
  --output "${SKILL_DIR}/data/comments_<关键词>.json"
```

**CLI 参数**:
- `--keyword` — 搜索关键词（必填）
- `--task-spec` — 步骤 1b 生成的 task spec 文件路径（必填）
- `--max-posts` — 最多分析帖子数（默认 10）
- `--max-comments` — 每帖最大评论数（默认 0=全部，硬上限 500）
- `--speed slow|normal|fast` — 滚动速度（默认 normal）
- `--headed` — 打开浏览器运行
- `--cookie-path` — cookie 文件路径
- `--output` — 输出 JSON 路径

**输出产物**:
- `data/comments_<关键词>.json` — 帖子和评论数据（每帖含 `noteId` 字段）
- `data/screenshots/{noteId}.png` — 每篇帖子截图

**如果脚本报错**：检查站点经验文件的「已知陷阱」，尝试更新选择器。

---

### 步骤 4：粗筛

```bash
node "${SKILL_DIR}/scripts/filter-comments.js" \
  --input "${SKILL_DIR}/data/comments_<关键词>.json" \
  --output "${SKILL_DIR}/data/candidates_<关键词>.json" \
  --task-spec "<task-spec-path>"
```

粗筛只做确定性筛选，不做语义判断。输出：`data/candidates_<关键词>.json`

---

### 步骤 5 [并行精筛]

读取 `data/candidates_<kw>.json`，对每个帖子**独立分发**精筛任务。

**启动前**：创建 `data/analysis_posts/<关键词>/` 目录，并清空其中残留的旧分片文件（确保幂等）：

```bash
mkdir -p "${SKILL_DIR}/data/analysis_posts/<关键词>"
rm -f "${SKILL_DIR}/data/analysis_posts/<关键词>"/*.json
```

#### 分发策略（按运行平台）

**Claude Code（Agent tool）/ Openclaw（Sub-Agent）**：

对 candidates 中每帖，调用 Agent tool 或 Sub-Agent 派出独立 sub-agent。**最多同时运行 3 个 sub-agent**（MAX_CONCURRENT_AGENTS = 3），超出的排队等待。

**每个 sub-agent 的完整任务描述**（逐字传递）：

```
你是一个评论语义分析 agent，只负责分析一篇帖子的评论。

任务：
1. 读取以下 task spec 文件，获取 semantic_focus 字段：<task-spec-path>
2. 对以下候选评论逐条进行语义判断（禁止用关键词匹配代替）：
   - interestTags: 逗号分隔字符串，如 "购买意向, 咨询"
   - interestScore: 1-10 分
   - reason: 判断理由（一句话）
3. 只保留 interestScore >= 6 的评论
4. 将结果写入指定输出路径（JSON 格式）

帖子数据：
- noteId: <noteId>
- title: <帖子标题>
- url: <帖子链接>
- screenshotFile: <截图路径>
- commentCount: <原始评论总数>
- 候选评论列表: <comments-json>

输出格式（写入 <output-path>）：
{
  "postId": "<noteId>",
  "title": "<帖子标题>",
  "url": "<帖子链接>",
  "screenshotFile": "<截图路径>",
  "totalComments": <commentCount 数字>,
  "collectedComments": <候选评论条数>,
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
```

所有 sub-agent 全部完成后，进入步骤 6。

**其他平台（串行降级）**：

> ⚠️ 当前环境不支持 Agent 并行分发，改为串行精筛模式，速度较慢（每帖逐一处理）。

串行逐帖精筛，将所有结果合并写入 `data/analysis_<关键词>.json`，格式与步骤 6 输出相同，**跳过步骤 6**，直接进入步骤 7。

---

### 步骤 6：合并精筛结果

> 仅在**并行精筛路径**下执行。串行降级路径跳过此步骤。

```bash
node "${SKILL_DIR}/scripts/merge-analysis.js" \
  --keyword "<关键词>" \
  --candidates "${SKILL_DIR}/data/candidates_<关键词>.json" \
  --posts-dir "${SKILL_DIR}/data/analysis_posts/<关键词>" \
  --output "${SKILL_DIR}/data/analysis_<关键词>.json"
```

脚本按 candidates.json 的帖子顺序合并分片，失败率 > 50% 时中止并告知用户。

---

### 步骤 7：生成 Excel

> **禁止自己编写 Excel 生成代码。必须调用 `generate-excel.js` 脚本。**

```bash
node "${SKILL_DIR}/scripts/generate-excel.js" \
  --input "${SKILL_DIR}/data/analysis_<关键词>.json"
```

输出路径：`output/<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`

---

### 步骤 8：清理临时文件

仅在整个流程成功完成后执行。

```bash
# 只删当前关键词的 task spec
node "${SKILL_DIR}/scripts/cleanup-task-specs.js" --keyword "<关键词>"

# 清理并行精筛分片（目录可能不存在，使用 -rf 安全删除）
rm -rf "${SKILL_DIR}/data/analysis_posts/<关键词>"
```

**如中途失败**：保留 task spec 和分片文件以便复盘，不自动删除。

---

### 步骤 9：更新站点经验

执行过程中如有新发现（选择器变化、新陷阱、有效模式），追加到 `references/site-patterns/xiaohongshu.md` 对应段落。
```

### Step 2: 替换「数据管道总览」节

找到 `## 数据管道总览` 节，替换为：

```markdown
## 数据管道总览

```
用户输入关键词
    ↓
步骤 1 [并行启动]
  ├── 1a：读取站点经验 + 确认本地环境
  └── 1b：生成任务规格 → data/task-specs/<ts>_<kw>.json
    ↓ (1a 和 1b 均完成)
步骤 2：运行模式确认（首次询问，后续跳过）
    ↓
步骤 3：xhs-scraper.js → data/comments_<kw>.json（多关键词时串行）
    ↓
步骤 4：filter-comments.js → data/candidates_<kw>.json
    ↓
步骤 5 [并行精筛，最多 3 并发]
  ├── sub-agent (帖子1) → data/analysis_posts/<kw>/noteId1.json
  ├── sub-agent (帖子2) → data/analysis_posts/<kw>/noteId2.json
  └── sub-agent (帖子N) → data/analysis_posts/<kw>/noteIdN.json
    ↓ (全部完成 / 串行降级直接输出)
步骤 6：merge-analysis.js → data/analysis_<kw>.json
    ↓
步骤 7：generate-excel.js → output/<kw>_<YYYYMMDD>_<HH-mm>.xlsx
    ↓
步骤 8：cleanup-task-specs.js --keyword <kw> + rm analysis_posts/<kw>/
```
```

### Step 3: 替换「强制执行规则」节

找到 `## 强制执行规则` 节，替换为：

```markdown
## 强制执行规则

> **采集完成后必须一气呵成走完全流程，中间不得停顿询问用户。**
>
> 步骤 1 [并行启动] → 步骤 2 → 步骤 3 → 步骤 4 → 步骤 5 [并行精筛] → 步骤 6 → 步骤 7 → 步骤 8，全部自动串联执行。
> 只有在遇到报错或异常时才暂停通知用户，正常流程不允许中断。
> 最终把 Excel 文件路径告诉用户即可。
>
> **强约束**：
> - 必须先生成 task spec（步骤 1b），可与环境检查并行，但必须在步骤 3 前完成
> - 粗筛脚本必须读取 task spec（步骤 4）
> - 步骤 5 并行精筛最多同时运行 3 个 sub-agent
> - 串行降级时**必须告知用户**：`⚠️ 当前环境不支持并行精筛，改为串行模式，速度较慢。`
> - 步骤 8 清理必须检查目录存在性，使用 `rm -rf`（安全处理不存在的目录）
> - 多关键词时：步骤 3-4 串行；步骤 5 可在各关键词完成步骤 4 后各自启动
> - 每次运行都要落盘 task spec / candidates / analysis
> - 成功后清理 task spec（按关键词删除）和 analysis_posts 分片目录
> - 失败时保留以上文件以便复盘
```

### Step 4: 验证 SKILL.md 不含旧命名

```bash
grep -n "Step 1\.2\|Step 1\.5\|Step 1\.8\|Step 3A\|Step 3B\|Step 4\.5" \
  .claude/skills/xiaohongshu-playwright/SKILL.md
# 期望：无输出（旧命名已清除）
```

```bash
grep -n "步骤 [1-9]" .claude/skills/xiaohongshu-playwright/SKILL.md | head -20
# 期望：步骤 1-8/9 都能找到
```

### Step 5: Commit

```bash
cd /Users/fits-vue/Documents/openclaw
git add .claude/skills/xiaohongshu-playwright/SKILL.md
git commit -m "feat: rewrite SKILL.md with parallel pipeline steps 1-8"
```

---

## Task 5: 最终验收

### Step 1: 确认所有脚本可解析

```bash
cd /Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright
node --check scripts/xhs-scraper.js && echo "✅ xhs-scraper.js"
node --check scripts/cleanup-task-specs.js && echo "✅ cleanup-task-specs.js"
node --check scripts/merge-analysis.js && echo "✅ merge-analysis.js"
```

期望：三行 `✅`，无语法错误。

### Step 2: 确认 SKILL.md 结构完整

```bash
grep -c "^### 步骤" .claude/skills/xiaohongshu-playwright/SKILL.md
# 期望：9（步骤 1 的 1a/1b 各算一行，步骤 1 总标题 + 1a + 1b + 步骤 2-9 = 9+）

grep "MAX_CONCURRENT_AGENTS\|最多同时运行 3" .claude/skills/xiaohongshu-playwright/SKILL.md
# 期望：有输出（并发限制已标注）

grep "串行降级" .claude/skills/xiaohongshu-playwright/SKILL.md
# 期望：有输出（降级警告存在）
```

### Step 3: 最终 commit（如有未提交改动）

```bash
cd /Users/fits-vue/Documents/openclaw
git status
# 如有未提交文件，按需 add + commit
```

---

## 文件改动汇总

| 文件 | 类型 | 关键变化 |
|------|------|---------|
| `scripts/xhs-scraper.js` | 修改 | `newPosts.push` 加 `noteId` 字段 |
| `scripts/cleanup-task-specs.js` | 修改 | 接受 `--keyword`，按关键词删除，无参数删全部 |
| `scripts/merge-analysis.js` | 新增 | 合并分片，失败阈值 50%，按顺序保留帖子 |
| `SKILL.md` | 修改 | 步骤 1-9，并行启动、sub-agent 分发（最多 3 并发）、串行降级警告、多关键词串行采集 |

**不改动**：`filter-comments.js`、`generate-excel.js`、`save-task-spec.js`
