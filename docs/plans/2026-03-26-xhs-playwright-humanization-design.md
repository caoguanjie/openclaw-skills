# 小红书 Playwright 版人类化行为优化设计

**日期**: 2026-03-26
**状态**: 已批准

## 目标

将 Playwright 版 xhs-scraper.js 的自动化行为对齐 Python 版 human.py + feed_detail.py 的人类化水平，降低被平台检测风险。

## 核心改动

### 1. 新建 `scripts/human.js` 模块

对应 Python `human.py`，提供：
- 7 种延迟场景常量（HUMAN_DELAY, REACTION_TIME, HOVER_TIME, READ_TIME, SHORT_READ, SCROLL_WAIT, POST_SCROLL）
- 滚动配置常量（DEFAULT_MAX_ATTEMPTS, STAGNANT_LIMIT, MIN_SCROLL_DELTA 等）
- `sleepRandom(min, max)` — 随机延迟
- `navigationDelay()` — 页面导航后等待
- `getScrollInterval(speed)` — 速度档位滚动间隔
- `getScrollRatio(speed)` — 速度档位滚动比例
- `calculateScrollDelta(viewportHeight, baseRatio)` — viewport 比例 + jitter

### 2. 重写 `xhs-scraper.js` 滚动状态机

对齐 Python `_load_all_comments()` + `_human_scroll()` + `_scroll_to_comments_area()`：

- `humanScroll(page, speed, largeMode, pushCount)` — 多段推进滚动
- `scrollToCommentsArea(page)` — 滚动到评论区 + dispatch WheelEvent
- 评论加载主循环：渐进停滞处理（5→largeMode, 20→大冲刺）
- 定期点击展开 + 二轮点击 + 阅读等待

### 3. 集成 rebrowser-patches 反检测

- `require('rebrowser-patches/patch')` 修复 CDP leak、navigator.webdriver
- 额外 addInitScript 伪装 plugins、languages
- viewport 随机偏移、User-Agent 轮换

### 4. CLI 参数变更

- 删除 `--headless`（默认无头）
- 新增 `--headed`（切换有头模式）
- 新增 `--speed slow|normal|fast`（控制滚动速度，默认 normal）

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| scripts/human.js | 新建 | 人类行为模拟模块 |
| scripts/xhs-scraper.js | 修改 | 滚动状态机重写 + rebrowser-patches 集成 |
| SKILL.md | 修改 | 依赖、CLI 用法、注意事项更新 |
| references/site-patterns/xiaohongshu.md | 修改 | 追加新有效模式 |

## 新增依赖

- `rebrowser-patches`
