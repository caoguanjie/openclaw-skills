# 执行 Checklist

> 每个 Step 完成后必须逐项确认。未勾选的项需要说明原因。

## Step 1: 读取站点经验
- [ ] 已读取 `references/site-patterns/xiaohongshu.md`
- [ ] 已确认参数：keyword, max_posts, max_comments, interest_criteria

## Step 2: 运行采集脚本
- [ ] xhs-scraper.js 执行成功，无报错退出
- [ ] `data/comments.json` 已生成且包含帖子和评论数据
- [ ] `data/screenshots/` 下有对应帖子的截图文件
- [ ] 终端输出的帖子数和评论数符合预期

❌ **常见错误**:
- cookie 过期需重新登录（无头模式会自动弹出 QR 码）
- 搜索页登录弹窗需要在 searchPosts 中单独处理
- 评论数为 0 可能是评论区延迟加载，需增加等待

## Step 2.5: 帖子相关性验证
- [ ] 每篇帖子的 title + desc 已与搜索关键词比对
- [ ] 不相关帖子已标记跳过并记录原因
- [ ] 如有帖子被跳过，在最终报告中说明

❌ **常见错误**:
- 标题含关键词但内容无关（如标题党、搜索 SEO 优化帖）
- 视频帖子的 desc 可能为空，需结合评论内容判断

## Step 3: AI 分析兴趣度

### 阶段 A: 脚本粗筛
- [ ] 已运行 `filter-comments.js`
- [ ] `data/filtered-comments.json` 已生成
- [ ] 终端输出的过滤统计合理（通常过滤 30-60%）

### 阶段 B: Claude 语义精筛
- [ ] 已读取 `filtered-comments.json`
- [ ] **逐帖分批**进行三重判断（购买意向 + 深度内容 + 用户自定义标准）
- [ ] 每条评论有 score (1-10)、tags、reason
- [ ] `data/analysis.json` 已生成且格式正确
- [ ] 验证：抽查 3-5 条高分评论，确认判断合理

❌ **常见错误**:
- ⚠️ **禁止用关键词匹配代替语义分析** — 这是本 Skill 的核心价值
- 遗漏子评论中的高价值用户
- 食物/无关评论被误标为感兴趣（需结合帖子上下文）

## Step 4: 生成 Excel
- [ ] ⚠️ **必须调用 `generate-excel.js` 脚本，禁止手写替代代码**
- [ ] exceljs 依赖已安装（`npm install exceljs`）
- [ ] 脚本执行成功，Excel 输出到 `output/` 目录
- [ ] 验证：Excel 包含 16 列（用户信息3 + 兴趣分析5 + 来源帖子5 + 跟进管理3）
- [ ] 验证：帖子截图已嵌入 K 列
- [ ] 验证：下拉选择（已关注、跟进状态）可用

❌ **常见错误**:
- 绕过脚本手写 Python/Node 代码 → 列缺失、截图丢失
- exceljs 未安装导致脚本报错
- analysis.json 格式不符导致脚本解析失败

## Step 5: 更新站点经验
- [ ] 新发现（选择器变化、新陷阱）已追加到 `xiaohongshu.md`
- [ ] 附带日期标记
