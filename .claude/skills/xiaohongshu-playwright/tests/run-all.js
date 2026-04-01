'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const TESTS_DIR = __dirname;
const TEST_FILES = [
  'scripts/save-task-spec.test.js',
  'scripts/filter-comments.test.js',
  'scripts/merge-analysis.test.js',
  'scripts/generate-excel.test.js',
  'scripts/cleanup-task-specs.test.js',
];

let totalPassed = 0;
let totalFailed = 0;

console.log('══════════════════════════════════════════════════');
console.log('   xiaohongshu-playwright 自动化测试套件');
console.log('══════════════════════════════════════════════════\n');

for (const testFile of TEST_FILES) {
  const fullPath = path.join(TESTS_DIR, testFile);
  const result = spawnSync('node', [fullPath], {
    encoding: 'utf8',
    timeout: 60000,
    cwd: path.resolve(TESTS_DIR, '..'),
  });

  // 直接打印子进程输出
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  // 解析 "Passed: N, Failed: M"
  const match = (result.stdout || '').match(/Passed:\s*(\d+),\s*Failed:\s*(\d+)/);
  if (match) {
    totalPassed += parseInt(match[1], 10);
    totalFailed += parseInt(match[2], 10);
  } else if (result.status !== 0) {
    // 脚本崩溃（未输出统计行）
    console.log(`\n  ⚠ ${testFile} 未正常退出（status=${result.status}）`);
    totalFailed++;
  }
}

console.log('\n══════════════════════════════════════════════════');
console.log(`   总计：${totalPassed} 通过，${totalFailed} 失败`);
console.log('══════════════════════════════════════════════════\n');

process.exit(totalFailed > 0 ? 1 : 0);
