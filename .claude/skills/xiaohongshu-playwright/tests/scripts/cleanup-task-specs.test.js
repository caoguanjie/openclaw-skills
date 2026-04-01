'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runScript } = require('../helpers/run-script');
const { cleanAll, writeJson, TASK_SPECS_DIR, ensureDir } = require('../helpers/cleanup');
const { makeTaskSpec } = require('../helpers/fixtures');

const KW_A = 'XTEST_CLEANUP_A';
const KW_B = 'XTEST_CLEANUP_B';
const KW_C = 'XTEST_CLEANUP_C';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function createTaskSpec(keyword) {
  ensureDir(TASK_SPECS_DIR);
  const filePath = path.join(TASK_SPECS_DIR, `2000-01-01T00-00-00_${keyword}.json`);
  writeJson(filePath, makeTaskSpec(keyword));
  return filePath;
}

// ─── 前置清理 ────────────────────────────────────────────────────────────────
[KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));
console.log('\n=== cleanup-task-specs.js 测试 ===\n');

// TC-CLEANUP-001 --keyword 只删除对应关键词文件
test('TC-CLEANUP-001 --keyword 只删匹配文件，其他文件保留', () => {
  [KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));
  try {
    const pathA = createTaskSpec(KW_A);
    const pathB = createTaskSpec(KW_B);
    const pathC = createTaskSpec(KW_C);

    assert.ok(fs.existsSync(pathA), '前置条件：A 文件应存在');
    assert.ok(fs.existsSync(pathB), '前置条件：B 文件应存在');
    assert.ok(fs.existsSync(pathC), '前置条件：C 文件应存在');

    const r = runScript('cleanup-task-specs.js', ['--keyword', KW_A]);
    assert.strictEqual(r.status, 0, `exit code 应为 0\nstderr: ${r.stderr}`);

    assert.ok(!fs.existsSync(pathA), 'A 文件应被删除');
    assert.ok(fs.existsSync(pathB), 'B 文件应保留');
    assert.ok(fs.existsSync(pathC), 'C 文件应保留');
  } finally {
    [KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));
  }
});

// 无 --keyword 删除全部 task specs
test('无 --keyword 应删除所有测试 task spec 文件', () => {
  [KW_A, KW_B].forEach(kw => cleanAll(kw));
  try {
    const pathA = createTaskSpec(KW_A);
    const pathB = createTaskSpec(KW_B);

    assert.ok(fs.existsSync(pathA), '前置条件：A 文件应存在');
    assert.ok(fs.existsSync(pathB), '前置条件：B 文件应存在');

    const r = runScript('cleanup-task-specs.js', []);
    assert.strictEqual(r.status, 0, `exit code 应为 0\nstderr: ${r.stderr}`);

    // 两个文件都应被删除
    assert.ok(!fs.existsSync(pathA), 'A 文件应被删除（无 --keyword 模式）');
    assert.ok(!fs.existsSync(pathB), 'B 文件应被删除（无 --keyword 模式）');
  } finally {
    [KW_A, KW_B].forEach(kw => cleanAll(kw));
  }
});

// task-specs 目录不存在时不应报错
test('task-specs 目录不存在时应正常退出（exit 0）', () => {
  [KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));
  try {
    // 删除 task-specs 目录
    if (fs.existsSync(TASK_SPECS_DIR)) {
      fs.rmSync(TASK_SPECS_DIR, { recursive: true, force: true });
    }
    assert.ok(!fs.existsSync(TASK_SPECS_DIR), '前置条件：task-specs 目录已删除');

    const r = runScript('cleanup-task-specs.js', ['--keyword', KW_A]);
    assert.strictEqual(r.status, 0, `目录不存在时 exit code 仍应为 0\nstderr: ${r.stderr}`);
  } finally {
    // 恢复目录供后续测试使用
    ensureDir(TASK_SPECS_DIR);
    [KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));
  }
});

// ─── 后置清理 ─────────────────────────────────────────────────────────────────
[KW_A, KW_B, KW_C].forEach(kw => cleanAll(kw));

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
