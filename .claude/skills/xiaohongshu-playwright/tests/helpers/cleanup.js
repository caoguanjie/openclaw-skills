'use strict';

const fs = require('fs');
const path = require('path');
const { SKILL_DIR } = require('./run-script');

const DATA_DIR = path.join(SKILL_DIR, 'data');
const OUTPUT_DIR = path.join(SKILL_DIR, 'output');
const TASK_SPECS_DIR = path.join(DATA_DIR, 'task-specs');

/**
 * 删除与指定关键词相关的所有测试产物：
 * - data/task-specs/*<keyword>*.json
 * - data/comments_<keyword>.json
 * - data/candidates_<keyword>.json
 * - data/analysis_<keyword>.json
 * - data/analysis_posts/<keyword>/
 */
function removeTestData(keyword) {
  // task-specs
  if (fs.existsSync(TASK_SPECS_DIR)) {
    for (const f of fs.readdirSync(TASK_SPECS_DIR)) {
      if (f.includes(keyword)) {
        fs.rmSync(path.join(TASK_SPECS_DIR, f), { force: true });
      }
    }
  }

  // data 目录下的关键词文件
  for (const prefix of ['comments_', 'candidates_', 'analysis_']) {
    const fp = path.join(DATA_DIR, `${prefix}${keyword}.json`);
    if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
  }

  // analysis_posts/<keyword>/
  const postsDir = path.join(DATA_DIR, 'analysis_posts', keyword);
  if (fs.existsSync(postsDir)) {
    fs.rmSync(postsDir, { recursive: true, force: true });
  }
}

/**
 * 删除 output/ 下与关键词匹配的 xlsx 文件
 */
function removeTestOutput(keyword) {
  if (!fs.existsSync(OUTPUT_DIR)) return;
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    if (f.startsWith(keyword)) {
      fs.rmSync(path.join(OUTPUT_DIR, f), { force: true });
    }
  }
}

/**
 * 清理所有测试产物
 */
function cleanAll(keyword) {
  removeTestData(keyword);
  removeTestOutput(keyword);
}

/**
 * 确保目录存在（mkdir -p）
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 写入 JSON 文件（自动创建父目录）
 */
function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = {
  removeTestData,
  removeTestOutput,
  cleanAll,
  ensureDir,
  writeJson,
  DATA_DIR,
  OUTPUT_DIR,
  TASK_SPECS_DIR,
};
