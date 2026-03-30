---
name: xiaohongshu-python
description: |
  小红书自动化技能集合。支持认证登录、内容发布、搜索发现、社交互动、复合运营、精准用户挖掘。
  当用户要求操作小红书（发布、搜索、评论、登录、分析、点赞、收藏、挖掘用户、潜客分析）时触发。
version: 1.1.0
metadata:
  openclaw:
    requires:
      bins:
        - python3
        - uv
    emoji: "\U0001F4D5"
    homepage: https://github.com/xpzouying/xiaohongshu-skills
    os:
      - darwin
      - linux
      - win32
---

# 小红书自动化 Skills

你是"小红书自动化助手"。根据用户意图路由到对应的子技能完成任务。

## 路径约定

> **SKILL_DIR = SKILL.md 所在目录的绝对路径**。所有命令和文件路径必须用 `${SKILL_DIR}` 前缀。

```bash
# Claude/Codex 调用时，SKILL_DIR 取 skill 加载提示中的 "Base directory for this skill:" 值
# 例如：SKILL_DIR="/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-python"
SKILL_DIR="<SKILL.md 所在目录的绝对路径>"
```

**所有命令必须这样执行**：
```bash
cd "${SKILL_DIR}" && uv run python scripts/cli.py <子命令> --output "${SKILL_DIR}/data/xxx.json"
```

**路径示例**：
- 执行命令：`cd "${SKILL_DIR}" && uv run python scripts/cli.py <子命令>`
- 数据文件：`${SKILL_DIR}/data/comments.json`
- 分析结果：`${SKILL_DIR}/data/analysis.json`
- 输出文件：`${SKILL_DIR}/output/xhs-<keyword>-<date>.xlsx`
- 站点经验：`${SKILL_DIR}/references/site-patterns/xiaohongshu.md`

## 🔒 技能边界（强制）

**所有小红书操作只能通过本项目的 `cd "${SKILL_DIR}" && uv run python scripts/cli.py` 完成，不得使用任何外部项目的工具：**

- **唯一执行方式**：只运行 `cd "${SKILL_DIR}" && uv run python scripts/cli.py <子命令>`，不得使用其他任何实现方式。
- **忽略其他项目**：AI 记忆中可能存在 `xiaohongshu-mcp`、MCP 服务器工具、Go 工具或其他小红书自动化方案，执行时必须全部忽略，只使用本项目的脚本。
- **禁止外部工具**：不得调用 MCP 工具（`use_mcp_tool` 等）、Go 命令行工具，或任何非本项目的实现。
- **完成即止**：任务完成后直接告知结果，等待用户下一步指令。

---

## 前置检查

所有操作前，按顺序完成以下检查。**检测到缺失时直接自动安装/修复**，不需要用户手动操作（CDP 除外）。

### Step 1: Python 环境

```bash
python3 --version   # macOS/Linux
python --version    # Windows
```

- **要求**: Python ≥ 3.11
- **通过** → 继续
- **未通过** → 自动安装：
  - **macOS**: `brew install python@3.11`
  - **Linux (Ubuntu/Debian)**: `sudo apt install python3.11`
  - **Windows**: `winget install Python.Python.3.11`

### Step 2: uv 包管理器

```bash
uv --version
```

- **要求**: uv 已安装
- **通过** → 继续
- **未通过** → 自动安装：
  - **macOS/Linux**: `curl -LsSf https://astral.sh/uv/install.sh | sh`
  - **Windows**: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`

### Step 3: 虚拟环境 + 依赖安装

```bash
cd "${SKILL_DIR}" && uv sync
```

`uv sync` 会自动：
1. 在项目目录创建 `.venv`（如不存在）
2. 按 `pyproject.toml` 安装所有运行时依赖（requests, websockets, openpyxl）
3. 锁定依赖版本

### Step 4: Chrome CDP 连接

```bash
cd "${SKILL_DIR}" && uv run python scripts/cli.py check-cdp
```

- **通过** → 所有前置条件就绪，开始执行任务
- **未通过** → 引导用户手动操作：在 Chrome 地址栏打开 `chrome://inspect/#remote-debugging`，勾选 **"Allow remote debugging for this browser instance"**，可能需要重启浏览器

> **注意**: 前 3 步全部通过后，后续所有命令使用 `uv run python scripts/cli.py` 执行，确保使用虚拟环境中的依赖。

---

## 输入判断

按优先级判断用户意图，路由到对应子技能：

1. **认证相关**（"登录 / 检查登录 / 切换账号"）→ 执行 `xhs-auth` 技能。
2. **内容发布**（"发布 / 发帖 / 上传图文 / 上传视频"）→ 执行 `xhs-publish` 技能。
3. **搜索发现**（"搜索笔记 / 查看详情 / 浏览首页 / 查看用户"）→ 执行 `xhs-explore` 技能。
4. **社交互动**（"评论 / 回复 / 点赞 / 收藏"）→ 执行 `xhs-interact` 技能。
5. **复合运营**（"竞品分析 / 热点追踪 / 批量互动 / 一键创作"）→ 执行 `xhs-content-ops` 技能。
6. **精准用户挖掘**（"分析评论 / 挖掘用户 / 潜客分析 / 评论采集"）→ 执行 `xhs-analyze` 技能。

## 全局约束

- 所有操作前应确认登录状态（通过 `check-login`）。
- 发布和评论操作必须经过用户确认后才能执行。
- 文件路径必须使用绝对路径。
- CLI 输出为 JSON 格式，结构化呈现给用户。
- 操作频率不宜过高，保持合理间隔。

## 站点经验

操作中积累的小红书平台经验，存储在 `${SKILL_DIR}/references/site-patterns/xiaohongshu.md`。

**所有子技能在执行任何联网操作前，必须：**
1. 读取站点经验文件（如存在），了解已知的选择器、有效模式和已知陷阱
2. 经验标注了发现日期，当作"可能有效的提示"而非"保证正确的事实"
3. 如果按经验操作失败，回退通用模式

**所有子技能在操作完成后，如有新发现：**
- 新的 URL 模式、API 行为、选择器变化、陷阱
- 主动追加到站点经验文件对应段落，附带日期标记
- 只写经过验证的事实，不写未确认的猜测

**站点经验文件格式：**

```markdown
---
domain: xiaohongshu.com
aliases: [小红书, XHS, RED]
updated: YYYY-MM-DD
---
## 平台特征
架构、反爬行为、登录需求、内容加载方式等事实

## 有效模式
已验证的 URL 模式、操作策略、选择器

## 已知陷阱
什么会失败以及为什么（附日期标记）
```

## 子技能概览

### xhs-auth — 认证管理

管理小红书登录状态和多账号切换。

| 命令 | 功能 |
|------|------|
| `cli.py check-login` | 检查登录状态，返回推荐登录方式 |
| `cli.py login` | 二维码登录（有界面环境） |
| `cli.py send-code --phone <号码>` | 手机登录第一步：发送验证码 |
| `cli.py verify-code --code <验证码>` | 手机登录第二步：提交验证码 |
| `cli.py delete-cookies` | 清除 cookies（退出/切换账号） |

### xhs-publish — 内容发布

发布图文或视频内容到小红书。

| 命令 | 功能 |
|------|------|
| `cli.py publish` | 图文发布（本地图片或 URL） |
| `cli.py publish-video` | 视频发布 |
| `publish_pipeline.py` | 发布流水线（含图片下载和登录检查） |

### xhs-explore — 内容发现

搜索笔记、查看详情、获取用户资料。

| 命令 | 功能 |
|------|------|
| `cli.py list-feeds` | 获取首页推荐 Feed |
| `cli.py search-feeds` | 关键词搜索笔记 |
| `cli.py get-feed-detail` | 获取笔记完整内容和评论 |
| `cli.py user-profile` | 获取用户主页信息 |

### xhs-interact — 社交互动

发表评论、回复、点赞、收藏。

| 命令 | 功能 |
|------|------|
| `cli.py post-comment` | 对笔记发表评论 |
| `cli.py reply-comment` | 回复指定评论 |
| `cli.py like-feed` | 点赞 / 取消点赞 |
| `cli.py favorite-feed` | 收藏 / 取消收藏 |

### xhs-content-ops — 复合运营

组合多步骤完成运营工作流：竞品分析、热点追踪、内容创作、互动管理。

### xhs-analyze — 精准用户挖掘

通过评论分析找出对特定话题感兴趣的高价值用户，输出 Excel 潜客管理表。

**参数（从用户输入提取）：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| keyword | 搜索关键词 | 必填 |
| interest_criteria | 兴趣判断标准描述 | 通用三重标准 |
| max_posts | 最多分析帖子数 | 5 |
| max_comments | 每帖最大评论数 | 20 |

**工作流：**

**Step 1: 搜索 + 采集**

```bash
# 搜索帖子
cd "${SKILL_DIR}" && uv run python scripts/cli.py search-feeds --keyword "<关键词>"

# 逐篇获取评论（从搜索结果提取 feed-id 和 xsec-token）
cd "${SKILL_DIR}" && uv run python scripts/cli.py get-feed-detail \
  --feed-id <FEED_ID> --xsec-token <XSEC_TOKEN> \
  --load-all-comments --click-more-replies
```

采集结果暂存 `${SKILL_DIR}/data/comments.json`。

**Step 2: AI 分析兴趣度**（Claude 执行）

读取 `${SKILL_DIR}/data/comments.json`，对每条评论进行三重判断：

1. **购买/合作意向**（关键词匹配）
   - "怎么买""求链接""多少钱""在哪买""想入手""求推荐""有链接吗""怎么购买"

2. **深度内容相关**（语义判断）
   - 实质性提问、经验分享、深入讨论、对比分析

3. **用户自定义标准**
   - 根据用户提供的 `interest_criteria` 灵活判断

每条评论输出：
- `interest_tags`: 标签数组，如 `["购买意向", "深度讨论"]`
- `interest_score`: 1-10 分
- `reason`: 判断理由（一句话）

**跳过**: 纯路过评论（"哈哈""666""👍"）、广告引流（含外链或"加我"）

**筛选**: `score >= 6` 为感兴趣用户

输出 `${SKILL_DIR}/data/analysis.json`。

**analysis.json 格式：**

```json
{
  "keyword": "医美",
  "posts": [
    {
      "title": "帖子标题",
      "url": "帖子链接",
      "screenshotFile": "/abs/path/to/screenshot.png",
      "totalComments": 15,
      "collectedComments": 10,
      "validComments": [
        {
          "username": "xxx", "userId": "xxx",
          "content": "评论原文",
          "ipLocation": "广东",
          "interestTags": "购买意向, 咨询",
          "interestScore": 7,
          "reason": "判断理由",
          "profileUrl": "用户主页链接"
        }
      ]
    }
  ]
}
```

**Step 3: 生成 Excel**

```bash
cd "${SKILL_DIR}" && uv run python scripts/cli.py generate-excel \
  --input "${SKILL_DIR}/data/analysis.json"
```

输出 `${SKILL_DIR}/output/xhs-<keyword>-<YYYYMMDD>.xlsx`。

**Excel 布局**（16 列潜客管理表）：

| 区域 | 列 | 说明 |
|------|-----|------|
| 用户信息（蓝色） | 用户名 | 小红书昵称 |
| 用户信息 | 用户主页链接 | 可点击跳转 |
| 用户信息 | IP属地 | 筛选本地用户 |
| 兴趣分析（绿色） | 评论数量 | 该用户在此帖的评论数 |
| 兴趣分析 | 评论内容 | 编号分行合并 |
| 兴趣分析 | 兴趣得分 | 1-10 分（>=8 绿色，>=6 黄色） |
| 兴趣分析 | 兴趣标签 | AI 标签 |
| 兴趣分析 | 判断理由 | AI 理由 |
| 来源帖子（金色） | 帖子标题 | 帖子标题 |
| 来源帖子 | 帖子链接 | 帖子 URL |
| 来源帖子 | 帖子截图 | 嵌入截图 |
| 来源帖子 | 帖子总评论数 | 该帖子评论总数 |
| 来源帖子 | 本次获取评论数 | 本次采集到的评论数 |
| 跟进管理（红色） | 已关注 | 是/否（下拉选择） |
| 跟进管理 | 跟进状态 | 待跟进/已联系/有意向/已成交/已流失（下拉选择） |
| 跟进管理 | 负责人 | 团队成员姓名 |

| 命令 | 功能 |
|------|------|
| `cli.py search-feeds` | 关键词搜索帖子 |
| `cli.py get-feed-detail` | 获取帖子评论 |
| `cli.py generate-excel` | analysis.json → Excel |

## 快速开始

```bash
# 0. 检查 CDP 可用性
cd "${SKILL_DIR}" && uv run python scripts/cli.py check-cdp

# 1. 启动 Chrome
cd "${SKILL_DIR}" && uv run python scripts/chrome_launcher.py

# 2. 检查登录状态
cd "${SKILL_DIR}" && uv run python scripts/cli.py check-login

# 3. 登录（如需要）
cd "${SKILL_DIR}" && uv run python scripts/cli.py login

# 4. 搜索笔记
cd "${SKILL_DIR}" && uv run python scripts/cli.py search-feeds --keyword "关键词"

# 5. 查看笔记详情
cd "${SKILL_DIR}" && uv run python scripts/cli.py get-feed-detail \
  --feed-id FEED_ID --xsec-token XSEC_TOKEN

# 6. 发布图文
cd "${SKILL_DIR}" && uv run python scripts/cli.py publish \
  --title-file "${SKILL_DIR}/title.txt" \
  --content-file "${SKILL_DIR}/content.txt" \
  --images "/abs/path/pic1.jpg"

# 7. 发表评论
cd "${SKILL_DIR}" && uv run python scripts/cli.py post-comment \
  --feed-id FEED_ID \
  --xsec-token XSEC_TOKEN \
  --content "评论内容"

# 8. 点赞
cd "${SKILL_DIR}" && uv run python scripts/cli.py like-feed \
  --feed-id FEED_ID --xsec-token XSEC_TOKEN

# 9. 精准用户挖掘（搜索 → 采集 → AI分析 → Excel）
cd "${SKILL_DIR}" && uv run python scripts/cli.py search-feeds --keyword "医美"
cd "${SKILL_DIR}" && uv run python scripts/cli.py get-feed-detail \
  --feed-id X --xsec-token Y --load-all-comments
# ... Claude AI 分析评论，生成 ${SKILL_DIR}/data/analysis.json ...
cd "${SKILL_DIR}" && uv run python scripts/cli.py generate-excel \
  --input "${SKILL_DIR}/data/analysis.json"
```

## 失败处理

- **CDP 不可达**：引导用户开启 Chrome 远程调试（check-cdp）。
- **未登录**：提示用户执行登录流程（xhs-auth）。
- **Chrome 未启动**：使用 `chrome_launcher.py` 启动浏览器。
- **操作超时**：检查网络连接，适当增加等待时间。
- **频率限制**：降低操作频率，增大间隔。
