#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const skillDir = path.resolve(__dirname, '..');
const outputZip = path.join(skillDir, 'xiaohongshu-playwright.zip');

if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

const includes = [
  'SKILL.md',
  'package.json',
  'package-lock.json',
  '.npmrc',
  'scripts/',
  'lib/',
  'evals/',
  'references/excel-format.md',
  'references/execution-checklist.md',
  'references/environment-setup.md',
  'references/subagent-task-template.md'
];

const zipCmd = `cd "${skillDir}" && zip -r xiaohongshu-playwright.zip ${includes.join(' ')}`;

try {
  execSync(zipCmd, { stdio: 'inherit' });
  console.log('\n✅ 打包完成: xiaohongshu-playwright.zip');
  console.log(`📦 文件位置: ${outputZip}`);
} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exit(1);
}
