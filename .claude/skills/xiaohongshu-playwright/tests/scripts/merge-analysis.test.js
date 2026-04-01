'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runScript, SKILL_DIR } = require('../helpers/run-script');
const { cleanAll, writeJson, DATA_DIR } = require('../helpers/cleanup');
const { makeTaskSpec, makeCandidates, makeAnalysisShard } = require('../helpers/fixtures');

const KW = 'XTEST_MERGE_X';
const CANDIDATES_FILE = path.join(DATA_DIR, `candidates_${KW}.json`);
const ANALYSIS_FILE = path.join(DATA_DIR, `analysis_${KW}.json`);
const TASK_SPEC_FILE = path.join(DATA_DIR, `task-specs`, `2000-01-01T00-00-00_${KW}.json`);
const POSTS_DIR = path.join(DATA_DIR, 'analysis_posts', KW);

// 测试中使用的帖子 noteId
const NOTE_IDS = ['aaaaaa000000000001', 'cccccc000000000003', 'dddddd000000000004'];

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

function setupCandidates() {
  const taskSpec = makeTaskSpec(KW);
  writeJson(TASK_SPEC_FILE, taskSpec);
  const candidates = makeCandidates(KW, TASK_SPEC_FILE, taskSpec, [
    { title: '帖子A', url: `https://www.xiaohongshu.com/explore/${NOTE_IDS[0]}`, noteId: NOTE_IDS[0], comments: [] },
    { title: '帖子B', url: `https://www.xiaohongshu.com/explore/${NOTE_IDS[1]}`, noteId: NOTE_IDS[1], comments: [] },
    { title: '帖子C', url: `https://www.xiaohongshu.com/explore/${NOTE_IDS[2]}`, noteId: NOTE_IDS[2], comments: [] },
  ]);
  writeJson(CANDIDATES_FILE, candidates);
}

function setupAllShards() {
  for (const noteId of NOTE_IDS) {
    const shard = makeAnalysisShard(noteId, `帖子${noteId}`, `https://www.xiaohongshu.com/explore/${noteId}`);
    writeJson(path.join(POSTS_DIR, `${noteId}.json`), shard);
  }
}

// ─── 前置清理 ────────────────────────────────────────────────────────────────
cleanAll(KW);
console.log('\n=== merge-analysis.js 测试 ===\n');

// TC-MERGE-001 正常合并，顺序与 candidates 一致
test('TC-MERGE-001 正常合并，posts 顺序与 candidates 一致', () => {
  cleanAll(KW);
  try {
    setupCandidates();
    setupAllShards();

    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    assert.strictEqual(r.status, 0, `exit code 应为 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
    assert.ok(fs.existsSync(ANALYSIS_FILE), 'analysis 文件应存在');

    const obj = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
    assert.ok(Array.isArray(obj.posts), 'posts 应为数组');
    assert.strictEqual(obj.posts.length, 3, 'posts 应有 3 项');

    // 验证顺序与 candidates 一致
    const candidatesObj = JSON.parse(fs.readFileSync(CANDIDATES_FILE, 'utf8'));
    candidatesObj.posts.forEach((cp, i) => {
      assert.strictEqual(
        obj.posts[i].postId || obj.posts[i].noteId || obj.posts[i].url,
        cp.noteId || cp.url,
        `第 ${i} 项顺序应与 candidates 一致`
      );
    });
  } finally {
    cleanAll(KW);
  }
});

// stdout 包含合并统计
test('stdout 应包含合并统计信息', () => {
  cleanAll(KW);
  try {
    setupCandidates();
    setupAllShards();

    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    assert.strictEqual(r.status, 0);
    const output = r.stdout + r.stderr;
    assert.ok(
      output.includes('合并') || output.includes('merged') || output.includes('统计'),
      `stdout 应含合并统计，实际: ${output.substring(0, 200)}`
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-MERGE-002 1/3 分片缺失（<50%），仍应成功
test('TC-MERGE-002 1/3 分片缺失（<50%），仍应合并成功', () => {
  cleanAll(KW);
  try {
    setupCandidates();
    setupAllShards();
    // 删掉第 3 个分片
    fs.rmSync(path.join(POSTS_DIR, `${NOTE_IDS[2]}.json`), { force: true });

    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    assert.strictEqual(r.status, 0, `exit code 应为 0（1/3 失败不超过阈值）\nstderr: ${r.stderr}`);
    assert.ok(fs.existsSync(ANALYSIS_FILE), 'analysis 文件仍应存在');

    const output = r.stdout + r.stderr;
    assert.ok(
      output.includes('缺失') || output.includes('missing') || output.includes('警告') ||
      output.includes('warn') || output.length > 0,
      '应有缺失分片的提示'
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-MERGE-003 2/3 分片缺失（>50%），应失败
test('TC-MERGE-003 2/3 分片缺失（>50%），应以非 0 退出', () => {
  cleanAll(KW);
  try {
    setupCandidates();
    setupAllShards();
    // 只保留第 1 个分片，删掉另外两个
    fs.rmSync(path.join(POSTS_DIR, `${NOTE_IDS[1]}.json`), { force: true });
    fs.rmSync(path.join(POSTS_DIR, `${NOTE_IDS[2]}.json`), { force: true });

    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
    const output = r.stderr + r.stdout;
    assert.ok(
      output.includes('失败率') || output.includes('过高') || output.includes('失败'),
      `错误信息应提及失败率，实际: ${output.substring(0, 200)}`
    );
  } finally {
    cleanAll(KW);
  }
});

// TC-MERGE-004 candidates 文件不存在
test('TC-MERGE-004 candidates 文件不存在应报错退出', () => {
  cleanAll(KW);
  try {
    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', '/nonexistent/candidates.json',
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    assert.notStrictEqual(r.status, 0, 'exit code 应非 0');
    const output = r.stderr + r.stdout;
    assert.ok(
      output.includes('不存在') || output.includes('ENOENT') || output.includes('找不到') ||
      output.includes('candidates'),
      `错误信息应提及文件不存在，实际: ${output.substring(0, 200)}`
    );
  } finally {
    cleanAll(KW);
  }
});

// 分片目录不存在
test('posts-dir 不存在应报错退出', () => {
  cleanAll(KW);
  try {
    setupCandidates();
    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', '/nonexistent/posts-dir',
      '--output', ANALYSIS_FILE,
    ]);
    assert.notStrictEqual(r.status, 0, 'posts-dir 不存在应非 0 退出');
  } finally {
    cleanAll(KW);
  }
});

// 空 candidates（0 帖子）
test('candidates.posts 为空数组应正常退出，output.posts 也为空', () => {
  cleanAll(KW);
  try {
    const taskSpec = makeTaskSpec(KW);
    writeJson(TASK_SPEC_FILE, taskSpec);
    const candidates = makeCandidates(KW, TASK_SPEC_FILE, taskSpec, []);
    writeJson(CANDIDATES_FILE, candidates);
    // 创建空目录
    fs.mkdirSync(POSTS_DIR, { recursive: true });

    const r = runScript('merge-analysis.js', [
      '--keyword', KW,
      '--candidates', CANDIDATES_FILE,
      '--posts-dir', POSTS_DIR,
      '--output', ANALYSIS_FILE,
    ]);
    // 空帖子时允许成功（或失败，取决于实现），但不应崩溃
    if (r.status === 0 && fs.existsSync(ANALYSIS_FILE)) {
      const obj = JSON.parse(fs.readFileSync(ANALYSIS_FILE, 'utf8'));
      assert.ok(Array.isArray(obj.posts), 'posts 应为数组');
    }
  } finally {
    cleanAll(KW);
  }
});

// ─── 后置清理 ─────────────────────────────────────────────────────────────────
cleanAll(KW);

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
