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

首次环境检查与安装统一在 **Step 1.2** 执行：

- npm 依赖安装：阿里镜像源（npmmirror）优先，失败回退官方源
- Playwright Chromium：先尝试阿里镜像源（npmmirror）下载，失败回退官方源
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
> Step 1.8 生成 task spec → Step 2 采集数据 → Step 3A 基于 task spec 粗筛候选 → Step 3B AI 精筛 → Step 4 生成 Excel，全部自动串联执行。
> 只有在遇到报错或异常时才暂停通知用户，正常流程不允许中断。
> 最终把 Excel 文件路径告诉用户即可。
>
> **强约束**：
> - 必须先生成 `task spec`
> - 粗筛脚本必须读取 `task spec`
> - AI 精筛只处理粗筛后的候选评论
> - 每次运行都要落盘 `task spec / candidates / analysis`
> - 成功后清空 `data/task-specs/`，失败时保留以便复盘

## 工作流程

### Step 1: 读取站点经验

读取 `references/site-patterns/xiaohongshu.md`。小红书前端频繁改版，这个文件记录了历次成功的选择器和失败的尝试，能避免重复踩坑。

### Step 1.2: 确认本地环境

读取 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落，检查 `环境状态`、`Playwright依赖`、`Chromium浏览器` 三个字段。

**如果本地环境为「未设置」或「未就绪」**：

先执行环境检查与安装，完成前**不要询问用户运行模式**。

安装命令使用阿里镜像源（npmmirror）优先，失败后自动回退官方源：

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "${SKILL_DIR}" && npm install playwright rebrowser-patches exceljs --registry=https://registry.npmmirror.com 2>/dev/null || npm install playwright rebrowser-patches exceljs
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/ npx playwright install chromium 2>/dev/null || npx playwright install chromium
```

执行时必须持续给用户反馈当前阶段，至少包括：

- 正在检查 npm 依赖
- 正在安装 npm 依赖
- 正在检查 Playwright Chromium
- 正在下载 Playwright Chromium（首次安装可能较慢）
- 环境初始化完成

环境检查成功后，更新 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落：

- `环境状态: 已就绪`
- `Playwright依赖: 已安装`
- `Chromium浏览器: 已安装`
- `最后检查时间: <当前日期>`

**如果环境已就绪**：直接进入 Step 1.5，不重复执行安装。

**如果安装失败**：把失败原因和当前阶段告诉用户，并在站点经验文件里补充备注，避免静默卡死。

### Step 1.5: 确认运行模式

仅在 **Step 1.2 已确认环境就绪后**，再读取 `references/site-patterns/xiaohongshu.md` 的「用户习惯」段落，检查「运行模式」字段。

**如果运行模式为「未设置」（首次使用）**：

用文字询问用户：

> 首次使用，请选择浏览器运行方式：
>
> **A. 后台静默运行** — 浏览器在后台工作，不弹出窗口。适合已登录过、有 cookie 的场景。
>
> **B. 打开浏览器运行** — 能看到浏览器的操作过程，适合首次使用或需要调试。
>
> 选择后会记住你的偏好，后续默认使用这个模式。如果以后想切换，跟我说「切换到后台模式」或「切换到打开浏览器模式」即可。

用户选择后：
1. 更新 `references/site-patterns/xiaohongshu.md` 的「用户习惯」段落：
   - A → `运行模式: 后台静默运行`
   - B → `运行模式: 打开浏览器运行`
   - 同时更新 `设置时间` 为当前日期
2. 根据选择决定是否在采集命令中加 `--headed` 参数

**如果已有记录**：直接使用记录的模式，不再询问。

**如果用户主动要求切换模式**：更新站点经验文件中的记录。

**术语映射**（AI 内部使用，不对用户展示技术术语）：
| 用户看到的 | 实际参数 |
|-----------|---------|
| 后台静默运行 | headless: true（默认，不加 --headed） |
| 打开浏览器运行 | --headed |

### Step 1.8: 生成 Task Spec

AI 必须先根据用户原始提示词生成一份临时 `task spec`，再启动采集与粗筛。

**格式**：

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

**落盘规则**：

- 路径：`data/task-specs/<timestamp>_<keyword>.json`
- 每次任务单独生成，不复用旧文件
- 成功后清空 `data/task-specs/`
- 失败时保留当前文件用于复盘

**保存命令**：

```bash
node "${SKILL_DIR}/scripts/save-task-spec.js" \
  --keyword "<关键词>" \
  --json '<task-spec-json>'
```

### Step 2: 运行 Playwright 采集脚本

> 所有路径均相对于 skill 基目录（即 `SKILL.md` 所在目录），运行时用绝对路径拼接。
> 此步骤默认 **Step 1.2 已完成环境检查**，这里不再重复安装依赖或浏览器。

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
- `--task-spec` — Step 1.8 生成的 task spec 文件路径（必填）
- `--max-posts` — 最多分析帖子数（默认 10，50/50 混合选取：前半顺序+后半随机）
- `--max-comments` — 每帖最大评论数（默认 0=全部，硬上限 500）
- `--speed slow|normal|fast` — 滚动速度（默认 normal，推荐首次使用 slow）
- `--headed` — 打开浏览器运行（默认后台静默运行）
- `--cookie-path` — cookie 文件路径
- `--output` — 输出 JSON 路径（默认 `data/comments_<关键词>.json`）

**帖子选取策略**: 搜索结果加载 2x 候选帖子，前半按搜索排序选取（热度优先），后半从剩余帖子中随机抽取（覆盖长尾内容）。

**增量去重**: 同一关键词多次运行时，脚本自动读取已有输出文件，跳过已采集的帖子 URL，新结果与旧结果合并保存。不同关键词的数据互不影响。

**登录机制**: 默认无头运行。首次运行时脚本从 DOM 提取登录 QR 码图片并用系统默认程序打开（跨平台：Windows/macOS/Linux），用户扫码后自动检测登录完成并保存 cookie。后续运行自动复用 cookie。加 `--headed` 参数以有头模式运行（用于调试）。

**反检测机制**: 脚本集成 rebrowser-patches（修复 CDP leak、navigator.webdriver）、随机 viewport 偏移、UA 轮换、反检测 initScript（plugins/languages/permissions 伪装）。

**输出产物**:
- `data/comments_<关键词>.json` — 帖子和评论数据（按关键词分文件）
- `data/screenshots/{noteId}.png` — 每篇帖子的全景截图（帖子内容+评论区）

**如果脚本报错**：检查站点经验文件的「已知陷阱」，尝试更新选择器。脚本修复后追加发现到经验文件。

### Step 3: AI 分析兴趣度（两阶段）

分两阶段的原因：评论中通常 30-60% 是噪声（纯表情、广告、作者回复）。先用脚本快速过滤确定性噪声，再让 Claude 集中精力做语义分析——既省 token 又提高准确率。

#### 阶段 A: 脚本粗筛

运行粗筛脚本，基于 `task spec` 过滤确定性噪声和明显无关评论，产出候选评论：

```bash
node "${SKILL_DIR}/scripts/filter-comments.js" \
  --input "${SKILL_DIR}/data/comments_<关键词>.json" \
  --output "${SKILL_DIR}/data/candidates_<关键词>.json" \
  --task-spec "<task-spec-path>"
```

粗筛只做确定性筛选，**不做语义判断**。它负责：

- 读取 `task spec`
- 排除明显无关帖子
- 排除明显噪声/引流评论
- 保留命中粗筛信号的候选评论

脚本输出：

- `data/candidates_<关键词>.json`

#### 阶段 B: Claude 语义精筛

读取 `data/candidates_<关键词>.json`，**逐帖按批**对每条候选评论进行语义精筛：

**判断依据**：

- 用户原始提示词
- `task spec.semantic_focus`
- 候选评论上下文
- 帖子标题/内容/截图信息

> ⚠️ 禁止用硬编码关键词匹配代替语义判断。`task spec` 只负责粗筛，不负责最终结论。

每条评论输出：
- `interest_tags`: 标签数组，如 `["购买意向", "深度讨论"]`
- `interest_score`: 1-10 分
- `reason`: 判断理由（一句话）

**跳过**: 纯路过评论（"哈哈""666""👍"）、广告引流（含外链或"加我"）

**筛选**: `score >= 6` 为感兴趣用户

### Step 4: 生成 Excel

> **禁止自己编写 Excel 生成代码。必须调用 `generate-excel.js` 脚本。**
> 脚本已实现完整的 16 列布局、帖子截图嵌入、条件格式、下拉选择等功能。
> 自行编写会导致命名格式不一致、功能缺失等问题。
> 输出路径格式为 `output/<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`，由脚本自动生成。

将 Step 3 的 AI 分析结果保存为 `data/analysis_<关键词>.json`。`exceljs` 依赖已在 Step 1.2 完成环境安装，此处直接运行：

```bash
node "${SKILL_DIR}/scripts/generate-excel.js" \
  --input "${SKILL_DIR}/data/analysis_<关键词>.json"
```

**analysis.json 格式**（由 Claude 在 Step 3 后生成，按帖子分组）：

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
        },
        {
          "username": "护肤达人Lisa",
          "userId": "6a7b8c9d0e1f2a3b4c5d6e7f",
          "content": "我去年做的超声刀，恢复期比热玛吉短，但效果维持差不多。考虑今年换热玛吉试试",
          "ipLocation": "上海",
          "interestTags": "深度讨论, 购买意向",
          "interestScore": 7,
          "reason": "有医美经验且在对比项目，近期有消费计划",
          "profileUrl": "https://www.xiaohongshu.com/user/profile/6a7b8c9d0e1f2a3b4c5d6e7f"
        }
      ]
    }
  ]
}
```

**Excel 布局**（用户×帖子为中心，16列潜客管理表）：

行粒度：一行 = 一个用户在一个帖子下。同一用户同帖子多条评论用编号合并（①xxx ②xxx 分行展示）。

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

4区域分色表头（蓝/绿/金/红），帖子间交替背景色，自动筛选启用。

**输出路径**: `<SKILL_DIR>/output/<keyword>_<YYYYMMDD>_<HH-mm>.xlsx`

### Step 4.5: 清理 Task Spec

仅在整个流程成功完成后，清空 `data/task-specs/`。

如中途失败，必须保留当前 `task spec` 文件以便复盘，不得自动删除。

```bash
node "${SKILL_DIR}/scripts/cleanup-task-specs.js"
```

### Step 5: 更新站点经验

执行过程中如有新发现（选择器变化、新陷阱、有效模式），追加到 `references/site-patterns/xiaohongshu.md` 对应段落并附日期标记。这些经验帮助下次运行更顺畅。

## 数据管道总览

```
用户输入关键词（如"医美"）
    ↓
Step 1.2: 确认本地环境（首次检查并安装，后续复用）
    ↓
Step 1.5: 确认运行模式（首次询问，后续自动）
    ↓
Step 1.8: AI 生成 task spec → data/task-specs/<timestamp>_<keyword>.json
    ↓
Step 2: xhs-scraper.js → data/comments_医美.json + data/screenshots/
    ↓
Step 3A: filter-comments.js + task spec → data/candidates_医美.json
    ↓
Step 3B: AI 语义精筛 candidates → data/analysis_医美.json
    ↓
Step 4: generate-excel.js → output/医美_20260325_19-00.xlsx
    ↓
Step 4.5: 成功后清空 data/task-specs/
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
- 国内网络环境下，所有安装命令默认使用阿里镜像源（npmmirror），失败时回退官方源。Playwright 浏览器下载通过 `PLAYWRIGHT_DOWNLOAD_HOST` 环境变量加速
