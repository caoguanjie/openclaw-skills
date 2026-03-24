# 小红书评论分析器 Skill 设计文档

> 日期: 2026-03-24
> 状态: 已确认

## 概述

创建一个 Claude Code skill，通过 Playwright 自动化搜索小红书帖子、采集评论数据，由 AI 分析用户兴趣度，最终输出 Excel 用户资料表。

## 文件结构

```
~/.claude/skills/xhs-comment-analyzer/
├── SKILL.md                          # Skill 定义（触发规则 + 流程指引）
├── scripts/
│   └── xhs-scraper.js                # Playwright 采集脚本
├── data/
│   └── cookies.json                  # 持久化登录态（自动生成）
├── references/
│   └── site-patterns/
│       └── xiaohongshu.md            # 站点经验文件（自动维护）
└── output/                           # Excel 输出目录
```

## 触发方式

- **命令触发**: `/xhs "护肤" "找对护肤品感兴趣的用户"`
- **自然语言**: `帮我在小红书搜索"护肤"，分析评论，找出想买护肤品的用户`

## 核心流程

```
用户输入关键词 + 兴趣标准
       │
       ▼
SKILL.md 解析参数（关键词、评论数量、兴趣标准）
       │
       ▼
读取站点经验文件 xiaohongshu.md（如存在）
       │
       ▼
Bash: node xhs-scraper.js --keyword "X" --max-comments 20 --cookie-path ./cookies.json
       │
       ▼
脚本输出: comments.json
       │
       ▼
Claude AI 分析兴趣度（三重标准）
       │
       ▼
xlsx skill 生成 Excel 表格
       │
       ▼
更新站点经验文件（如有新发现）
```

## Playwright 采集脚本 (xhs-scraper.js)

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--keyword` | 搜索关键词 | 必填 |
| `--max-comments` | 每篇帖子最大评论数 | 20 |
| `--max-posts` | 最多分析帖子数 | 5 |
| `--cookie-path` | Cookie 存储路径 | `./data/cookies.json` |
| `--output` | JSON 输出路径 | `./data/comments.json` |

### 采集流程

1. 启动 Playwright (chromium, headless: false)
2. 加载持久化 cookie → 检测登录态
   - 已登录：继续
   - 未登录：打开登录页，暂停等待用户手动登录，登录后保存 cookie
3. 导航到搜索页: `https://www.xiaohongshu.com/search_result?keyword=XXX&source=web_search_result_note`
4. 等待搜索结果加载，提取帖子列表
5. 逐篇帖子：
   a. 点击打开帖子详情
   b. 滚动加载评论区（带随机延迟 1-3s）
   c. 提取评论数据：用户名、小红书号、头像URL、评论内容、点赞数
   d. 拼接用户主页链接: `https://www.xiaohongshu.com/user/profile/{userId}`
   e. 关闭帖子，返回搜索列表
6. 输出 JSON 到指定路径

### JSON 输出格式

```json
{
  "keyword": "护肤",
  "scrapeTime": "2026-03-24T10:30:00Z",
  "posts": [
    {
      "title": "帖子标题",
      "url": "帖子链接",
      "author": "作者名",
      "comments": [
        {
          "username": "用户名",
          "userId": "用户ID",
          "avatar": "头像URL",
          "content": "评论内容",
          "likes": 12,
          "profileUrl": "https://www.xiaohongshu.com/user/profile/xxx"
        }
      ]
    }
  ]
}
```

### 反检测措施（中级）

- 操作间随机延迟 1-3 秒
- 模拟真实滚动（wheel 事件，非 scrollTo）
- 单次运行不超过 5 篇帖子
- 失败自动重试（最多 3 次）
- 频率限制：两篇帖子间间隔 5-10 秒

## AI 分析流程

### 三重判断标准

1. **购买/合作意向**: 含"怎么买""求链接""多少钱""在哪买""想入手"等关键词
2. **深度内容相关**: 有实质性提问、经验分享、深入讨论
3. **用户自定义标准**: 根据用户输入的描述灵活判断（如"找想减肥的用户"）

### 分析输出

每条评论：
- `interest_tags`: 标签数组，如 `["购买意向", "深度讨论"]`
- `interest_score`: 1-10 分
- `reason`: 判断理由（一句话）

筛选标准：`score >= 6` 为「感兴趣用户」

## Excel 输出

| 字段 | 说明 |
|------|------|
| 序号 | 自增序号 |
| 用户名 | 小红书昵称 |
| 小红书号 | 用户ID |
| 头像链接 | 头像URL |
| 评论原文 | 完整评论内容 |
| 来源帖子 | 帖子标题 + 链接 |
| 兴趣标签 | AI分析的兴趣标签 |
| 兴趣得分 | 1-10分 |
| 判断理由 | AI分析理由 |
| 用户主页链接 | 拼接的主页URL |

输出路径: `~/.claude/skills/xhs-comment-analyzer/output/xhs-{keyword}-{date}.xlsx`

## 站点经验记录

### 位置

`~/.claude/skills/xhs-comment-analyzer/references/site-patterns/xiaohongshu.md`

### 格式

```markdown
---
domain: xiaohongshu.com
aliases: [小红书, XHS, RED]
updated: 2026-03-24
---
## 平台特征
- SPA 架构，评论区动态加载
- xsec_token 反爬机制
- 搜索结果需登录才能完整显示

## 有效模式
- [日期] 搜索URL模式、评论区选择器、用户信息提取策略

## 已知陷阱
- [日期] 失败情况描述和规避方式
```

### 机制

- **执行前**: SKILL.md 指引 Claude 先读取经验文件，获取已知选择器和陷阱
- **执行后（成功）**: 如发现新模式，追加到「有效模式」段
- **执行后（失败）**: 记录失败原因到「已知陷阱」段

## 技术依赖

- Node.js 22+（已安装）
- Playwright 1.57+（已全局安装）
- xlsx skill（已安装，用于生成 Excel）

## 未来扩展方向（不在本期范围）

- 选题分析
- 内容创作
- 复盘复刻
- 账号运营闭环
