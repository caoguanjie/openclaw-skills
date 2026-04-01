# 手动测试清单

> 本文档涵盖需要真实浏览器、真实小红书账号或 sub-agent 支持的场景。  
> 执行前先阅读 `docs/xiaohongshu-playwright-test-plan.md` 了解完整约定。

---

## 前置准备

每次开始手动测试前，先执行一次全量清理：

```bash
# 删除测试关键词的所有遗留数据
cd /Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright

rm -f data/comments_医美.json
rm -f data/candidates_医美.json
rm -f data/analysis_医美.json
rm -rf data/analysis_posts/医美
rm -rf data/task-specs/
mkdir -p data/task-specs data/screenshots output
```

---

## 一、环境安装（TC-ENV 系列）

### TC-ENV-001 首次运行环境未就绪

**前置清理：**
```bash
# 备份再删除 node_modules（谨慎操作）
mv node_modules node_modules.bak
# 修改 references/site-patterns/xiaohongshu.md，将环境状态改为"未就绪"
```

**执行：**
```bash
node scripts/bootstrap-playwright.js
```

**验证：**
- [ ] 日志出现 `正在检查 npm 依赖`
- [ ] 日志出现 `正在安装` 或 `依赖已就绪`
- [ ] 日志出现 `正在检查 Playwright Chromium`
- [ ] 退出码为 0
- [ ] `references/site-patterns/xiaohongshu.md` 中环境状态更新为已就绪

---

### TC-ENV-002 环境已就绪快速跳过

**前置条件：** 已完成 TC-ENV-001，环境已就绪。

**执行：**
```bash
node scripts/bootstrap-playwright.js
```

**验证：**
- [ ] 不重复安装 npm 依赖
- [ ] 不重复下载 Chromium
- [ ] 退出码为 0，且耗时明显短于首次安装

---

### TC-ENV-003 npm 依赖缺失

**前置清理：**
```bash
rm -rf node_modules
```

**执行：**
```bash
node scripts/bootstrap-playwright.js
```

**验证：**
- [ ] 日志包含 `正在检查 npm 依赖`
- [ ] 安装成功后退出码为 0

---

### TC-ENV-004 Chromium 缺失

**前置清理：**
```bash
# 查找并删除 Playwright 的 Chromium 缓存
# macOS: ~/Library/Caches/ms-playwright/
rm -rf ~/Library/Caches/ms-playwright/chromium-*/
```

**执行：**
```bash
node scripts/bootstrap-playwright.js
```

**验证：**
- [ ] 日志包含 `正在检查 Playwright Chromium`
- [ ] 日志包含 `正在下载` 或 `浏览器已就绪`
- [ ] 退出码为 0

---

### TC-ENV-006 用户可见安装反馈（最高优先级）

**前置清理：**
```bash
rm -rf node_modules
rm -rf ~/Library/Caches/ms-playwright/chromium-*/
```

**执行：** 从 OpenClaw 窗口触发 skill（而非直接运行脚本）

**验证：**
- [ ] 窗口可见 `正在检查 npm 依赖`
- [ ] 窗口可见 `正在安装 npm 依赖`
- [ ] 窗口可见 `正在检查 Playwright Chromium`
- [ ] 窗口可见 `正在下载 Playwright Chromium`
- [ ] 窗口可见 `环境初始化完成`
- [ ] 下载期间**不应**出现长时间无任何输出

**失败判定：** 安装期间 OpenClaw 窗口完全无日志，用户只看到"处理中"。

---

### TC-ENV-007 xhs-scraper.js 缺浏览器报错

**前置清理：**
```bash
rm -rf ~/Library/Caches/ms-playwright/chromium-*/
```

**执行：**
```bash
node scripts/xhs-scraper.js \
  --keyword "医美" \
  --task-spec "data/task-specs/任意.json" \
  --output "data/comments_医美.json"
```

**验证：**
- [ ] stderr 包含 `Playwright 浏览器未安装`
- [ ] stderr 包含 `请运行: node scripts/bootstrap-playwright.js`
- [ ] 退出码非 0

---

## 二、运行模式（TC-MODE 系列）

### TC-MODE-001 首次设置运行模式

**前置清理：**
```bash
# 修改 references/site-patterns/xiaohongshu.md，将"运行模式"改为"未设置"
```

**执行：** 从 OpenClaw 触发 skill

**验证：**
- [ ] Skill 询问运行模式（后台/有头浏览器）
- [ ] 选择后 `references/site-patterns/xiaohongshu.md` 中 `运行模式` 和 `设置时间` 被更新

---

### TC-MODE-002 已记录模式自动复用

**前置条件：** `运行模式` 已设置。

**执行：** 再次触发 skill

**验证：**
- [ ] 不再次询问运行模式
- [ ] 直接使用已记录的模式

---

### TC-MODE-003 主动切换模式

**执行：** 发送 "切换到后台模式" 或 "切换到打开浏览器模式"

**验证：**
- [ ] `references/site-patterns/xiaohongshu.md` 中 `运行模式` 更新
- [ ] 本次运行使用新模式

---

## 三、采集脚本（TC-SCRAPER 系列）

### TC-SCRAPER-001 基本采集成功

**前置清理：**
```bash
rm -f data/comments_医美.json
rm -f data/cookies.json
```

**前置条件：** 准备好可登录小红书 PC Web 的测试账号。

**执行：**
```bash
# 先生成 task spec
node scripts/save-task-spec.js \
  --keyword "医美" \
  --json '{"keyword":"医美","post_relevance":{"include":["医美","热玛吉"],"exclude":["避雷"]},"comment_filter":{"include":["多少钱","想做"],"exclude":["加我","合作"]},"semantic_focus":"只保留明确购买意向用户"}'

# 运行采集（将 <task-spec-path> 替换为上一步输出的路径）
node scripts/xhs-scraper.js \
  --keyword "医美" \
  --task-spec "<task-spec-path>" \
  --max-posts 3 \
  --max-comments 20 \
  --speed slow \
  --headed \
  --output data/comments_医美.json
```

**验证：**
- [ ] stdout 包含关键词、帖子数、评论数、运行模式
- [ ] `data/comments_医美.json` 已生成
- [ ] `data/screenshots/` 下存在至少 1 张截图
- [ ] 退出码为 0

---

### TC-SCRAPER-003 cookie 缺失触发登录

**前置清理：**
```bash
rm -f data/cookies.json
```

**执行：**
```bash
node scripts/xhs-scraper.js \
  --keyword "医美" \
  --task-spec "<task-spec-path>" \
  --headed \
  --output data/comments_医美.json
```

**验证：**
- [ ] 脚本打开浏览器窗口，等待手动登录
- [ ] 日志提示 `请在浏览器窗口中完成登录`
- [ ] 等待窗口持续 5 分钟
- [ ] 登录成功后保存 `data/cookies.json` 并继续采集

**重要约定：** 脚本等待 5 分钟内，测试执行方不得强制中断。

---

### TC-SCRAPER-003A 人工登录等待窗口验证

**目标：** 验证脚本不会提前退出登录等待。

**执行：**
```bash
rm -f data/cookies.json
node scripts/xhs-scraper.js --keyword "医美" --task-spec "<path>" --headed --output data/comments_医美.json
```

**验证步骤：**
1. 出现 `请在浏览器窗口中完成登录` 后开始计时
2. 前 60 秒内仅观察日志，不操作
3. **验证：** 日志每 ~3 秒刷新一次等待时长
4. **验证：** 5 分钟内脚本不自行退出
5. 若需测试超时：等待 5 分钟后验证脚本输出 `登录超时（5分钟）` 后退出

---

### TC-SCRAPER-005 增量去重

**前置条件：** 已存在 `data/comments_医美.json`（至少含 2 帖）。

**执行：** 同一关键词再次运行采集

**验证：**
- [ ] stdout 出现"跳过已采集帖子"相关日志
- [ ] 不重复写入已采集的帖子

---

### TC-SCRAPER-007 限流处理

**执行：** 快速模式运行，观察是否触发限流

**验证：**
- [ ] 出现 `300013` / `安全限制` / `访问频繁` 时，日志显示进入冷却
- [ ] 超过最大重试后跳过当前帖子，不卡死整个进程

---

### TC-SCRAPER-008 无帖子结果

**执行：**
```bash
node scripts/xhs-scraper.js \
  --keyword "asdfghjklzxcvbnm_极低相关词" \
  --task-spec "<path>" \
  --output data/comments_测试无结果.json
```

**验证：**
- [ ] stderr 包含 `未找到任何帖子` 或类似提示
- [ ] 退出码非 0

---

## 四、精筛 sub-agent（TC-AI 系列）

> 需要在支持 sub-agent 的 OpenClaw 环境中执行。

### TC-AI-001 并行精筛协议正确

**前置条件：** 已有合法的 `data/candidates_医美.json`（≥3 帖）。

**执行：** 触发 skill 步骤 5（精筛阶段）

**验证：**
- [ ] `data/analysis_posts/医美/` 目录被创建
- [ ] 每帖输出一个 `<noteId>.json`
- [ ] 每个分片包含：postId / title / url / screenshotFile / totalComments / collectedComments / validComments

---

### TC-AI-002 最大并发数限制

**前置条件：** candidates 含 5+ 帖。

**验证：**
- [ ] 同时运行的 sub-agent 不超过 3 个

---

### TC-AI-003 串行降级提示

**执行：** 在不支持 sub-agent 的环境执行步骤 5

**验证：**
- [ ] 出现 `⚠️ 当前环境不支持 Agent 并行分发，改为串行精筛模式`
- [ ] 直接输出 `data/analysis_医美.json`，跳过步骤 6

---

### TC-AI-005 评分阈值生效

**验证：**
- [ ] `validComments` 中所有 `interestScore < 6` 的评论已被排除

---

### TC-AI-006 语义判断不退化为关键词匹配

**抽查方式：** 打开生成的 analysis JSON，抽查评论

**验证：**
- [ ] `哈哈`、`666`、`👍` 类评论不应得分 ≥ 6
- [ ] 广告引流评论不应被判为感兴趣用户

---

### TC-AI-007 并行分片幂等

**执行：** `data/analysis_posts/医美/` 存在旧分片时，重新执行步骤 5

**验证：**
- [ ] 旧分片先清空
- [ ] 新分片全部来自本次运行

---

## 五、多关键词（TC-MULTI 系列）

### TC-MULTI-001 多关键词串行采集

**前置清理：**
```bash
rm -f data/comments_露营装备.json data/comments_户外徒步.json
rm -f data/candidates_露营装备.json data/candidates_户外徒步.json
```

**执行：** 在一次请求中输入多个关键词

**验证：**
- [ ] 采集与粗筛按关键词顺序执行
- [ ] 共用同一个 `data/cookies.json`

---

### TC-MULTI-002 多关键词并行精筛

**验证：**
- [ ] `data/analysis_posts/露营装备/` 和 `data/analysis_posts/户外徒步/` 独立存在
- [ ] 两者内容不互相覆盖

---

### TC-MULTI-003 多关键词清理隔离

**执行：** 一个关键词成功完成全流程

**验证：**
- [ ] 仅该关键词的 task spec 被删除
- [ ] 另一关键词的 task spec 和 `analysis_posts/` 保留

---

## 六、站点经验回写（TC-PATTERN 系列）

### TC-PATTERN-001 新经验追加

**执行：** 完整运行一次 skill，发现新的 DOM 选择器或平台行为

**验证：**
- [ ] `references/site-patterns/xiaohongshu.md` 被更新
- [ ] 记录带日期
- [ ] 不覆盖既有记录

---

### TC-PATTERN-002 环境字段更新时间

**执行：** 运行 `bootstrap-playwright.js`

**验证：**
- [ ] `references/site-patterns/xiaohongshu.md` 中 `最后检查时间` 更新为今日日期

---

## 七、失败场景（TC-CLEANUP 系列补充）

### TC-CLEANUP-002 成功后清理 analysis_posts 分片目录

**执行：** 完整成功运行一次（含并行精筛）

**验证：**
- [ ] `data/analysis_posts/医美/` 被删除

---

### TC-CLEANUP-003 失败时保留现场

**执行：** 让步骤 5、6 或 7 失败

**验证：**
- [ ] task spec 保留
- [ ] `data/analysis_posts/医美/` 保留
- [ ] 候选文件和 analysis 文件按实际生成状态保留

---

## 缺陷记录模板

```
用例编号：
触发时间：
关键词：
运行模式（有头/无头）：
执行命令：
stdout 路径：
stderr 路径：
输入文件路径：
输出文件路径：
实际结果：
预期结果：
是否可稳定复现：
```
