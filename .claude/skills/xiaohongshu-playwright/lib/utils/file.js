/**
 * 文件操作工具
 */

const fs = require("fs");
const { spawn } = require("child_process");

function loadJsonFile(filePath, label = "JSON 文件") {
  const text = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 解析失败: ${error.message}`);
  }
}

function openFile(filePath) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", filePath], { stdio: "ignore" });
    } else if (process.platform === "darwin") {
      spawn("open", [filePath], { stdio: "ignore" });
    } else {
      spawn("xdg-open", [filePath], { stdio: "ignore" });
    }
  } catch (error) {
    console.warn(`无法打开文件: ${error.message}`);
  }
}

module.exports = {
  loadJsonFile,
  openFile
};
