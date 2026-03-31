const { getScrollMetrics, performScroll, humanScroll, scrollToCommentsArea } = require("./scroll");
const { probeDetailSession } = require("./session");
const { recoverOrThrow, safeEval, safeLocatorOp } = require("./context-recovery");

module.exports = {
  getScrollMetrics,
  performScroll,
  humanScroll,
  scrollToCommentsArea,
  probeDetailSession,
  recoverOrThrow,
  safeEval,
  safeLocatorOp,
};
