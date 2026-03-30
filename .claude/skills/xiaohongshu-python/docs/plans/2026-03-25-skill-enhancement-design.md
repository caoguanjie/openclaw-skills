# xiaohongshu-skills 增强改造设计

> 日期: 2026-03-25
> 状态: 待实施

## 目标

在现有 Python CDP 引擎基础上，复刻 xiaohongshu-playwright 已验证的路径，为 xiaohongshu-skills 增加三项能力：

1. **CDP 前置检查** — 操作前确认 Chrome 远程调试可达
2. **xhs-analyze 子技能** — 评论分析 + 精准用户挖掘 + Excel 输出
3. **站点经验系统** — 全局的小红书平台经验积累机制

## 改造范围

### 1. SKILL.md 改造

#### 1.1 新增：前置检查段（插在"技能边界"之后）

```markdown
## 前置检查

在开始任何联网操作前，先用 Python 检查 CDP 可用性：

\```bash
python scripts/cli.py check-cdp
\```

检查项：
- Python 3.10+：必需
- Chrome remote-debugging 端口（9222）：TCP 探测 127.0.0.1:9222
- 通过 → 继续执行
- 未通过 → 引导用户：在 Chrome 地址栏打开 chrome://inspect/#remote-debugging，
  勾选 "Allow remote debugging for this browser instance"，可能需重启浏览器
```

#### 1.2 修改：路由表新增第 6 条

```markdown
6. **精准用户挖掘**（"分析评论 / 挖掘用户 / 潜客分析 / 评论采集"）→ 执行 `xhs-analyze` 技能。
```

#### 1.3 新增：全局站点经验约束

```markdown
## 站点经验

操作中积累的小红书平台经验，存储在 `references/site-patterns/xiaohongshu.md`。

**所有子技能在执行任何联网操作前，必须：**
1. 读取站点经验文件（如存在），了解已知的选择器、有效模式和已知陷阱
2. 经验标注了发现日期，当作"可能有效的提示"而非"保证正确的事实"
3. 如果按经验操作失败，回退通用模式

**所有子技能在操作完成后，如有新发现：**
- 新的 URL 模式、API 行为、选择器变化、陷阱
- 主动追加到站点经验文件对应段落，附带日期标记
- 只写经过验证的事实，不写未确认的猜测

**站点经验文件格式：**
\```markdown
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
\```
```

#### 1.4 新增：xhs-analyze 子技能段

```markdown
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

**Step 1: 搜索+采集**
- `cli.py search-feeds --keyword "<关键词>"` → 获取帖子列表
- 逐篇 `cli.py get-feed-detail --feed-id X --xsec-token Y` → 获取评论 JSON
- 采集结果暂存 `data/comments.json`

**Step 2: AI 分析兴趣度**（Claude 执行）
读取 data/comments.json，对每条评论进行三重判断：

1. **购买/合作意向**（关键词匹配）
   "怎么买""求链接""多少钱""在哪买""想入手""求推荐""有链接吗""怎么购买"

2. **深度内容相关**（语义判断）
   实质性提问、经验分享、深入讨论、对比分析

3. **用户自定义标准**
   根据用户提供的 interest_criteria 灵活判断

每条评论输出：
- interest_tags: 标签数组，如 ["购买意向", "深度讨论"]
- interest_score: 1-10 分
- reason: 判断理由（一句话）

跳过：纯路过评论（"哈哈""666""👍"）、广告引流（含外链或"加我"）
筛选：score >= 6 为感兴趣用户

输出 `data/analysis.json`

**Step 3: 生成 Excel**
- `cli.py generate-excel --input data/analysis.json`
- 输出 `output/xhs-<keyword>-<YYYYMMDD>.xlsx`

**analysis.json 格式：**
\```json
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
\```

| 命令 | 功能 |
|------|------|
| `cli.py search-feeds` | 关键词搜索帖子 |
| `cli.py get-feed-detail` | 获取帖子评论 |
| `cli.py generate-excel` | analysis.json → Excel |
```

### 2. 新增 CLI 子命令

#### 2.1 `check-cdp`

```python
# scripts/xhs/cdp_check.py
import socket

def check_cdp(host="127.0.0.1", port=9222, timeout=2) -> bool:
    """探测 Chrome CDP 端口是否可连接"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    result = sock.connect_ex((host, port))
    sock.close()
    return result == 0
```

CLI 集成：`cli.py check-cdp` → 输出 JSON `{"cdp": true/false, "host": "127.0.0.1", "port": 9222}`

#### 2.2 `generate-excel`

Python openpyxl 重写 generate-excel.js 的逻辑：

- 读取 analysis.json
- 16 列潜客管理表（4 区域分色表头）
  - 蓝色: 用户信息（用户名、主页链接、IP属地）
  - 绿色: 兴趣分析（评论数量、评论内容、兴趣得分、标签、理由）
  - 金色: 来源帖子（标题、链接、截图、总评论数、本次获取数）
  - 红色: 跟进管理（已关注、跟进状态、负责人）
- 得分高亮（>=8 绿色，>=6 黄色）
- 帖子间交替背景色
- 下拉选择（已关注: 是/否，跟进状态: 5 个选项）
- 超链接（用户主页、帖子链接）
- 帖子截图嵌入
- 自动筛选

CLI: `cli.py generate-excel --input data/analysis.json [--output path.xlsx]`
默认输出: `output/xhs-<keyword>-<YYYYMMDD>.xlsx`

### 3. 新增目录结构

```
xiaohongshu-skills/
├── references/
│   └── site-patterns/
│       └── xiaohongshu.md      # 站点经验（从零积累）
├── data/                        # 中间数据（.gitignore）
│   ├── comments.json
│   ├── analysis.json
│   └── screenshots/
├── output/                      # Excel 输出（.gitignore）
└── scripts/
    └── xhs/
        ├── cdp_check.py         # 新增：CDP 连接检查
        └── excel_generator.py   # 新增：Excel 生成（openpyxl）
```

### 4. 依赖变更

`pyproject.toml` 新增：
- `openpyxl` — Excel 生成

### 5. 不变的部分

- 原有 5 个子技能（xhs-auth, xhs-publish, xhs-explore, xhs-interact, xhs-content-ops）的 CLI 命令和行为不变
- `cli.py` 的现有子命令接口不变
- Python CDP 作为唯一执行引擎不变
- 技能边界约束不变

## 实施步骤

1. 新增 `scripts/xhs/cdp_check.py` + CLI 子命令 `check-cdp`
2. 新增 `scripts/xhs/excel_generator.py` + CLI 子命令 `generate-excel`
3. 创建 `references/site-patterns/xiaohongshu.md`（空模板）
4. 创建 `data/` 和 `output/` 目录，更新 `.gitignore`
5. 更新 `pyproject.toml` 添加 openpyxl 依赖
6. 改造 `SKILL.md`：添加前置检查、站点经验、xhs-analyze 子技能
7. 更新 `CLAUDE.md` CLI 子命令对照表
