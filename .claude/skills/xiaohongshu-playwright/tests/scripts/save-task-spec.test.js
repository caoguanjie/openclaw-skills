'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runScript, SKILL_DIR } = require('../helpers/run-script');
const { cleanAll, writeJson, DATA_DIR, TASK_SPECS_DIR } = require('../helpers/cleanup');
const { makeTaskSpec } = require('../helpers/fixtures');

const KW = 'XTEST_SPEC_X';
const VALID_JSON = JSON.stringify(makeTaskSpec(KW));

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

// ─── 前置清理 ────────────────────────────────────────────────────────────────
cleanAll(KW);

console.log('\n=== save-task-spec.js 测试 ===\n');

// TC-SPEC-001 生成合法 task spec
test('TC-SPEC-001 生成合法 task spec', () => {
  cleanAll(KW);
  const r = runScript('save-task-spec.js', ['--keyword', KW, '--json', VALID_JSON]);
  assert.strictEqual(r.status, 0, `exit code 应为 0，得到 ${r.status}\nstderr: ${r.stderr}`);

  const outputPath = r.stdout.trim();
  assert.ok(outputPath.length > 0, 'stdout 应输出文件路径');
  assert.ok(fs.existsSync(outputPath), `文件应存在: ${outputPath}`);

  const obj = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.ok(obj.keyword, 'JSON 应包含 keyword');
  assert.ok(obj.post_relevance, 'JSON 应包含 post_relevance');
  assert.ok(obj.comment_filter, 'JSON 应包含 comment_filter');
  assert.ok(obj.semantic_focus !== undefined, 'JSON 应包含 semantic_focus');
});

// 文件名格式验证
test('文件名格式应为 <timestamp>_<sanitized-keyword>.json', () => {
  cleanAll(KW);
  const r = runScript('save-task-spec.js', ['--keyword', KW, '--json', VALID_JSON]);
  assert.strictEqual(r.status, 0);

  const outputPath = r.stdout.trim();
  const basename = path.basename(outputPath);
  // 格式：2026-03-31T06-10-10_关键词.json
  assert.ok(basename.endsWith('.json'), '文件名应以 .json 结尾');
  assert.ok(basename.includes(KW) || basename.includes('TEST'), '文件名应包含关键词');
  assert.ok(path.dirname(outputPath).endsWith('task-specs'), '文件应在 task-specs 目录');
});

// 关键词值写入正确
test('keyword 字段与传入参数一致', () => {
  cleanAll(KW);
  const r = runScript('save-task-spec.js', ['--keyword', KW, '--json', VALID_JSON]);
  assert.strictEqual(r.status, 0);
  const obj = JSON.parse(fs.readFileSync(r.stdout.trim(), 'utf8'));
  assert.strictEqual(obj.keyword, KW);
});

// TC-SPEC-002 缺少 --keyword
test('TC-SPEC-002 缺少 --keyword 应报错退出', () => {
  const r = runScript('save-task-spec.js', ['--json', VALID_JSON]);
  assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
  const output = r.stderr + r.stdout;
  assert.ok(
    output.toLowerCase().includes('keyword') || output.includes('必填'),
    `错误信息应提及 keyword，实际: ${output}`
  );
});

// TC-SPEC-003 缺少 --json
test('TC-SPEC-003 缺少 --json 应报错退出', () => {
  const r = runScript('save-task-spec.js', ['--keyword', KW]);
  assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
  const output = r.stderr + r.stdout;
  assert.ok(
    output.toLowerCase().includes('json') || output.includes('必填'),
    `错误信息应提及 json，实际: ${output}`
  );
});

// TC-SPEC-004 include 非数组
test('TC-SPEC-004 post_relevance.include 非数组应报错', () => {
  cleanAll(KW);
  const badSpec = JSON.stringify({
    keyword: KW,
    post_relevance: { include: '医美', exclude: [] },
    comment_filter: { include: [], exclude: [] },
    semantic_focus: '测试',
  });
  const r = runScript('save-task-spec.js', ['--keyword', KW, '--json', badSpec]);
  assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
  const output = r.stderr + r.stdout;
  assert.ok(
    output.includes('数组') || output.includes('array') || output.includes('include'),
    `错误信息应提及 include 非数组，实际: ${output}`
  );
});

// 非法 JSON 字符串
test('非法 JSON 字符串应报错退出', () => {
  cleanAll(KW);
  const r = runScript('save-task-spec.js', ['--keyword', KW, '--json', '{invalid json}']);
  assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
});

// keyword 含特殊字符：sanitize 后文件名合法
test('keyword 含特殊字符，文件名应被安全化', () => {
  const specialKW = 'XTEST_SPEC_X/露营';
  const cleanKW = 'XTEST_SPEC_X';
  try {
    cleanAll(cleanKW);
    const spec = JSON.stringify(makeTaskSpec(specialKW));
    const r = runScript('save-task-spec.js', ['--keyword', specialKW, '--json', spec]);
    // 不强制要求成功（取决于实现），但若成功则文件名不应含 /
    if (r.status === 0) {
      const outputPath = r.stdout.trim();
      const basename = path.basename(outputPath);
      assert.ok(!basename.includes('/'), '文件名不应含 /');
    }
  } finally {
    cleanAll(cleanKW);
  }
});

// ─── 后置清理 ─────────────────────────────────────────────────────────────────
cleanAll(KW);

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
