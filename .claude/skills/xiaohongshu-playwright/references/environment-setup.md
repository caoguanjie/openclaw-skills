# 环境设置参考

本文档提供 xiaohongshu-playwright skill 的详细环境配置指南。

## 1. 系统要求

- **Node.js**: >= 22
- **操作系统**: macOS / Linux / Windows
- **网络**: 建议国内网络使用镜像源加速

## 2. 依赖安装

### 2.1 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| playwright | 1.48.0 | 浏览器自动化 |
| rebrowser-patches | latest | 反检测补丁（修复 CDP leak 和 navigator.webdriver） |
| exceljs | latest | Excel 文件生成 |

### 2.2 自动化安装脚本

**推荐方式**：使用 `bootstrap-playwright.js` 一键安装所有依赖。

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SKILL_DIR}" && node scripts/bootstrap-playwright.js
```

该脚本自动完成：
- npm 依赖安装（playwright、rebrowser-patches、exceljs）
- Playwright Chromium 浏览器下载
- 镜像源智能切换（国内优先 npmmirror，失败回退官方源）
- 跨平台环境变量处理（Linux / macOS / Windows）

**安装过程反馈**：
脚本会持续输出当前阶段，包括：
- 正在检查 npm 依赖
- 正在安装 npm 依赖（如需要）
- 正在检查 Playwright Chromium
- 正在下载 Playwright Chromium（首次安装可能较慢，约 100-300MB）
- 环境初始化完成

### 2.3 镜像源策略

**国内网络优化**：

skill 根目录通过 `.npmrc` 固定镜像源：
```
registry=https://registry.npmmirror.com
```

**智能回退机制**：
1. **npm 依赖**：优先阿里镜像源（npmmirror），失败回退官方源
2. **Playwright Chromium**：优先阿里镜像源，失败回退官方源

### 2.4 彻底重建依赖树

**适用场景**：当 `package-lock.json` 混入了 `registry.npmjs.org` 导致依赖冲突时。

```bash
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -rf "${SKILL_DIR}/node_modules" "${SKILL_DIR}/package-lock.json"
cd "${SKILL_DIR}" && npm install --registry=https://registry.npmmirror.com
```

**验证**：重建后检查 `package-lock.json` 中的 `resolved` 字段是否统一指向 `https://registry.npmmirror.com/`。

## 3. 环境验证

### 3.1 快速检查

```bash
# 检查 Node.js 版本
node -v  # 应显示 >= 22

# 检查 Playwright 是否可加载
node -e "require('playwright')"  # 无报错即正常

# 检查 rebrowser-patches
node -e "require('rebrowser-patches')"  # 无报错即正常
```

### 3.2 环境状态记录

环境安装完成后，会自动更新 `references/site-patterns/xiaohongshu.md` 的「本地环境」段落：
- `环境状态: 已就绪`
- `Playwright依赖: 已安装`
- `Chromium浏览器: 已安装`
- `最后检查时间: <当前日期>`

## 4. 常见问题排查

### 4.1 Chromium 下载失败

**症状**：`playwright install chromium` 卡住或超时

**解决方案**：
1. 确认网络连接正常
2. 重新运行 `node scripts/bootstrap-playwright.js`（脚本会自动尝试镜像源回退）
3. 手动设置环境变量后重试：
   ```bash
   export PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/
   npx playwright install chromium
   ```

### 4.2 rebrowser-patches 加载失败

**症状**：运行时提示 `Cannot find module 'rebrowser-patches'`

**解决方案**：
```bash
cd .claude/skills/xiaohongshu-playwright
npm install rebrowser-patches
```

### 4.3 npm 依赖安装慢

**症状**：`npm install` 长时间无响应

**解决方案**：
1. 确认 `.npmrc` 文件存在且配置正确
2. 手动指定镜像源：
   ```bash
   npm install --registry=https://registry.npmmirror.com
   ```

### 4.4 权限问题（Linux/macOS）

**症状**：`EACCES: permission denied`

**解决方案**：
```bash
# 修复 npm 全局目录权限
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## 5. 环境检查清单

安装完成后，确认以下项目：

- [ ] Node.js 版本 >= 22
- [ ] `node_modules/` 目录存在
- [ ] `package-lock.json` 存在且 resolved 指向正确镜像源
- [ ] Playwright Chromium 已下载（~/.cache/ms-playwright/ 或 ~/Library/Caches/ms-playwright/）
- [ ] rebrowser-patches 可正常加载
- [ ] exceljs 可正常加载
- [ ] `data/` 和 `output/` 目录存在且有写权限

## 6. 首次运行准备

环境就绪后，首次运行还需要：

1. **登录小红书**：脚本会自动弹出二维码，扫码登录后保存 cookie
2. **选择运行模式**：首次使用时会询问「后台静默运行」或「打开浏览器运行」
3. **测试运行**：建议用 `--max-posts 1 --speed slow` 做单帖测试

---

**相关文档**：
- 主流程：`SKILL.md`
- 站点经验：`references/site-patterns/xiaohongshu.md`
- 执行清单：`references/execution-checklist.md`
