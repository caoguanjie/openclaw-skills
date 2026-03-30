#!/usr/bin/env node

/**
 * merge-analysis.js — 合并并行精筛分片为完整 analysis.json
 *
 * 用法:
 *   node merge-analysis.js \
 *     --keyword <kw> \
 *     --candidates data/candidates_<kw>.json \
 *     --posts-dir data/analysis_posts/<kw> \
 *     --output data/analysis_<kw>.json
 *
 * 行为:
 *   - 按 candidates.json 中帖子顺序读取分片文件
 *   - 分片文件名：<noteId>.json（由 sub-agent 写入）
 *   - 缺失分片：警告并跳过
 *   - 失败率 > 50%：打印错误摘要并以退出码 1 结束
 *   - 成功：写入 output 文件，打印统计摘要
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { keyword: "", candidates: "", postsDir: "", output: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword") opts.keyword = args[++i] || "";
    else if (args[i] === "--candidates") opts.candidates = args[++i] || "";
    else if (args[i] === "--posts-dir") opts.postsDir = args[++i] || "";
    else if (args[i] === "--output") opts.output = args[++i] || "";
  }
  if (!opts.keyword) throw new Error("--keyword 为必填参数");
  return opts;
}

function resolveDefaults(opts) {
  const skillDir = path.join(__dirname, "..");
  const safeKw = opts.keyword.replace(/[\\/:*?"<>|\s]+/g, "_");
  if (!opts.candidates)
    opts.candidates = path.join(skillDir, "data", `candidates_${safeKw}.json`);
  if (!opts.postsDir)
    opts.postsDir = path.join(skillDir, "data", "analysis_posts", safeKw);
  if (!opts.output)
    opts.output = path.join(skillDir, "data", `analysis_${safeKw}.json`);
  return opts;
}

function extractNoteId(url) {
  const match = String(url || "").match(/\/([a-f0-9]{24})\b/i);
  return match ? match[1] : "";
}

function main() {
  const opts = resolveDefaults(parseArgs());

  // 读 candidates.json
  if (!fs.existsSync(opts.candidates)) {
    console.error(`❌ candidates 文件不存在: ${opts.candidates}`);
    process.exit(1);
  }
  const candidates = JSON.parse(fs.readFileSync(opts.candidates, "utf-8"));
  const posts = candidates.posts || [];

  if (posts.length === 0) {
    console.warn("⚠️  candidates.json 中没有帖子，输出空 analysis");
    const result = { keyword: opts.keyword, posts: [] };
    fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");
    console.log(opts.output);
    return;
  }

  const merged = [];
  const missing = [];

  for (const post of posts) {
    const noteId = post.noteId || extractNoteId(post.url);
    if (!noteId) {
      console.warn(`  ⚠️  无法提取 noteId，跳过帖子: ${post.url}`);
      missing.push(post.url);
      continue;
    }

    const shardPath = path.join(opts.postsDir, `${noteId}.json`);
    if (!fs.existsSync(shardPath)) {
      console.warn(`  ⚠️  分片文件不存在，跳过: ${shardPath}`);
      missing.push(post.url);
      continue;
    }

    try {
      const shard = JSON.parse(fs.readFileSync(shardPath, "utf-8"));
      merged.push(shard);
    } catch (e) {
      console.warn(`  ⚠️  分片文件解析失败，跳过: ${shardPath} — ${e.message}`);
      missing.push(post.url);
    }
  }

  const total = posts.length;
  const successCount = merged.length;
  const failCount = missing.length;
  const failRate = failCount / total;

  console.log(`\n📊 合并统计: ${successCount}/${total} 帖子成功`);
  if (missing.length > 0) {
    console.warn(`  ⚠️  ${failCount} 个帖子分析失败:`);
    missing.forEach((url) => console.warn(`     - ${url}`));
  }

  // 失败率 > 50% 时中止
  if (failRate > 0.5) {
    console.error(
      `\n❌ 精筛失败率过高（${failCount}/${total} = ${Math.round(failRate * 100)}%），中止合并。`
    );
    console.error("   请检查 sub-agent 的执行日志，确认分片文件已写入。");
    process.exit(1);
  }

  // 写输出
  const outputDir = path.dirname(opts.output);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const result = { keyword: opts.keyword, posts: merged };
  fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");

  console.log(`✅ 合并完成: ${opts.output}`);
  console.log(opts.output);
}

main();
