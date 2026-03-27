#!/usr/bin/env node

/**
 * 评论粗筛脚本 — 宽松过滤，只去明确噪声
 *
 * 过滤规则：
 * - 去除帖子作者自己的回复
 * - 去除纯表情/emoji（< 3 个有效中文字符）
 * - 去除纯 @ 引用（无实质内容）
 * - 去除广告引流（招聘、底薪、AI员工等）
 * - 保留所有其他评论，交给 Claude 语义精筛
 *
 * 用法:
 *   node filter-comments.js --input comments.json --output filtered-comments.json
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: "", // 默认为空，读取 keyword 后自动生成
    output: "",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") opts.input = args[++i];
    else if (args[i] === "--output") opts.output = args[++i];
  }
  return opts;
}

/**
 * 根据输入文件中的 keyword 自动生成默认路径
 * 输入: data/comments_{keyword}.json → 输出: data/filtered_{keyword}.json
 */
function resolveDefaultPaths(opts) {
  const dataDir = path.join(__dirname, "..", "data");
  if (!opts.input) {
    // 没有指定输入，尝试找 data 目录下最新的 comments_*.json
    const files = fs.readdirSync(dataDir).filter((f) => f.startsWith("comments_") && f.endsWith(".json"));
    if (files.length === 1) {
      opts.input = path.join(dataDir, files[0]);
    } else if (files.length > 1) {
      // 按修改时间取最新
      files.sort((a, b) => fs.statSync(path.join(dataDir, b)).mtimeMs - fs.statSync(path.join(dataDir, a)).mtimeMs);
      opts.input = path.join(dataDir, files[0]);
    } else {
      // fallback 到旧文件名
      opts.input = path.join(dataDir, "comments.json");
    }
  }
  if (!opts.output) {
    // 从输入文件名推导输出文件名: comments_医美.json → filtered_医美.json
    const inputBase = path.basename(opts.input);
    const match = inputBase.match(/^comments_(.+)\.json$/);
    if (match) {
      opts.output = path.join(dataDir, `filtered_${match[1]}.json`);
    } else {
      opts.output = path.join(dataDir, "filtered-comments.json");
    }
  }
  return opts;
}

const AD_PATTERNS = [
  "招聘", "底薪加提成", "AI员工", "获客", "私人定制美肤",
  "投资先做", "美美方略", "美美云客", "知了AI数字",
  "加我微信", "加我v", "免费领取", "点击链接",
];

function countChinese(text) {
  const matches = text.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

function isNoiseComment(content, authorName, username) {
  if (!content || !content.trim()) return "空评论";
  const text = content.trim();

  // 作者自己的回复
  if (username === authorName) return "作者回复";

  // 纯 @ 引用（如 "@某人 @某人"，无其他内容）
  const withoutMentions = text.replace(/@[\S]+/g, "").trim();
  if (!withoutMentions || countChinese(withoutMentions) < 2) return "纯@引用";

  // 纯表情/emoji（有效中文字符 < 3）
  const withoutEmoji = text
    .replace(/\[[\u4e00-\u9fffA-Za-z]+R?\]/g, "")  // 小红书表情 [笑哭R]
    .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();
  if (countChinese(withoutEmoji) < 3 && withoutEmoji.length < 5) return "纯表情";

  // 广告引流
  if (AD_PATTERNS.some((p) => text.includes(p))) return "广告引流";

  return null; // 保留
}

function main() {
  const opts = resolveDefaultPaths(parseArgs());
  if (!fs.existsSync(opts.input)) {
    console.error(`❌ 输入文件不存在: ${opts.input}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(opts.input, "utf-8"));
  const result = { ...data, posts: [] };

  let totalComments = 0;
  let filteredOut = 0;
  const filterReasons = {};

  for (const post of data.posts) {
    const kept = [];
    for (const c of post.comments) {
      totalComments++;
      const reason = isNoiseComment(c.content, post.author, c.username);
      if (reason) {
        filteredOut++;
        filterReasons[reason] = (filterReasons[reason] || 0) + 1;
      } else {
        kept.push(c);
      }
    }
    result.posts.push({ ...post, comments: kept });
  }

  const outputDir = path.dirname(opts.output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");

  console.log(`✅ 粗筛完成`);
  console.log(`   总评论: ${totalComments}`);
  console.log(`   过滤: ${filteredOut} (${((filteredOut / totalComments) * 100).toFixed(1)}%)`);
  console.log(`   保留: ${totalComments - filteredOut}`);
  console.log(`   过滤原因:`);
  for (const [reason, count] of Object.entries(filterReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${reason}: ${count}`);
  }
  console.log(`   输出: ${opts.output}`);
}

main();
