#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const candidatesFile = process.argv[2];
const minScore = parseInt(process.argv[3]) || 7;
const maxPosts = parseInt(process.argv[4]) || 3;

if (!candidatesFile) {
  console.error("用法: node ai-semantic-filter.js <candidates.json> [minScore] [maxPosts]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(candidatesFile, "utf-8"));
const taskSpec = JSON.parse(fs.readFileSync(
  `/Users/fits-vue/Documents/openclaw/.claude/skills/xiaohongshu-playwright/data/task-specs/2026-04-01T07-17-52_考研英语.json`,
  "utf-8"
));

console.log("📊 候选评论统计:");
console.log(`   总帖子数: ${data.posts.length}`);
console.log(`   总评论数: ${data.posts.reduce((sum, p) => sum + p.comments.length, 0)}`);
console.log(`   语义焦点: ${taskSpec.semantic_focus}`);
console.log(`   最低意向分: ${minScore}`);
console.log(`   分析帖子数: ${Math.min(maxPosts, data.posts.length)}`);
console.log();

// 输出前N篇帖子的评论供AI分析
const postsToAnalyze = data.posts.slice(0, maxPosts);
console.log(JSON.stringify({ posts: postsToAnalyze, taskSpec }, null, 2));
