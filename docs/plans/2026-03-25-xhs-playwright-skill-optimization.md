# 小红书 Playwright Skill 优化方案

## 背景

2026-03-25 执行「搜索医美关键字 → 采集评论 → 分析兴趣度 → 生成 Excel」全流程后，暴露出 5 个 Skill 设计缺陷：

| # | 缺陷 | 后果 |
|---|------|------|
| 1 | SKILL.md 未强制调用 generate-excel.js | 绕过现有脚本，手写残缺代码（14列 vs 16列，无截图嵌入） |
| 2 | Step 3 AI 分析定义模糊 | 用关键词匹配冒充 AI 分析，误判食物评论为医美兴趣 |
| 3 | 缺少帖子相关性验证 | 帖子1标题含医美但内容是食物，195条评论浪费 |
| 4 | 缺少执行 checklist | 跳步、遗漏验证无感知 |
| 5 | 环境依赖不明确 | python3 指向错误虚拟环境，尝试 3 次才成功 |

## 优化方案

### 1. Step 4 强制调用 generate-excel.js

**改动**: SKILL.md Step 4 措辞从「调用 Excel 生成脚本」改为明确的约束：

```markdown
### Step 4: 生成 Excel

⚠️ **必须调用 generate-excel.js 脚本，禁止手写替代代码。**

该脚本已实现完整 16 列布局、截图嵌入、条件格式、下拉选择等功能。

\`\`\`bash
cd "${SKILL_DIR}" && npm install exceljs --save 2>/dev/null
node "${SKILL_DIR}/scripts/generate-excel.js" \
  --input "${SKILL_DIR}/data/analysis.json"
\`\`\`
```

### 2. Step 3 两阶段分析

**当前问题**: 只说「对每条评论进行三重判断」，执行时被偷换为关键词匹配。

**改为两阶段**:

#### 阶段 A: 脚本粗筛（新增 scripts/filter-comments.js）

输入 `comments.json`，输出 `filtered-comments.json`。

过滤规则（宽粗筛，只去明确噪声）：
- 去除作者自己的回复
- 去除纯表情/emoji 评论（< 3 个有效中文字符）
- 去除纯 @ 引用（无实质内容）
- 去除广告引流（关键词：招聘、底薪、AI员工、获客、投资先做）
- **保留所有其他评论**，交给 Claude 判断

```bash
node "${SKILL_DIR}/scripts/filter-comments.js" \
  --input "${SKILL_DIR}/data/comments.json" \
  --output "${SKILL_DIR}/data/filtered-comments.json"
```

#### 阶段 B: Claude 语义精筛

读取 `filtered-comments.json`，**逐帖按批**进行三重判断：

1. **购买/合作意向**: 求推荐、求链接、询价、想预约、哪家
2. **深度内容相关**: 实质性提问、经验分享、对比讨论
3. **用户自定义标准**: 根据 interest_criteria 参数灵活判断

每条评论输出 score (1-10) + tags + reason。**score >= 6 为感兴趣用户**。

输出 `analysis.json`（格式不变）。

### 3. Step 2.5 帖子相关性验证（新增步骤）

采集完成后、分析之前，新增验证步骤：

```markdown
### Step 2.5: 验证帖子相关性

读取 `comments.json`，对每篇帖子：
1. 检查 title 和 desc（来自 __INITIAL_STATE__）与搜索关键词的相关性
2. 抽样检查前 10 条评论内容是否与关键词相关
3. 如果帖子内容明显偏离关键词（如标题含医美但内容是食物），标记为「不相关」并跳过分析
4. 在最终报告中说明跳过原因
```

**实现方式**: Claude 直接判断（不需要脚本），因为需要语义理解。

### 4. 独立 checklist 文件

新增 `references/execution-checklist.md`:

```markdown
# 执行 Checklist

## Step 1: 读取站点经验
- [ ] 已读取 references/site-patterns/xiaohongshu.md
- [ ] 已确认参数：keyword, max_posts, max_comments

## Step 2: 运行采集脚本
- [ ] 脚本执行成功，无报错
- [ ] comments.json 已生成且非空
- [ ] 截图已保存到 data/screenshots/
- ❌ 常见错误：cookie 过期需重新登录

## Step 2.5: 帖子相关性验证
- [ ] 每篇帖子的 title+desc 已与关键词匹配
- [ ] 不相关帖子已标记跳过并记录原因
- ❌ 常见错误：标题含关键词但内容无关（如标题党）

## Step 3: AI 分析兴趣度
- [ ] 阶段A: filter-comments.js 已运行，filtered-comments.json 已生成
- [ ] 阶段B: Claude 已逐帖语义分析，analysis.json 已生成
- [ ] analysis.json 格式正确（含 keyword, posts, validComments）
- ❌ 常见错误：用关键词匹配代替语义分析、漏掉帖子相关性验证

## Step 4: 生成 Excel
- [ ] 已安装 exceljs 依赖
- [ ] 已调用 generate-excel.js 脚本（禁止手写替代代码）
- [ ] Excel 输出到 output/ 目录
- [ ] 验证：16 列完整、截图已嵌入、下拉选择可用
- ❌ 常见错误：绕过脚本自写代码导致列缺失

## Step 5: 更新站点经验
- [ ] 新发现已追加到 xiaohongshu.md
```

### 5. 环境依赖明确

**改动**:
- SKILL.md 依赖部分明确：Node.js 22+ / Playwright / exceljs
- 去除所有 Python 依赖（generate-excel.js 已用 exceljs 实现完整功能）
- package.json 中添加 exceljs 依赖

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `SKILL.md` | 新增 Step 2.5、改写 Step 3（两阶段）、改写 Step 4（强制脚本）、引用 checklist |
| `scripts/filter-comments.js` | **新增** — 粗筛脚本 |
| `references/execution-checklist.md` | **新增** — 执行验证清单 |
| `package.json` | 添加 exceljs 依赖 |

## 验证方式

用同一个测试用例（搜索「医美」3篇帖子）重新执行全流程：
1. 确认帖子1被 Step 2.5 标记为不相关并跳过
2. 确认 Step 3 使用两阶段分析，无关键词匹配冒充
3. 确认 Step 4 调用 generate-excel.js，Excel 为 16 列含截图
4. 确认 checklist 每项均已勾选
