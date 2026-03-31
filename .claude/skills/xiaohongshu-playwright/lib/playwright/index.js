const { applyPreGotoHumanDelay, applyPostGotoHumanDelay } = require("./delay");
const { getScrollMetrics, performScroll, humanScroll, scrollToCommentsArea } = require("./scroll");
const { probeDetailSession } = require("./session");
const { recoverOrThrow, safeEval, safeLocatorOp } = require("./context-recovery");

module.exports = {
  applyPreGotoHumanDelay,
  applyPostGotoHumanDelay,
  getScrollMetrics,
  performScroll,
  humanScroll,
  scrollToCommentsArea,
  probeDetailSession,
  recoverOrThrow,
  safeEval,
  safeLocatorOp,
};
