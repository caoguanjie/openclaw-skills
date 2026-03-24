---
name: xiaohongshu-browser-use
description: 小红书精准用户挖掘 skill。通过关键词搜索小红书帖子，抓取评论，使用 AI 分析用户兴趣信号（咨询购买、感谢喜爱、提问、分享经验），将感兴趣用户的信息导出为 Excel 表格。触发条件：用户要求搜索小红书内容、分析评论、挖掘目标用户、输出用户资料表格。依赖 browser-use 和 xlsx skills。
allowed-tools: Bash(browser-use:*)
---

# 小红书精准用户挖掘

通过关键词搜索小红书，抓取帖子评论，AI 判断用户兴趣，输出 Excel 用户资料表格。

## 依赖

- `browser-use` CLI（`$HOME/.browser-use-env/bin/browser-use`）
- `xlsx` skill（生成 Excel）

> browser-use 完整路径：`$HOME/.browser-use-env/bin/browser-use`

## 使用方式

用户告知关键词和数量，例如：
- "帮我搜索小红书关键词'减肥餐'，分析 20 个帖子的评论"
- "搜索'护肤品推荐'，找出感兴趣的用户"

未指定数量时，默认分析 20 个帖子的全部评论。

## 工作流程

### Step 1：登录小红书（首次或会话失效时）

```bash
# 启动有头浏览器，等待用户扫码
$HOME/.browser-use-env/bin/browser-use --headed open https://www.xiaohongshu.com

# 截图给用户确认是否看到二维码
$HOME/.browser-use-env/bin/browser-use screenshot /tmp/xhs_login.png
```

提示用户：**请在弹出的浏览器中扫码登录小红书**，完成后告诉我。

### Step 2：搜索关键词，获取帖子列表

```bash
# 导航到搜索页面
$HOME/.browser-use-env/bin/browser-use open "https://www.xiaohongshu.com/search_result?keyword=<关键词>&type=51"

# 等待结果加载
$HOME/.browser-use-env/bin/browser-use wait selector ".note-item" --timeout 10000

# 获取页面 HTML，提取帖子链接
$HOME/.browser-use-env/bin/browser-use get html --selector ".feeds-container"
```

滚动加载更多：
```bash
$HOME/.browser-use-env/bin/browser-use scroll down --amount 800
$HOME/.browser-use-env/bin/browser-use wait selector ".note-item"
```

### Step 3：逐帖抓取评论

对每个帖子 URL 执行：

```bash
$HOME/.browser-use-env/bin/browser-use open "<帖子URL>"
$HOME/.browser-use-env/bin/browser-use wait selector ".comment-item, .CommentList" --timeout 8000

# JavaScript 提取评论数据
$HOME/.browser-use-env/bin/browser-use eval "
JSON.stringify(
  Array.from(document.querySelectorAll('[class*=\"comment-item\"], [class*=\"CommentItem\"]')).map(el => ({
    username: el.querySelector('[class*=\"user-name\"], [class*=\"nickname\"]')?.innerText?.trim(),
    content: el.querySelector('[class*=\"content\"], [class*=\"text\"]')?.innerText?.trim(),
    time: el.querySelector('[class*=\"time\"], [class*=\"date\"]')?.innerText?.trim(),
    userLink: el.querySelector('a[href*=\"/user/profile\"]')?.href
  })).filter(c => c.username && c.content)
)
"
```

### Step 4：AI 判断兴趣信号

对每条评论，判断是否包含以下 4 种兴趣信号：

| 类型 | 关键特征 |
|------|---------|
| **咨询购买意向** | "在哪买""有链接吗""多少钱""怎么购买""求链接" |
| **感谢/喜爱表达** | "太好用了""感谢分享""真的有用""爱了""种草了" |
| **提问具体问题** | "怎么用""多久""适合什么肤质""和XX比哪个好" |
| **分享自身经验** | "我用了X天""我也试过""亲测有效""我的情况是" |

跳过：纯路过评论（"哈哈""666""👍"）、广告/引流评论（含链接或"加我"）

### Step 5：输出 Excel 表格

使用 xlsx skill 生成，字段：

| 字段 | 说明 |
|------|------|
| 用户名 | 小红书昵称 |
| 主页链接 | `/user/profile/<userId>` |
| 评论内容 | 原始评论文字 |
| 兴趣类型 | 咨询购买/感谢喜爱/提问问题/分享经验 |
| 来源帖子标题 | 评论所在帖子标题 |
| 来源帖子链接 | 帖子 URL |
| 粉丝数 | 如页面可见则记录 |
| 评论时间 | 评论发布时间 |
| 抓取时间 | 本次抓取时间戳 |

**输出路径：** `~/Desktop/xhs_users_<关键词>_<YYYYMMDD>.xlsx`

## 注意事项

1. 每次请求间隔 1-2 秒：`browser-use wait 2000`
2. 页面结构变化时，用 `browser-use state` 重新分析元素
3. 评论分页：点击"查看更多评论"或滚动触发加载
