# xiaohongshu-playwright 技能问题与优化清单

> 生成日期: 2026-03-26
> 状态: 待处理

---

## 一、关键架构缺陷（P0）

### 1. `__INITIAL_STATE__` 与滚动加载的数据断裂

**文件**: `scripts/xhs-scraper.js` — `extractComments()`, `parseStateComments()`

脚本通过 DOM 滚动触发评论懒加载（用 `.parent-comment` 计数），但最终从 `window.__INITIAL_STATE__` 提取评论数据。滚动加载的新评论可能通过 XHR 追加到 DOM，但**不一定回写到 `__INITIAL_STATE__`**。可能滚了 200 条评论，但只提取到初始加载的 20 条。

- 缺少 DOM fallback：如果 `__INITIAL_STATE__` 不完整，没有任何降级策略
- **建议**: 添加 DOM 提取作为后备，或用 `page.route()` 拦截评论 API 响应

### 2. 无验证码检测逻辑

**文件**: `scripts/xhs-scraper.js`

SKILL.md 提到「如遇验证码，需用户手动处理」，但脚本中完全没有验证码检测代码。中途触发滑块验证后，脚本会继续盲目滚动直到超时。

- **建议**: 检测验证码页面元素，暂停执行并通知用户

### 3. `INACCESSIBLE_KEYWORDS` 定义了但从未使用

**文件**: `scripts/human.js:31-41` 定义，`scripts/xhs-scraper.js` 未引用

打开已删除/私密帖子时，脚本会白白滚动到超时才放弃。

- **建议**: 在 `extractComments()` 打开帖子后检查页面文本是否包含不可访问关键词，命中则立即跳过

---

## 二、反检测不足（P1）

### 4. UA 版本严重过时

**文件**: `scripts/human.js:46-52`

Chrome 版本是 124/125（2024 年中），当前应为 Chrome 131+。过时的 UA 是明显的机器人指纹。

- **建议**: 更新到当前主流版本，或动态获取最新 Chrome 版本号

### 5. `navigator.platform` 硬编码为 `'MacIntel'`

**文件**: `scripts/xhs-scraper.js:152`

在 Windows 机器上运行时 UA 说 Windows 但 platform 说 MacIntel，指纹矛盾。

- **建议**: 根据选中的 UA 动态匹配 platform 值

### 6. `hardwareConcurrency` 和 `deviceMemory` 固定值

**文件**: `scripts/xhs-scraper.js:159, 166`

都硬编码为 8，每次运行指纹完全一致。

- **建议**: 随机选取合理值（4/6/8/12/16）

### 7. `rebrowser-patches` 静默降级

**文件**: `scripts/xhs-scraper.js:15-18`

未安装时静默跳过，但没有它 CDP leak 检测会直接暴露自动化。

- **建议**: 未安装时输出明确警告，或改为强制依赖

---

## 三、数据质量问题（P1-P2）

### 8. 崩溃时数据全部丢失

**文件**: `scripts/xhs-scraper.js:1002-1012`

帖子数据在全部处理完后才一次性写入。中途崩溃，已完成的帖子数据全部丢失。

- **建议**: 每处理完一篇帖子就增量保存

### 9. 子评论提取不完整

点击「展开 N 条回复」后，新加载的子评论可能不在 `__INITIAL_STATE__` 中（同问题 1）。

### 10. 评论时间未归一化

**文件**: `scripts/xhs-scraper.js:517`

`createTime` 存的是原始值，在 `filter-comments.js` 和 `generate-excel.js` 中都没用到。无法按评论时间排序或筛选近期评论。

- **建议**: 归一化为 ISO 时间字符串，Excel 中增加评论时间列

### 11. 搜索结果无排序/时间筛选

**文件**: `scripts/xhs-scraper.js:341`

搜索 URL 没有 `sort` 或 `time_range` 参数，永远用默认排序，无法筛选「最近一周」的帖子。

- **建议**: 添加 `--sort` 和 `--time-range` CLI 参数

### 12. 搜索结果页只加载一屏

**文件**: `scripts/xhs-scraper.js:388-432`

`searchPosts` 没有滚动加载更多搜索结果的逻辑。如果 `maxPosts=10` 但首屏只有 6 篇，就只能拿 6 篇。

- **建议**: 添加搜索结果页滚动加载逻辑

---

## 四、健壮性不足（P2）

### 13. 无失败重试

**文件**: `scripts/xhs-scraper.js:974-992`

帖子处理失败只 `console.error` 跳过，没有重试机制。

- **建议**: 添加可配置的重试次数（默认 1-2 次）

### 14. 运行中无登录态检查

只在启动时检查登录态。长时间运行过程中 cookie 可能过期，但不会重新检测。

- **建议**: 每 N 篇帖子后或检测到异常响应时重新验证登录态

### 15. feedId 正则过于脆弱

**文件**: `scripts/xhs-scraper.js:799`

`postUrl.match(/\/([a-f0-9]{24})\b/)` 假设 ID 是 24 字符 hex。URL 格式变化时可能匹配失败。

- **建议**: 增加多种 URL 格式的匹配规则，匹配失败时 fallback 到 `__INITIAL_STATE__` 的第一个 key

### 16. 无速率限制检测/退避

没有检测 XHS 返回的限流信号（403、空响应、验证码页面），也没有自动退避机制。

- **建议**: 检测异常响应，触发指数退避等待

---

## 五、缺失功能（P3）

### 17. 无用户画像增强

只获取用户名、userId、IP。可进一步抓取用户主页的粉丝数、笔记数，用于潜客质量评分。

### 18. 无终端 QR 码显示

QR 码保存为 PNG 并用系统查看器打开，SSH/远程服务器环境下不可用。

- **建议**: 集成 `qrcode-terminal` 在终端显示 ASCII QR 码

### 19. 无代理/IP 轮换支持

没有 `--proxy` 参数，大量采集时无法规避 IP 限制。

### 20. 无 CSV 导出

只输出 Excel，部分用户需要 CSV 便于程序处理。

---

## 六、SKILL.md 和工程质量（P3）

### 21. Step 3B 缺少结构化约束

Claude 分析后需输出 `analysis.json`，但没有 JSON Schema 验证，也没说明跨帖用户去重逻辑。

### 22. 数据管道衔接不明确

`comments.json` → `filtered-comments.json` → `analysis.json` → Excel 的管道缺少清晰的数据流图，AI 执行时容易跳步或路径搞错。

- **建议**: 在 SKILL.md 中添加管道示意图

### 23. 无 package.json scripts

每次都要手写完整的 `node scripts/xxx.js --flag xxx`。

- **建议**: 在 package.json 中添加 `scrape`、`filter`、`excel` 快捷命令

### 24. 无单元测试

所有脚本都没有测试用例。

---

## 优先级总览

| 优先级 | 编号 | 问题 | 影响 |
|--------|------|------|------|
| P0 | #1 | `__INITIAL_STATE__` 数据断裂 | 可能导致大量评论丢失 |
| P0 | #2 | 无验证码检测 | 遇到验证码后盲目运行 |
| P0 | #3 | 不可访问帖子检测缺失 | 白白浪费时间 |
| P1 | #4-7 | 反检测指纹问题 | 易被反爬识别 |
| P1 | #8 | 崩溃丢数据 | 长任务可靠性差 |
| P2 | #9-12 | 数据质量 | 功能受限、数据不完整 |
| P2 | #13-16 | 健壮性 | 长时间运行不稳定 |
| P3 | #17-20 | 缺失功能 | 进阶用户需求 |
| P3 | #21-24 | 工程质量 | 维护成本高 |
