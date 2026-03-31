# xiaohongshu-playwright 测试计划

> 版本：2026-03-30  
> 适用对象：`/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright`  
> 目标：为 `xiaohongshu-playwright` skill 提供一份可直接用于自动化执行、回归验证和缺陷定位的完整测试文档。

## 1. 文档状态

本版文档替换旧版 `docs/xiaohongshu-playwright-test-plan.md`。

旧版问题：

- 使用了过时的 `.codex/skills/...` 路径
- 流程仍按旧的串行 Step 1.2 / 1.5 / 1.8 编号组织
- 未覆盖当前版本的并行启动、并行精筛、`merge-analysis.js`、多关键词和安装可见性要求

本版以以下文件为准：

- `/.claude/skills/xiaohongshu-playwright/SKILL.md`
- `/.claude/skills/xiaohongshu-playwright/scripts/bootstrap-playwright.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/save-task-spec.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/filter-comments.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/merge-analysis.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/generate-excel.js`
- `/.claude/skills/xiaohongshu-playwright/scripts/cleanup-task-specs.js`
- `/.claude/skills/xiaohongshu-playwright/references/site-patterns/xiaohongshu.md`

## 2. 测试目标

- 验证 skill 是否严格遵循当前 `SKILL.md` 定义的真实流程和约束
- 验证每个脚本的输入、输出、退出码、日志和中间产物符合预期
- 验证并行路径、串行降级路径、多关键词路径都能正确执行
- 验证首次环境安装阶段对用户可见，不会出现“无输出像卡死”的错误感知
- 验证失败时保留足够的复盘现场，成功时只清理应清理的文件

## 3. 测试范围

覆盖：

- 步骤 1a：环境检查与安装
- 步骤 1b：task spec 生成与落盘
- 步骤 2：运行模式确认与记忆
- 步骤 3：采集脚本 `xhs-scraper.js`
- 步骤 4：粗筛脚本 `filter-comments.js`
- 步骤 5：并行精筛协议与串行降级协议
- 步骤 6：`merge-analysis.js` 合并分片
- 步骤 7：`generate-excel.js` 导出 Excel
- 步骤 8：`cleanup-task-specs.js` 与 `analysis_posts` 清理
- 步骤 9：站点经验回写
- 多关键词批量运行
- 用户可见安装反馈

不覆盖：

- 小红书平台策略变化导致的业务结果波动
- AI 语义判断本身的绝对商业转化效果
- 用户后续销售跟进动作

## 4. 当前流程总览

```text
步骤 1 [并行启动]
  ├── 1a 环境检查
  │     -> bootstrap-playwright.js
  └── 1b 任务规格生成
        -> save-task-spec.js

步骤 2 运行模式确认

步骤 3 数据采集
  -> xhs-scraper.js
  -> data/comments_<kw>.json
  -> data/screenshots/<noteId>.png

步骤 4 粗筛
  -> filter-comments.js
  -> data/candidates_<kw>.json

步骤 5 并行精筛 / 串行降级
  并行:
    -> data/analysis_posts/<kw>/<noteId>.json
  串行降级:
    -> data/analysis_<kw>.json

步骤 6 合并分片
  -> merge-analysis.js
  -> data/analysis_<kw>.json

步骤 7 生成 Excel
  -> generate-excel.js
  -> output/<kw>_<YYYYMMDD>_<HH-mm>.xlsx

步骤 8 清理
  -> cleanup-task-specs.js --keyword <kw>
  -> rm -rf data/analysis_posts/<kw>

步骤 9 更新站点经验
  -> references/site-patterns/xiaohongshu.md
```

## 5. 自动化执行约定

自动化测试框架无论使用 Node、Playwright、shell harness 还是 CI pipeline，均应统一记录以下信息：

- 用例编号
- 开始时间和结束时间
- 触发方式
- 执行命令
- stdout
- stderr
- 退出码
- 生成文件列表
- 删除文件列表
- 最终判定

强制要求：

- 每条命令必须断言退出码
- 每个产物文件必须断言“存在 + JSON/Excel 结构正确”
- 每条失败用例必须归档日志和中间文件路径
- 涉及小红书真实站点的用例必须区分“脚本失败”和“平台环境波动”

建议：

- 脚本级用例尽量优先使用固定 fixture
- 真实站点 E2E 用例应单独分组，避免阻塞基础回归
- 所有以关键词为文件名的一律使用独立测试关键词，防止互相污染

## 6. 前置条件

执行前确认：

- Node.js 22+ 可用
- 当前仓库可读写
- 允许打开浏览器或系统默认图片查看器
- 测试网络可访问 npm 源和 Playwright 下载源
- 有一套可登录小红书 PC Web 的测试账号
- 允许创建和删除 `/.claude/skills/xiaohongshu-playwright/data/` 下的测试文件

建议准备三类关键词：

| 类型 | 关键词示例 | 用途 |
|------|------------|------|
| 高意向 | `医美` | 验证强兴趣识别链路 |
| 泛兴趣 | `露营装备` | 验证普通链路稳定性 |
| 噪声/低相关 | `赛道分析` | 验证粗筛排除能力 |

## 7. 关键目录与产物

关键目录：

- `/.claude/skills/xiaohongshu-playwright/data/`
- `/.claude/skills/xiaohongshu-playwright/data/task-specs/`
- `/.claude/skills/xiaohongshu-playwright/data/screenshots/`
- `/.claude/skills/xiaohongshu-playwright/data/analysis_posts/`
- `/.claude/skills/xiaohongshu-playwright/output/`

关键产物：

- `comments_<关键词>.json`
- `candidates_<关键词>.json`
- `analysis_<关键词>.json`
- `analysis_posts/<关键词>/<noteId>.json`
- `<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`

## 8. 测试分层

建议按四层执行：

1. 脚本级测试  
验证每个脚本的参数校验、输出结构和失败行为。

2. 协议级测试  
验证步骤之间的数据契约和文件命名约定。

3. 平台级测试  
验证 OpenClaw/Claude/Sub-Agent 运行时的并行和串行降级行为。

4. 真实站点 E2E  
验证登录、采集、限流、截图、Excel 导出的完整链路。

## 9. 总体验收标准

一次成功的完整运行至少应满足：

- 步骤 1a 与 1b 并行启动，且都完成后才进入步骤 2
- `data/task-specs/<timestamp>_<keyword>.json` 已生成
- `data/comments_<关键词>.json` 已生成
- `data/screenshots/` 下存在截图
- `data/candidates_<关键词>.json` 已生成，且包含 `taskSpecPath / taskSpec / posts / skippedPosts / stats`
- 并行路径下存在 `data/analysis_posts/<关键词>/<noteId>.json`
- 最终存在 `data/analysis_<关键词>.json`
- 最终存在 `output/<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`
- 成功时仅清理当前关键词的 task spec 与 `analysis_posts/<关键词>`
- 失败时保留 task spec、候选文件、analysis 分片和日志

## 10. 测试用例

### 10.1 步骤 1a 环境检查与安装

#### TC-ENV-001 首次运行环境未就绪

- 目标：验证首次运行会执行 `bootstrap-playwright.js`，而不是跳过环境检查。
- 前置条件：`xiaohongshu.md` 中 `环境状态`、`Playwright依赖`、`Chromium浏览器` 设为 `未设置` 或 `未就绪`。
- 操作：
  1. 触发 skill。
  2. 观察日志是否出现环境检查。
  3. 等待环境初始化完成。
- 预期结果：
  - 先执行步骤 1a，再执行步骤 2。
  - `references/site-patterns/xiaohongshu.md` 被更新为 `已就绪 / 已安装 / 已安装 / 当前日期`。

#### TC-ENV-002 环境已就绪快速跳过

- 目标：验证环境已就绪时不会重复安装。
- 前置条件：`本地环境` 四项已为已就绪状态。
- 操作：再次触发 skill。
- 预期结果：
  - 不再次安装 npm 依赖
  - 不再次下载 Chromium
  - 直接进入步骤 1b/步骤 2

#### TC-ENV-003 npm 依赖缺失

- 目标：验证依赖缺失时能明确安装或报错。
- 前置条件：删除 skill 目录下 `node_modules`。
- 操作：运行 `node scripts/bootstrap-playwright.js`。
- 预期结果：
  - 日志出现 `正在检查 npm 依赖`
  - 如需安装，出现 `正在安装固定版本 npm 依赖`
  - 安装成功后退出码为 0

#### TC-ENV-004 Chromium 缺失

- 目标：验证浏览器缺失时只补浏览器，不误报其他问题。
- 前置条件：保留 npm 依赖，删除或破坏 Playwright Chromium 安装。
- 操作：运行 `node scripts/bootstrap-playwright.js`。
- 预期结果：
  - 日志出现 `正在检查 Playwright Chromium`
  - 如需下载，出现 `正在通过 npmmirror 下载 Playwright Chromium`
  - 完成后退出码为 0

#### TC-ENV-005 安装回退逻辑

- 目标：验证 npmmirror 失败时可回退官方源。
- 方法：通过代理或假环境变量模拟镜像源失败。
- 预期结果：
  - npm 安装失败后出现 `npmmirror 安装失败，回退官方 npm 源`
  - Chromium 下载失败后出现 `Chromium 镜像下载失败，回退官方源`

#### TC-ENV-006 用户可见安装反馈

- 目标：验证初始安装时，用户在 OpenClaw 窗口中可以持续看到进度，不会误判为中断。
- 操作：
  1. 清空环境到首次安装状态。
  2. 从 OpenClaw 窗口触发 skill。
  3. 记录窗口内可见日志。
- 预期结果：
  - 窗口可见以下阶段性反馈中的大部分或全部：
    - `正在检查 npm 依赖`
    - `正在安装 npm 依赖`
    - `正在检查 Playwright Chromium`
    - `正在下载 Playwright Chromium`
    - `环境初始化完成`
  - 长耗时下载期间，窗口中不应表现为完全无反馈后直接完成或超时
- 失败判定：
  - 安装实际在执行，但 OpenClaw 窗口无任何阶段日志
  - 用户只能看到“处理中”，看不到具体安装进度

#### TC-ENV-007 `xhs-scraper.js` 缺浏览器报错

- 目标：验证采集脚本发现浏览器缺失时给出正确指令。
- 前置条件：移除 Chromium 安装。
- 操作：直接运行 `xhs-scraper.js`。
- 预期结果：
  - stderr 包含 `❌ Playwright 浏览器未安装`
  - stderr 包含 `请运行: node scripts/bootstrap-playwright.js`
  - 退出码非 0

### 10.2 步骤 1b task spec 生成

#### TC-SPEC-001 生成合法 task spec

- 目标：验证 `save-task-spec.js` 能生成合法 task spec 文件。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/save-task-spec.js" \
  --keyword "医美" \
  --json '{"keyword":"医美","post_relevance":{"include":["医美","热玛吉"],"exclude":["避雷"]},"comment_filter":{"include":["多少钱","想做"],"exclude":["加我","合作"]},"semantic_focus":"只保留明确购买意向用户"}'
```

- 预期结果：
  - stdout 输出绝对路径
  - 文件位于 `data/task-specs/`
  - JSON 包含 `keyword / post_relevance / comment_filter / semantic_focus`

#### TC-SPEC-002 缺少 `--keyword`

- 目标：验证必填参数校验。
- 操作：不传 `--keyword`。
- 预期结果：
  - 退出码非 0
  - stderr 报错 `--keyword 为必填参数`

#### TC-SPEC-003 缺少 `--json`

- 目标：验证必填参数校验。
- 操作：不传 `--json`。
- 预期结果：
  - 退出码非 0
  - stderr 报错 `--json 为必填参数`

#### TC-SPEC-004 非法数组结构

- 目标：验证 `include/exclude` 必须为数组。
- 操作：传入字符串形式的 `post_relevance.include`。
- 预期结果：
  - 退出码非 0
  - stderr 报错 `post_relevance.include 必须为数组`

#### TC-SPEC-005 并行启动时机

- 目标：验证步骤 1b 与步骤 1a 可并行启动，而不是等待环境安装结束。
- 操作：首次安装环境时触发 skill，观察日志与 task spec 落盘时间。
- 预期结果：
  - 环境安装尚未完成时，task spec 已可落盘
  - 两路都完成后才进入步骤 2

### 10.3 步骤 2 运行模式确认

#### TC-MODE-001 首次设置运行模式

- 目标：验证首次使用会询问运行模式并写回站点经验文件。
- 前置条件：`用户习惯` 中 `运行模式` 为 `未设置`。
- 操作：
  1. 触发 skill。
  2. 选择 `后台静默运行` 或 `打开浏览器运行`。
- 预期结果：
  - `xiaohongshu.md` 中 `运行模式` 和 `设置时间` 被更新

#### TC-MODE-002 已记录模式自动复用

- 目标：验证已有记录时不再重复询问。
- 前置条件：`运行模式` 已设置。
- 操作：再次触发 skill。
- 预期结果：
  - 不再次询问
  - 采集参数与记录一致

#### TC-MODE-003 主动切换模式

- 目标：验证用户主动切换时记录与实际执行同步更新。
- 操作：发送“切换到后台模式”或“切换到打开浏览器模式”。
- 预期结果：
  - `xiaohongshu.md` 中记录被更新
  - 本次运行使用新模式

### 10.4 步骤 3 采集脚本 `xhs-scraper.js`

#### TC-SCRAPER-001 基本采集成功

- 目标：验证采集链路可跑通。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/xhs-scraper.js" \
  --keyword "医美" \
  --task-spec "<task-spec-path>" \
  --max-posts 3 \
  --max-comments 20 \
  --speed slow \
  --cookie-path ".claude/skills/xiaohongshu-playwright/data/cookies.json" \
  --output ".claude/skills/xiaohongshu-playwright/data/comments_医美.json" \
  --headed
```

- 预期结果：
  - stdout 包含关键词、帖子数、评论数、运行模式、滚动速度、task spec 名称
  - `comments_医美.json` 已生成
  - `data/screenshots/` 下存在截图

#### TC-SCRAPER-002 缺少 `--task-spec`

- 目标：验证当前实现要求先有 task spec。
- 操作：不传 `--task-spec` 直接运行。
- 预期结果：
  - 退出码非 0
  - stderr 含 `必须传入 --task-spec`

#### TC-SCRAPER-003 cookie 缺失触发登录

- 目标：验证首次或 cookie 失效时进入登录流程。
- 前置条件：删除 `data/cookies.json`。
- 预期结果：
  - 有头模式：提示在浏览器窗口中登录
  - 无头模式：保存二维码 PNG 并提示扫码
  - 登录成功后保存 cookie

#### TC-SCRAPER-004 搜索页登录复核

- 目标：验证已有 cookie 但搜索页仍被登录层拦截时可继续等待登录。
- 前置条件：准备一个对首页有效、对搜索页无效的 cookie 场景。
- 预期结果：
  - 日志出现搜索页登录弹窗等待
  - 登录完成后继续抓取

#### TC-SCRAPER-005 增量去重

- 目标：验证同一关键词二次运行时会跳过已采集帖子。
- 操作：同一关键词执行两次。
- 预期结果：
  - 第二次运行识别已有输出文件
  - stdout 出现跳过已采集帖子的日志
  - 不重复写入已采集帖子

#### TC-SCRAPER-006 参数边界

- 目标：验证 CLI 参数边界。
- 检查点：
  - `--speed unknown` 会回退到 `normal`
  - `--max-comments 0` 解释为“全部，硬上限 500”
  - 缺少 `--keyword` 直接退出

#### TC-SCRAPER-007 限流处理

- 目标：验证出现 `300013 / 安全限制 / 访问频繁` 时的冷却与重试。
- 预期结果：
  - stdout 可见限流检测日志
  - 会进入冷却等待
  - 超过最大重试后跳过当前帖子，而不是整个进程卡死

#### TC-SCRAPER-008 无帖子结果

- 目标：验证无结果场景报错清晰。
- 操作：使用极低相关关键词或未登录状态触发。
- 预期结果：
  - stderr 包含 `未找到任何帖子`
  - 退出码非 0

#### TC-SCRAPER-009 失败现场保留

- 目标：验证采集中途失败时保留现场。
- 方法：中途断网或手动注入异常。
- 预期结果：
  - task spec 保留
  - 已生成的 comments 文件和截图不被误删

### 10.5 步骤 4 粗筛脚本 `filter-comments.js`

#### TC-FILTER-001 正常粗筛

- 目标：验证粗筛输出结构正确。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/filter-comments.js" \
  --input ".claude/skills/xiaohongshu-playwright/data/comments_医美.json" \
  --output ".claude/skills/xiaohongshu-playwright/data/candidates_医美.json" \
  --task-spec "<task-spec-path>"
```

- 预期结果：
  - stdout 包含 `✅ 粗筛完成`
  - 结果包含：
    - `keyword`
    - `taskSpecPath`
    - `taskSpec`
    - `posts`
    - `skippedPosts`
    - `stats`

#### TC-FILTER-002 缺少 `--task-spec`

- 目标：验证粗筛严格依赖 task spec。
- 操作：不传 `--task-spec`。
- 预期结果：
  - 退出码非 0
  - stderr 报错 `必须传入 --task-spec`

#### TC-FILTER-003 输入文件缺失

- 目标：验证输入文件不存在时能立即失败。
- 操作：传入不存在的 `--input`。
- 预期结果：
  - stderr 含 `输入文件不存在`
  - 退出码非 0

#### TC-FILTER-004 噪声过滤正确性

- 目标：验证确定性噪声会被过滤。
- 样本：
  - 作者回复
  - 纯表情
  - 纯 `@` 引用
  - 广告引流
- 预期结果：
  - 噪声不进入候选评论
  - `stats.filterReasons` 中能看到对应原因计数

#### TC-FILTER-005 帖子相关性过滤

- 目标：验证 `post_relevance.include/exclude` 生效。
- 预期结果：
  - 被排除帖子进入 `skippedPosts`
  - 保留帖子进入 `posts`

### 10.6 步骤 5 并行精筛与串行降级

#### TC-AI-001 并行精筛协议正确

- 目标：验证并行精筛每帖独立输出一个 JSON 分片。
- 前置条件：准备 `candidates_<关键词>.json`，至少包含 3 篇帖子。
- 操作：由支持 sub-agent 的宿主触发步骤 5。
- 预期结果：
  - 创建 `data/analysis_posts/<关键词>/`
  - 每个帖子输出 `<noteId>.json`
  - 单个分片结构包含：
    - `postId`
    - `title`
    - `url`
    - `screenshotFile`
    - `totalComments`
    - `collectedComments`
    - `validComments`

#### TC-AI-002 最大并发数限制

- 目标：验证最多同时运行 3 个 sub-agent。
- 方法：构造超过 3 篇帖子的 candidates 文件，记录启动顺序和并发数。
- 预期结果：
  - 同时运行的 sub-agent 数不超过 3
  - 其余任务排队

#### TC-AI-003 串行降级提示

- 目标：验证不支持并行分发的平台会明确提示串行降级。
- 操作：在不支持 sub-agent 的环境执行步骤 5。
- 预期结果：
  - 用户可见 `⚠️ 当前环境不支持 Agent 并行分发，改为串行精筛模式，速度较慢。`
  - 直接输出 `data/analysis_<关键词>.json`
  - 跳过步骤 6

#### TC-AI-004 结果字段正确

- 目标：验证语义分析输出可被下游消费。
- 每条有效评论至少应包含：
  - `username`
  - `userId`
  - `content`
  - `ipLocation`
  - `interestTags`
  - `interestScore`
  - `reason`
  - `profileUrl`

#### TC-AI-005 评分阈值生效

- 目标：验证仅 `interestScore >= 6` 的评论进入 `validComments`。
- 预期结果：
  - `validComments` 中不存在低于 6 分的评论

#### TC-AI-006 语义判断不退化为关键词匹配

- 目标：验证精筛不是粗筛关键词复用。
- 抽查要求：
  - 抽查 3 到 5 条高分评论
  - 抽查 3 条低分或被排除评论
- 预期结果：
  - `哈哈`、`666`、`👍` 不应判为高意向
  - 广告引流不应判为感兴趣用户

#### TC-AI-007 并行分片幂等

- 目标：验证每次运行前会清理残留分片。
- 前置条件：`analysis_posts/<关键词>/` 下存在旧 JSON。
- 操作：重新执行步骤 5。
- 预期结果：
  - 旧分片先清空
  - 新分片全部来自本次运行

### 10.7 步骤 6 合并脚本 `merge-analysis.js`

#### TC-MERGE-001 正常合并

- 目标：验证按 `candidates.json` 顺序合并分片。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/merge-analysis.js" \
  --keyword "医美" \
  --candidates ".claude/skills/xiaohongshu-playwright/data/candidates_医美.json" \
  --posts-dir ".claude/skills/xiaohongshu-playwright/data/analysis_posts/医美" \
  --output ".claude/skills/xiaohongshu-playwright/data/analysis_医美.json"
```

- 预期结果：
  - stdout 包含 `合并统计`
  - 输出 `analysis_医美.json`
  - `posts` 顺序与 candidates 中帖子顺序一致

#### TC-MERGE-002 分片缺失但失败率不超过 50%

- 目标：验证部分帖子失败时仍可合并。
- 前置条件：删掉少量分片。
- 预期结果：
  - stdout/stderr 有缺失分片警告
  - 仍生成 `analysis_<关键词>.json`
  - 退出码为 0

#### TC-MERGE-003 失败率超过 50%

- 目标：验证失败率过高时中止。
- 前置条件：删除超过一半的分片。
- 预期结果：
  - stderr 包含 `精筛失败率过高`
  - 退出码非 0
  - 不应把本次结果当作成功链路继续推进

#### TC-MERGE-004 candidates 文件不存在

- 目标：验证输入缺失立即失败。
- 操作：传不存在的 `--candidates`。
- 预期结果：
  - stderr 含 `candidates 文件不存在`
  - 退出码非 0

### 10.8 步骤 7 Excel 导出 `generate-excel.js`

#### TC-EXCEL-001 正常导出 Excel

- 目标：验证 analysis 文件可正确导出 Excel。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/generate-excel.js" \
  --input ".claude/skills/xiaohongshu-playwright/data/analysis_医美.json"
```

- 预期结果：
  - 输出路径位于 `output/`
  - 文件名格式为 `<关键词>_<YYYYMMDD>_<HH-mm>.xlsx`
  - stdout 包含帖子数、用户行数、嵌入截图数

#### TC-EXCEL-002 固定 16 列验证

- 目标：验证 Excel 结构未退化。
- 检查项：
  - 共 16 列
  - `K` 列为帖子截图
  - `N` 列为“已关注”下拉
  - `O` 列为“跟进状态”下拉

#### TC-EXCEL-003 多评论合并

- 目标：验证同一用户在同帖多条评论被合并。
- 预期结果：
  - 评论内容按 `① ② ③` 编号换行
  - 理由同样按编号合并
  - 得分取同用户评论中的最高分

#### TC-EXCEL-004 分数高亮

- 目标：验证条件格式行为。
- 预期结果：
  - `interestScore >= 8` 绿色高亮
  - `interestScore >= 6` 黄色高亮

#### TC-EXCEL-005 截图嵌入

- 目标：验证截图文件存在时会嵌入 K 列。
- 预期结果：
  - 工作簿中存在图片对象
  - 每帖截图只嵌入一次

#### TC-EXCEL-006 输入格式错误

- 目标：验证坏数据不会产出损坏 Excel。
- 方法：删掉 `posts` 或把它改成非数组。
- 预期结果：
  - 退出码非 0
  - stderr 出现 `生成失败`

### 10.9 步骤 8 清理

#### TC-CLEANUP-001 成功后仅清理当前关键词 task spec

- 目标：验证 `cleanup-task-specs.js --keyword` 只删除目标关键词对应文件。
- 前置条件：`task-specs/` 下存在多个关键词文件。
- 命令：

```bash
node ".claude/skills/xiaohongshu-playwright/scripts/cleanup-task-specs.js" --keyword "医美"
```

- 预期结果：
  - 仅名称匹配当前关键词的文件被删除
  - 其他关键词 task spec 保留

#### TC-CLEANUP-002 成功后清理 analysis 分片目录

- 目标：验证并行精筛临时分片只在成功后清理。
- 操作：完整成功运行一次。
- 预期结果：
  - `data/analysis_posts/<关键词>` 被删除

#### TC-CLEANUP-003 失败时保留现场

- 目标：验证失败后不自动清理关键现场。
- 方法：让步骤 5、6 或 7 失败。
- 预期结果：
  - task spec 保留
  - `analysis_posts/<关键词>` 保留
  - 候选文件和 analysis 文件按实际生成状态保留

### 10.10 步骤 9 站点经验回写

#### TC-PATTERN-001 新经验追加

- 目标：验证出现新选择器、新陷阱、新成功模式时会追加经验。
- 预期结果：
  - 写回 `references/site-patterns/xiaohongshu.md`
  - 带日期
  - 不覆盖既有经验记录

#### TC-PATTERN-002 环境字段更新时间

- 目标：验证环境初始化完成后会更新 `最后检查时间`。
- 预期结果：
  - 日期为本次运行日期

### 10.11 多关键词专项

#### TC-MULTI-001 多关键词串行采集

- 目标：验证多关键词时步骤 3 与步骤 4 串行执行。
- 操作：一次请求中输入多个关键词。
- 预期结果：
  - 采集与粗筛按关键词顺序执行
  - 共享同一个 cookie 文件

#### TC-MULTI-002 多关键词并行精筛

- 目标：验证每个关键词完成步骤 4 后可分别进入精筛。
- 预期结果：
  - 不同关键词拥有各自的 `analysis_posts/<关键词>/`
  - 不互相覆盖

#### TC-MULTI-003 多关键词清理隔离

- 目标：验证一个关键词成功清理时不误删另一个关键词的 task spec 或 analysis 分片。
- 预期结果：
  - 清理以关键词为粒度隔离

## 11. 推荐执行顺序

首次全链路建议：

1. `TC-ENV-001`
2. `TC-ENV-006`
3. `TC-SPEC-001`
4. `TC-MODE-001`
5. `TC-SCRAPER-001`
6. `TC-FILTER-001`
7. `TC-AI-001`
8. `TC-MERGE-001`
9. `TC-EXCEL-001`
10. `TC-CLEANUP-001`
11. `TC-PATTERN-001`

日常回归建议：

1. `TC-ENV-002`
2. `TC-SCRAPER-005`
3. `TC-FILTER-004`
4. `TC-AI-006`
5. `TC-MERGE-003`
6. `TC-EXCEL-002`
7. `TC-CLEANUP-003`

## 12. 重点风险清单

测试时应重点盯住以下高风险区域：

- OpenClaw 窗口对安装日志不可见，用户误判为中断
- 搜索页 cookie 与首页 cookie 行为不一致
- 评论区上下文在 modal / full-page 之间切换导致抓取不全
- 并行精筛分片缺失时合并失败
- 多关键词运行时文件覆盖或清理串扰
- Excel 结构被替代实现破坏

## 13. 缺陷记录模板

每个问题至少记录：

- 用例编号
- 触发时间
- 测试环境
- 关键词
- 运行模式
- 命令或触发语句
- stdout 路径
- stderr 路径
- 输入文件路径
- 输出文件路径
- 实际结果
- 预期结果
- 是否可稳定复现

## 14. 自动化测试落地建议

如果你要把这份文档转成自动化任务，建议拆成三组：

- `script-contract`  
覆盖 `save-task-spec.js`、`filter-comments.js`、`merge-analysis.js`、`generate-excel.js`、`cleanup-task-specs.js`

- `runtime-flow`  
覆盖 OpenClaw/skill 的步骤编排、日志反馈、串行降级、多关键词

- `real-site-e2e`  
覆盖真实小红书登录、采集、限流、截图和最终导出

其中 `TC-ENV-006` 必须进入 `runtime-flow` 组，单独作为阻断项。原因很简单：这不是脚本功能正确性问题，而是用户是否能看到“程序还活着”的产品体验问题。
