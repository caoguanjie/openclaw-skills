#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  let keyword = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword") keyword = args[++i] || "";
  }
  return { keyword };
}

function sanitizeKeywordForFilename(keyword) {
  return String(keyword || "")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function main() {
  const { keyword } = parseArgs();
  const taskSpecDir = path.join(__dirname, "..", "data", "task-specs");

  if (!fs.existsSync(taskSpecDir)) {
    console.log(taskSpecDir);
    return;
  }

  const sanitized = sanitizeKeywordForFilename(keyword);
  const files = fs.readdirSync(taskSpecDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    // 如果指定了 keyword，只删匹配的文件（文件名包含 _<keyword>.json）
    if (sanitized && !file.endsWith(`_${sanitized}.json`)) continue;
    fs.unlinkSync(path.join(taskSpecDir, file));
  }

  console.log(taskSpecDir);
}

main();
