'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(SKILL_DIR, 'scripts');

/**
 * 同步运行指定脚本，返回 { status, stdout, stderr }
 * @param {string} scriptName - scripts/ 目录下的文件名，例如 'save-task-spec.js'
 * @param {string[]} args - CLI 参数数组
 * @param {object} [options] - spawnSync 选项（env, timeout 等）
 */
function runScript(scriptName, args = [], options = {}) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const result = spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    cwd: SKILL_DIR,
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

module.exports = { runScript, SKILL_DIR, SCRIPTS_DIR };
