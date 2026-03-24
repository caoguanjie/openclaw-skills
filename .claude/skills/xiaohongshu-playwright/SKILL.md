---
name: xiaohongshu-playwright
description: 小红书评论分析与精准用户挖掘 skill（基于 Playwright）。通过关键词搜索小红书帖子，使用 Playwright 自动化采集评论数据，AI 三重标准分析用户兴趣度（购买意向、深度内容、用户自定义标准），筛选高分用户导出 Excel 表格。触发条件：用户要求搜索小红书内容并分析评论、使用 Playwright 采集小红书数据、挖掘目标用户并输出 Excel 资料表、`/xhs` 命令。依赖 Playwright 和 xlsx skill。
---

# 小红书评论分析器（Playwright 版）

通过 Playwright 自动化搜索小红书帖子、采集评论，AI 分析兴趣度，输出 Excel 用户资料表。

## 依赖

- Node.js 22+
- Playwright（`npx playwright` 或全局安装）
- xlsx skill（生成 Excel）

## 触发方式

- `/xhs "医美" "找对医美有兴趣的用户"`
- 自然语言: "帮我在小红书搜索'医美'，分析评论，找出对医美有兴趣的用户"

## 参数解析

从用户输入提取：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| keyword | 搜索关键词 | 必填 |
| interest_criteria | 兴趣判断标准描述 | 通用三重标准 |
| max_posts | 最多分析帖子数 | 5 |
| max_comments | 每帖最大评论数 | 20 |

## 工作流程

### Step 1: 读取站点经验

读取 `references/site-patterns/xiaohongshu.md` 获取已知选择器、有效模式和已知陷阱。

### Step 2: 运行 Playwright 采集脚本

> 所有路径均相对于 skill 基目录（即 `SKILL.md` 所在目录），运行时用绝对路径拼接。

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
# 如果是 Claude 调用，SKILL_DIR 为 SKILL.md 所在目录的绝对路径

node "${SKILL_DIR}/scripts/xhs-scraper.js" \
  --keyword "<关键词>" \
  --max-posts <数量> \
  --max-comments <数量> \
  --cookie-path "${SKILL_DIR}/data/cookies.json" \
  --output "${SKILL_DIR}/data/comments.json"
```

**登录机制**: 首次运行会打开浏览器并导航到登录页，脚本等待用户完成登录（检测 URL 变化），登录后自动保存 cookie。后续运行自动复用 cookie，可加 `--headless` 参数以无头模式运行。

**如果脚本报错**：检查站点经验文件的「已知陷阱」，尝试更新选择器。脚本修复后追加发现到经验文件。

### Step 3: AI 分析兴趣度

读取 `data/comments.json`，对每条评论进行三重判断：

**1. 购买/合作意向**（关键词匹配）
- "怎么买""求链接""多少钱""在哪买""想入手""求推荐""有链接吗""怎么购买"

**2. 深度内容相关**（语义判断）
- 实质性提问、经验分享、深入讨论、对比分析

**3. 用户自定义标准**
- 根据用户提供的 `interest_criteria` 灵活判断

每条评论输出：
- `interest_tags`: 标签数组，如 `["购买意向", "深度讨论"]`
- `interest_score`: 1-10 分
- `reason`: 判断理由（一句话）

**跳过**: 纯路过评论（"哈哈""666""👍"）、广告引流（含外链或"加我"）

**筛选**: `score >= 6` 为感兴趣用户

### Step 4: 生成 Excel

使用 xlsx skill 生成表格，字段：

| 字段 | 说明 |
|------|------|
| 序号 | 自增序号 |
| 用户名 | 小红书昵称 |
| 小红书号 | 用户 ID |
| 头像链接 | 头像 URL |
| 评论原文 | 完整评论内容 |
| 来源帖子 | 帖子标题 + 链接 |
| 兴趣标签 | AI 分析的兴趣标签 |
| 兴趣得分 | 1-10 分 |
| 判断理由 | AI 分析理由 |
| 用户主页链接 | 拼接的主页 URL |

**输出路径**: `<SKILL_DIR>/output/xhs-<keyword>-<YYYYMMDD>.xlsx`

### Step 5: 更新站点经验

执行完成后，如有新发现（新选择器、新陷阱、新模式），追加到 `references/site-patterns/xiaohongshu.md` 对应段落，附带日期标记。

## 注意事项

- 脚本内置随机延迟（1-3s 操作间隔，5-10s 帖子间隔），勿绕过
- 单次运行不超过 5 篇帖子，避免触发反爬
- cookie 过期时脚本会自动暂停要求重新登录
- 如遇验证码，需用户手动处理后继续
