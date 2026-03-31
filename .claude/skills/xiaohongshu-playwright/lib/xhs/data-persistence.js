const fs = require("fs");
const path = require("path");

/**
 * 加载已有采集数据（帖子级去重）
 * @param {string} outputPath - 输出文件路径
 * @param {string} keyword - 关键词
 * @returns {Object} - { existingPosts, collectedUrls }
 */
function loadExistingData(outputPath, keyword) {
  if (!fs.existsSync(outputPath)) {
    return { existingPosts: [], collectedUrls: new Set() };
  }
  try {
    const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    if (data.keyword !== keyword) {
      console.log(`📂 已有数据关键词不匹配（"${data.keyword}" vs "${keyword}"），不去重`);
      return { existingPosts: [], collectedUrls: new Set() };
    }
    const existingPosts = data.posts || [];
    const collectedUrls = new Set(existingPosts.map((p) => p.url));
    console.log(`📂 已有 ${existingPosts.length} 篇帖子数据，将跳过已采集帖子`);
    return { existingPosts, collectedUrls };
  } catch (e) {
    console.warn("读取已有数据失败:", e.message);
    return { existingPosts: [], collectedUrls: new Set() };
  }
}

/**
 * 增量保存（每帖采完立即写盘，noteId 去重）
 * @param {string} outputPath - 输出文件路径
 * @param {string} keyword - 关键词
 * @param {Object} postData - 帖子数据
 * @returns {boolean} - 是否成功保存
 */
function appendPostResult(outputPath, keyword, postData) {
  let existing = { keyword, scrapeTime: new Date().toISOString(), posts: [] };
  if (fs.existsSync(outputPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    } catch {
      // 文件损坏时从空开始
    }
  }

  const noteId = postData.noteId;
  const existingIds = new Set(existing.posts.map((p) => p.noteId));
  if (existingIds.has(noteId)) {
    return false;
  }

  existing.posts.push(postData);
  existing.scrapeTime = new Date().toISOString();

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), "utf-8");
  return true;
}

module.exports = {
  loadExistingData,
  appendPostResult,
};
