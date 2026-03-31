const { sleepRandom } = require("../../scripts/human");
const { probeDetailSession } = require("./session");

const CONTEXT_DESTROYED_RE = /Execution context was destroyed|Cannot find context|Target closed|frame was detached/i;

async function recoverOrThrow(page, label, targetNoteId) {
  await page.waitForLoadState("domcontentloaded").catch(() => null);
  await sleepRandom(500, 1200);

  const session = await probeDetailSession(page, targetNoteId).catch(() => null);
  if (!session?.ok) {
    throw new Error(`DetailSessionLostError: ${label}`);
  }
  return session;
}

async function safeEval(page, label, fn, arg, targetNoteId) {
  try {
    return await page.evaluate(fn, arg);
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || "")) throw error;
    console.warn(`  ⚠️ 上下文销毁 [${label}]，尝试恢复...`);
    await recoverOrThrow(page, label, targetNoteId);
    return await page.evaluate(fn, arg);
  }
}

async function safeLocatorOp(page, label, locatorFn, targetNoteId) {
  try {
    return await locatorFn();
  } catch (error) {
    if (!CONTEXT_DESTROYED_RE.test(error?.message || "")) throw error;
    console.warn(`  ⚠️ 上下文销毁 [${label}]，尝试恢复...`);
    await recoverOrThrow(page, label, targetNoteId);
    return await locatorFn();
  }
}

module.exports = {
  recoverOrThrow,
  safeEval,
  safeLocatorOp,
};
