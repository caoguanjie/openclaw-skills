# Sub-Agent 精筛任务模板

## 使用场景

步骤 5 并行精筛时，为每个帖子创建独立 sub-agent 的完整任务描述。

## 完整任务描述模板

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

## 使用说明

- **逐字传递**：将上述模板逐字传递给 sub-agent，不要修改模板结构
- **替换占位符**：
  - `<task-spec-path>` — task spec 文件的绝对路径
  - `<noteId>` — 帖子 ID
  - `<帖子标题>` — 帖子标题
  - `<帖子链接>` — 帖子 URL
  - `<截图路径>` — 截图文件路径
  - `<原始评论总数>` — 该帖子的总评论数
  - `<comments-json>` — 候选评论列表的 JSON 字符串
  - `<output-path>` — 输出文件的绝对路径
  - `<SKILL_DIR>` — skill 根目录的绝对路径
  - `<关键词>` — 搜索关键词

- **输出路径格式**：`data/analysis_posts/<关键词>/<noteId>.json`
- **并发控制**：最多同时运行 3 个 sub-agent（MAX_CONCURRENT_AGENTS = 3）

## 相关文档

- 主流程：`SKILL.md` 步骤 5
- 合并脚本：`scripts/merge-analysis.js`
