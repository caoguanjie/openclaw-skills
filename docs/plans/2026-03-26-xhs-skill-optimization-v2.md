# xiaohongshu-playwright Skill 优化设计 v2

> 日期: 2026-03-26
> 状态: 待审批

## 优化范围

三个优化点，均针对 `.claude/skills/xiaohongshu-playwright/` 目录。

---

## 1. 文件命名规范化

### 1.1 Excel 输出文件名

**当前**: `output/xhs-医美-20260325.xlsx`
**改为**: `output/医美_20260325_19-00.xlsx`

格式: `{关键字}_{YYYYMMDD}_{HH-mm}.xlsx`

**改动文件**: `scripts/generate-excel.js`
- 修改 `main()` 中默认输出路径的生成逻辑
- 日期时间取导出时刻
- 时分用 `-` 分隔（跨平台安全）

```js
// 改前
const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
opts.output = path.join(outputDir, `xhs-${data.keyword || "export"}-${date}.xlsx`);

// 改后
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
opts.output = path.join(outputDir, `${data.keyword || "export"}_${dateStr}_${timeStr}.xlsx`);
```

### 1.2 data 目录中间文件

**当前**: 所有关键字共用 `comments.json` / `analysis.json`
**改为**: 按关键字分文件，同关键字增量覆盖

| 文件 | 当前名 | 新名 |
|------|--------|------|
| 采集数据 | `data/comments.json` | `data/comments_{关键字}.json` |
| 粗筛数据 | `data/filtered-comments.json` | `data/filtered_{关键字}.json` |
| 分析结果 | `data/analysis.json` | `data/analysis_{关键字}.json` |

**改动文件**:
1. `scripts/xhs-scraper.js` — 默认 `--output` 路径改为 `data/comments_{keyword}.json`
2. `scripts/filter-comments.js` — 默认输入/输出路径加关键字后缀
3. `scripts/generate-excel.js` — 默认输入路径加关键字后缀
4. `SKILL.md` — 更新所有路径示例和数据管道图

**注意**: `data/cookies.json` 和 `data/screenshots/` 不变，它们不按关键字分。

---

## 2. 有头/无头模式引导

### 设计

**不新增文件**。在 `references/site-patterns/xiaohongshu.md` 末尾加 `## 用户习惯` 段落，记录用户的运行模式偏好。

**SKILL.md 改动**：在 Step 2 之前加一段引导逻辑：

```markdown
### Step 1.5: 检查运行模式偏好

读取 `references/site-patterns/xiaohongshu.md` 的「用户习惯」段落。

**如果没有记录**（首次使用）：
用 AskUserQuestion 询问用户：
- 选项 A: 「后台静默运行」— 浏览器在后台工作，不弹出窗口，适合已登录过的用户
- 选项 B: 「打开浏览器运行」— 能看到浏览器操作过程，适合首次使用或需要调试

将用户选择写入站点经验文件的「用户习惯」段落，并告知用户：
"已记住你的选择。以后想切换，跟我说『切换到打开浏览器模式』或『切换到后台模式』就行。"

**如果已有记录**：
直接使用记录的模式运行，不再询问。

**如果用户主动要求切换**：
更新站点经验文件中的记录。
```

**站点经验文件新增段落示例**:
```markdown
## 用户习惯

- 运行模式: 后台静默运行（--headless，即无头模式）
- 设置时间: 2026-03-26
- 切换方式: 告诉 AI「切换到打开浏览器模式」或「切换到后台模式」
```

**术语映射**（在 SKILL.md 中说明，AI 翻译时使用）:
| 用户看到的 | 实际参数 |
|-----------|---------|
| 后台静默运行 | headless: true（默认） |
| 打开浏览器运行 | --headed |

---

## 3. npm 镜像自动检测+fallback

### 设计

在 SKILL.md 的依赖安装命令中加入 fallback 逻辑。不改脚本代码，只改 SKILL.md 中 AI 执行的安装命令模板。

**SKILL.md 改动**:

```markdown
### 依赖安装（带国内镜像 fallback）

```bash
cd "${SKILL_DIR}" && npm install 2>/dev/null || \
  npm install --registry=https://registry.npmmirror.com 2>/dev/null
```

如果 `npm install` 在 30 秒内失败（网络超时），自动使用淘宝 npm 镜像重试。
```

同时在 SKILL.md 注意事项中补充：

```markdown
- 国内网络环境下 npm 安装可能超时，脚本会自动切换淘宝镜像。如需手动配置：`npm config set registry https://registry.npmmirror.com`
```

---

## 影响文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `SKILL.md` | 编辑 | 路径示例、Step 1.5 引导、npm fallback、术语映射 |
| `scripts/generate-excel.js` | 编辑 | 输出文件名格式 |
| `scripts/xhs-scraper.js` | 编辑 | 默认 output 路径加关键字 |
| `scripts/filter-comments.js` | 编辑 | 默认输入/输出路径加关键字 |
| `references/site-patterns/xiaohongshu.md` | 编辑 | 新增「用户习惯」段落模板 |

**不新增文件，不改架构。**
