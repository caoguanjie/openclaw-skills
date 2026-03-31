/**
 * 小红书业务模块汇总导出
 */

const { loadCookies, saveCookies } = require("./cookies");
const { loadExistingData, appendPostResult } = require("./data-persistence");
const { parseStateComments } = require("./parser");

module.exports = {
  // Cookie 管理
  loadCookies,
  saveCookies,
  // 数据持久化
  loadExistingData,
  appendPostResult,
  // 数据解析
  parseStateComments,
};
