const fs = require("fs");
const path = require("path");

/**
 * 加载 Cookie 文件
 * @param {string} cookiePath - Cookie 文件路径
 * @returns {Array|null} - 有效的 Cookie 数组，失败返回 null
 */
function loadCookies(cookiePath) {
  if (fs.existsSync(cookiePath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
      if (Array.isArray(cookies) && cookies.length > 0) {
        const now = Date.now() / 1000;
        const valid = cookies.filter(
          (c) => !c.expires || c.expires === -1 || c.expires > now
        );
        if (valid.length > 0) {
          return valid;
        }
      }
    } catch (e) {
      console.warn("Cookie 文件解析失败:", e.message);
    }
  }
  return null;
}

/**
 * 保存 Cookie 到文件
 * @param {Object} context - Playwright BrowserContext
 * @param {string} cookiePath - Cookie 文件路径
 */
async function saveCookies(context, cookiePath) {
  const cookies = await context.cookies();
  const dir = path.dirname(cookiePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), "utf-8");
  console.log(`已保存 ${cookies.length} 个 cookie`);
}

module.exports = {
  loadCookies,
  saveCookies,
};
