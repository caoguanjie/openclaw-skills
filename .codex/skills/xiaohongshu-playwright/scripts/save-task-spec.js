#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    keyword: "",
    json: "",
    output: "",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keyword") opts.keyword = args[++i] || "";
    else if (args[i] === "--json") opts.json = args[++i] || "";
    else if (args[i] === "--output") opts.output = args[++i] || "";
  }

  if (!opts.keyword) {
    throw new Error("--keyword 为必填参数");
  }
  if (!opts.json) {
    throw new Error("--json 为必填参数");
  }

  return opts;
}

function sanitizeKeywordForFilename(keyword) {
  return String(keyword || "keyword")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/^_+|_+$/g, "") || "keyword";
}

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeStringArray(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} 必须为数组`);
  }
  return uniqueList(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
}

function validateTaskSpec(rawSpec, keyword) {
  const spec = {
    keyword: String(rawSpec.keyword || keyword || "").trim(),
    post_relevance: {
      include: normalizeStringArray(rawSpec.post_relevance?.include || [], "post_relevance.include"),
      exclude: normalizeStringArray(rawSpec.post_relevance?.exclude || [], "post_relevance.exclude"),
    },
    comment_filter: {
      include: normalizeStringArray(rawSpec.comment_filter?.include || [], "comment_filter.include"),
      exclude: normalizeStringArray(rawSpec.comment_filter?.exclude || [], "comment_filter.exclude"),
    },
    semantic_focus: String(rawSpec.semantic_focus || "").trim(),
  };

  if (!spec.keyword) {
    throw new Error("task spec.keyword 不能为空");
  }

  return spec;
}

function buildDefaultOutput(keyword) {
  const dir = path.join(__dirname, "..", "data", "task-specs");
  const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
  return path.join(dir, `${stamp}_${sanitizeKeywordForFilename(keyword)}.json`);
}

function main() {
  const opts = parseArgs();
  const rawSpec = JSON.parse(opts.json);
  const spec = validateTaskSpec(rawSpec, opts.keyword);
  const outputPath = opts.output ? path.resolve(opts.output) : buildDefaultOutput(spec.keyword);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8");
  console.log(outputPath);
}

main();
