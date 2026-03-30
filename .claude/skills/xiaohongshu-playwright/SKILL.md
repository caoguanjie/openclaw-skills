---
name: xiaohongshu-playwright
description: 在小红书上挖掘潜在客户和目标用户。搜索关键词相关帖子，自动采集评论，AI 分析每条评论的兴趣度和购买意向，筛选高价值用户导出 Excel 潜客管理表。当用户提到小红书找客户、小红书潜客挖掘、分析小红书评论、搜小红书帖子找目标用户、或任何涉及「在小红书上找到对某话题/产品感兴趣的人」的需求时触发。即使用户只是说「帮我看看小红书上谁对XX感兴趣」「小红书搜一下XX，找出想买的人」也应触发。支持 `/xiaohongshu-playwright` 命令调用。
---

# 小红书潜客挖掘器（Playwright 版）

从小红书评论中找到对你的产品/话题真正感兴趣的人，输出一份可直接用于销售跟进的 Excel 表。

## 依赖

- Node.js 22+
- Playwright（`npx playwright` 或全局安装）
- rebrowser-patches（`npm install rebrowser-patches`）— 修复 CDP leak 和 navigator.webdriver 检测，不装的话小红书反爬系统能直接识别出自动化浏览器
- exceljs（`npm install exceljs`）— Excel 生成脚本依赖

首次环境检查与安装统一在 **步骤 1a** 执行：

- npm 依赖安装：阿里镜像源（npmmirror）优先，失败回退官方源
- Playwright Chromium：先尝试阿里镜像源（npmmirror）下载，失败回退官方源
- skill 根目录通过 `.npmrc` 固定 `registry=https://registry.npmmirror.com`，重建 `node_modules` / `package-lock.json` 时默认走淘宝镜像
- 环境未就绪前，不进入运行模式选择和正式采集

## 使用方式

### 快速上手

**方式一：自然语言（推荐）**

直接用中文描述你的需求，AI 会自动识别并启动分析流程：

- "帮我在小红书搜索'医美'，分析评论，找出有兴趣的用户"
- "搜一下小红书上讨论'露营装备'的帖子，看看谁想买"
- "分析小红书'考研英语'相关帖子的评论，找出有辅导需求的用户"

**方式二：Skill 命令**

在支持 Skill 调用的智能体中使用命令直接触发：

- `/xiaohongshu-playwright 搜索"医美"，找出想做医美的用户`
- `/xiaohongshu-playwright 关键词"露营装备"，筛选有购买意向的评论用户`

> 支持的智能体：Claude Code、Codex、OpenClaw 等兼容 Skill 协议的 AI 工具。

### 进阶用法

**自定义筛选标准**

在请求中描述你的具体筛选条件，AI 会据此调整分析策略：

- "搜索'医美'，只找有明确购买意向的用户（提到价格、想做、求推荐）"
- "分析'留学'帖子评论，筛选出正在准备申请的学生（提到 GPA、选校、文书）"
- "搜索'装修'，找出近期有装修计划的业主，忽略纯吐槽的评论"

**调整分析参数**

可以在请求中指定分析范围：

- "搜索'医美'，分析 10 篇帖子，每篇最多看 50 条评论"
- "搜索'露营'，只要兴趣得分 8 分以上的高意向用户"
- "搜索'考研'，分析 3 篇热门帖子就够了"

| 可调参数 | 说明 | 默认值 |
|---------|------|--------|
| 帖子数量 | 最多分析几篇帖子 | 10 |
| 评论数量 | 每篇帖子最多采集评论数 | 0（硬上限 500） |
| 兴趣阈值 | 多少分以上算感兴趣 | 6 |

**多关键词批量分析**

支持一次请求分析多个关键词，结果分别导出：

- "分别搜索'医美''牙齿矫正''热玛吉'三个关键词，各分析 3 篇帖子"
- "搜索'考研英语'和'考研数学'，找出同时关注这两个话题的用户"

## 参数解析

从用户输入提取：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| keyword | 搜索关键词 | 必填 |
| interest_criteria | 兴趣判断标准描述 | 通用三重标准 |
| max_posts | 最多分析帖子数 | 10 |
| max_comments | 每帖最大评论数（0=全部） | 0（硬上限 500） |
| speed | 滚动速度（slow/normal/fast） | normal |

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
> - 步骤 5 并行精筛最多同时运行 3 个 sub-agent（MAX_CONCURRENT_AGENTS = 3）
> - 串行降级时**必须告知用户**：`⚠️ 当前环境不支持并行精筛，改为串行模式，速度较慢。`
> - 步骤 8 清理使用 `rm -rf`（安全处理不存在的目录），cleanup-task-specs 使用 `--keyword` 参数
> - 多关键词时：步骤 3-4 串行（共享 cookie）；步骤 5 可在各关键词完成步骤 4 后各自启动并行精筛
> - 每次运行都要落盘 task spec / candidates / analysis
> - 成功后清理 task spec（按关键词删除）和 analysis_posts 分片目录
> - 失败时保留以上文件以便复盘

## 工作流程

### 步骤 1 [并行启动]

AI 收到用户输入后，**立即同时发起以下两路，互不等待**：

#### 步骤 1a：环境检查

读取 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落，检查 `环境状态`、`Playwright依赖`、`Chromium浏览器` 三个字段。

**如果本地环境为「未设置」或「未就绪」**：

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "${SKILL_DIR}" && node scripts/bootstrap-playwright.js
```

该脚本内部已完成：
- `playwright@1.48.0`、`rebrowser-patches`、`exceljs` 的固定版本安装
- npm 源优先 `npmmirror`，失败回退官方源
- Playwright Chromium 下载优先 `npmmirror`，失败回退官方源
- Linux、macOS、Windows 的环境变量差异收口到脚本内部处理

如需**彻底重建依赖树与 lockfile**（例如 `package-lock.json` 里混入了 `registry.npmjs.org`）：

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -rf "${SKILL_DIR}/node_modules" "${SKILL_DIR}/package-lock.json"
cd "${SKILL_DIR}" && npm install --registry=https://registry.npmmirror.com
```

重建后应检查 `package-lock.json` 中的 `resolved` 是否统一指向 `https://registry.npmmirror.com/`。

执行时必须持续给用户反馈当前阶段，至少包括：
- 正在检查 npm 依赖
- 正在安装 npm 依赖（如需要）
- 正在检查 Playwright Chromium
- 正在下载 Playwright Chromium（首次安装可能较慢）
- 环境初始化完成

安装完成后，更新 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落：
- `环境状态: 已就绪`
- `Playwright依赖: 已安装`
- `Chromium浏览器: 已安装`
- `最后检查时间: <当前日期>`

**如果环境已就绪**：直接标记 1a 完成。

**如果安装失败**：把失败原因和当前阶段告诉用户，并在站点经验文件里补充备注，避免静默卡死。

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

仅在 **步骤 1a 已确认环境就绪后**，再读取 `references/site-patterns/xiaohongshu.md` 的「用户习惯」段落，检查「运行模式」字段。

**如果运行模式为「未设置」（首次使用）**：

> 首次使用，请选择浏览器运行方式：
>
> **A. 后台静默运行** — 浏览器在后台工作，不弹出窗口。适合已登录过、有 cookie 的场景。
>
> **B. 打开浏览器运行** — 能看到浏览器的操作过程，适合首次使用或需要调试。
>
> 选择后会记住你的偏好，后续默认使用这个模式。如果以后想切换，跟我说「切换到后台模式」或「切换到打开浏览器模式」即可。

用户选择后更新「用户习惯」段落：
- A → `运行模式: 后台静默运行`
- B → `运行模式: 打开浏览器运行`
- 同时更新 `设置时间` 为当前日期

**如果已有记录**：直接使用记录的模式，跳过询问。

**如果用户主动要求切换模式**：更新站点经验文件中的记录。

**术语映射**（AI 内部使用，不对用户展示技术术语）：
| 用户看到的 | 实际参数 |
|-----------|---------|
| 后台静默运行 | headless: true（默认，不加 --headed） |
| 打开浏览器运行 | --headed |

---

### 步骤 3：数据采集

> 所有路径均相对于 skill 基目录（即 `SKILL.md` 所在目录），运行时用绝对路径拼接。
> 此步骤默认 **步骤 1a 已完成环境检查**，这里不再重复安装依赖或浏览器。
> 多关键词时，本步骤按关键词顺序**串行**执行，共享同一 cookie 文件。

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
- `--max-posts` — 最多分析帖子数（默认 10，50/50 混合选取：前半顺序+后半随机）
- `--max-comments` — 每帖最大评论数（默认 0=全部，硬上限 500）
- `--speed slow|normal|fast` — 滚动速度（默认 normal，推荐首次使用 slow）
- `--headed` — 打开浏览器运行（默认后台静默运行）
- `--cookie-path` — cookie 文件路径
- `--output` — 输出 JSON 路径（默认 `data/comments_<关键词>.json`）

**帖子选取策略**: 搜索结果加载 2x 候选帖子，前半按搜索排序选取（热度优先），后半从剩余帖子中随机抽取（覆盖长尾内容）。

**增量去重**: 同一关键词多次运行时，脚本自动读取已有输出文件，跳过已采集的帖子 URL，新结果与旧结果合并保存。

**登录机制**: 默认无头运行。首次运行时脚本从 DOM 提取登录 QR 码图片并用系统默认程序打开，用户扫码后自动检测登录完成并保存 cookie。后续运行自动复用 cookie。

**反检测机制**: 脚本集成 rebrowser-patches（修复 CDP leak、navigator.webdriver）、随机 viewport 偏移、UA 轮换、反检测 initScript。

**输出产物**:
- `data/comments_<关键词>.json` — 帖子和评论数据（每帖含 `noteId` 字段）
- `data/screenshots/{noteId}.png` — 每篇帖子截图

**如果脚本报错**：检查站点经验文件的「已知陷阱」，尝试更新选择器。脚本修复后追加发现到经验文件。

---

### 步骤 4：粗筛

```bash
node "${SKILL_DIR}/scripts/filter-comments.js" \
  --input "${SKILL_DIR}/data/comments_<关键词>.json" \
  --output "${SKILL_DIR}/data/candidates_<关键词>.json" \
  --task-spec "<task-spec-path>"
```

粗筛只做确定性筛选，**不做语义判断**。它负责：
- 读取 task spec
- 排除明显无关帖子
- 排除明显噪声/引流评论
- 保留命中粗筛信号的候选评论

输出：`data/candidates_<关键词>.json`

---

### 步骤 5 [并行精筛]

读取 `data/candidates_<kw>.json`，对每个帖子**独立分发**精筛任务。

**启动前**：创建目录并清空残留分片（确保幂等）：

```bash
mkdir -p "${SKILL_DIR}/data/analysis_posts/<关键词>"
rm -f "${SKILL_DIR}/data/analysis_posts/<关键词>"/*.json
```

#### 分发策略（按运行平台）

**Claude Code（Agent tool）/ Openclaw（Sub-Agent）**：

对 candidates 中每帖，调用 Agent tool 或 Sub-Agent 派出独立 sub-agent。**最多同时运行 3 个 sub-agent**（MAX_CONCURRENT_AGENTS = 3），超出的排队等待。

**每个 sub-agent 的完整任务描述**（逐字传递给 sub-agent）：

```
你是一个评论语义分析 agent，只负责分析一篇帖子的评论。

任务：
1. 读取以下 task spec 文件，获取 semantic_focus 字段：<task-spec-path>
2. 对以下候选评论逐条进行语义判断（禁止用关键词匹配代替语义判断）：
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
  "totalComments": <commentCount 转为数字>,
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

输出路径：<SKILL_DIR>/data/analysis_posts/<关键词>/<noteId>.json
```

所有 sub-agent 全部完成后，进入步骤 6。

**其他平台（串行降级）**：

> ⚠️ 当前环境不支持 Agent 并行分发，改为串行精筛模式，速度较慢（每帖逐一处理）。

读取 `data/candidates_<关键词>.json`，按原有逐帖串行精筛流程处理，将所有结果合并写入 `data/analysis_<关键词>.json`（格式见步骤 6 输出），**跳过步骤 6**，直接进入步骤 7。

每条评论输出：
- `interestTags`: 逗号分隔字符串，如 `"购买意向, 深度讨论"`
- `interestScore`: 1-10 分
- `reason`: 判断理由（一句话）

**跳过**: 纯路过评论（"哈哈""666""👍"）、广告引流（含外链或"加我"）

**筛选**: `interestScore >= 6` 为感兴趣用户

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
> 脚本已实现完整的 16 列布局、帖子截图嵌入、条件格式、下拉选择等功能。
> 自行编写会导致命名格式不一致、功能缺失等问题。
> 输出路径格式为 `output/<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`，由脚本自动生成。

将 步骤 5 的 AI 分析结果保存为 `data/analysis_<关键词>.json`。`exceljs` 依赖已在步骤 1a 完成环境安装，此处直接运行：

```bash
node "${SKILL_DIR}/scripts/generate-excel.js" \
  --input "${SKILL_DIR}/data/analysis_<关键词>.json"
```

**analysis.json 格式**（由步骤 5 串行精筛或步骤 6 合并后生成）：

**Example:**
```json
{
  "keyword": "医美",
  "posts": [
    {
      "title": "做了热玛吉三个月后的真实感受",
      "url": "https://www.xiaohongshu.com/explore/6612a...",
      "screenshotFile": "/abs/path/to/data/screenshots/6612a....png",
      "totalComments": 45,
      "collectedComments": 30,
      "validComments": [
        {
          "username": "小美同学",
          "userId": "5f8a1b2c3d4e5f6a7b8c9d0e",
          "content": "姐妹这个多少钱啊？在哪做的？效果看着好自然",
          "ipLocation": "广东",
          "interestTags": "购买意向, 咨询",
          "interestScore": 8,
          "reason": "明确询问价格和机构，有强烈消费意向",
          "profileUrl": "https://www.xiaohongshu.com/user/profile/5f8a1b2c3d4e5f6a7b8c9d0e"
        }
      ]
    }
  ]
}
```

**Excel 布局**（16列潜客管理表，4区域分色表头）：

| 区域 | 列 | 说明 |
|------|-----|------|
| 用户信息 | 用户名 | 小红书昵称 |
| 用户信息 | 用户主页链接 | 可点击跳转 |
| 用户信息 | IP属地 | 筛选本地用户 |
| 兴趣分析 | 评论数量 | 该用户在此帖的评论数 |
| 兴趣分析 | 评论内容 | 编号分行合并 |
| 兴趣分析 | 兴趣得分 | 1-10 分（>=8 绿色，>=6 黄色） |
| 兴趣分析 | 兴趣标签 | AI 标签 |
| 兴趣分析 | 判断理由 | AI 理由 |
| 来源帖子 | 帖子标题 | 帖子标题 |
| 来源帖子 | 帖子链接 | 帖子 URL |
| 来源帖子 | 帖子截图 | 嵌入截图 |
| 来源帖子 | 帖子总评论数 | 该帖子评论总数 |
| 来源帖子 | 本次获取评论数 | 本次采集到的评论数 |
| 跟进管理 | 已关注 | 是/否（下拉选择） |
| 跟进管理 | 跟进状态 | 待跟进/已联系/有意向/已成交/已流失（下拉选择） |
| 跟进管理 | 负责人 | 团队成员姓名 |

**输出路径**: `<SKILL_DIR>/output/<keyword>_<YYYYMMDD>_<HH-mm>.xlsx`

---

### 步骤 8：清理临时文件

仅在整个流程**成功完成**后执行。

```bash
# 只删当前关键词的 task spec
node "${SKILL_DIR}/scripts/cleanup-task-specs.js" --keyword "<关键词>"

# 清理并行精筛分片（目录可能不存在，rm -rf 安全处理）
rm -rf "${SKILL_DIR}/data/analysis_posts/<关键词>"
```

**如中途失败**：保留 task spec 和分片文件以便复盘，不自动删除。

---

### 步骤 9：更新站点经验

执行过程中如有新发现（选择器变化、新陷阱、有效模式），追加到 `references/site-patterns/xiaohongshu.md` 对应段落并附日期标记。这些经验帮助下次运行更顺畅。

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
步骤 8：cleanup-task-specs.js --keyword <kw> + rm -rf analysis_posts/<kw>/
```

## 参考文件

按需读取，不必一次性全部加载：

| 文件 | 何时读取 | 内容 |
|------|---------|------|
| `references/site-patterns/xiaohongshu.md` | Step 1（开始前）、脚本报错时 | 已知选择器、有效模式、踩坑记录 |
| `references/execution-checklist.md` | 每个 Step 完成后 | 逐项确认清单，防止跳步遗漏 |

## 注意事项

- 脚本内置人类化延迟（300ms-2.5s）、多段 viewport 比例滚动，以及下滑后的偶发小幅上滑回拉——这些是防反爬的核心机制，绕过会导致账号被风控
- 首次使用推荐 `--speed slow`，因为新 cookie 的信任度低，慢速操作更安全
- 单次建议不超过 10 篇帖子——超过这个量级，小红书的行为分析系统容易标记异常
- cookie 过期时脚本会自动暂停并弹出 QR 码要求重新登录
- 如遇滑块验证码，需用户手动处理后脚本继续执行
- 国内网络环境下，环境初始化统一通过 `node scripts/bootstrap-playwright.js` 执行。skill 根目录 `.npmrc` 默认固定淘宝镜像，脚本内部优先使用阿里镜像源（npmmirror），失败时回退官方源，并处理 Linux、macOS、Windows 的环境变量差异
