/**
 * 进程管理工具
 */

const { spawnSync } = require('child_process');
const path = require('path');

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`脚本执行失败: ${path.basename(scriptPath)} (exit ${result.status})`);
  }
}

module.exports = {
  runNodeScript
};
