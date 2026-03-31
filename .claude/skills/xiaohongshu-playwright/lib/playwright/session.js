const DETAIL_SCROLL_SELECTORS = [
  '.note-scroller',
  '[class*="note-scroller"]',
  '[class*="NoteScroller"]',
];

async function probeDetailSession(page, targetNoteId) {
  return await page.evaluate(({ noteId, scrollSelectors }) => {
    const isVisible = (el) =>
      !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

    const activeNoteId =
      location.href.match(/\/([a-f0-9]{24})\b/i)?.[1] ||
      Object.keys(window.__INITIAL_STATE__?.note?.noteDetailMap || {})[0] ||
      "";

    const scrollSelector =
      scrollSelectors.find((selector) => {
        const el = document.querySelector(selector);
        return isVisible(el) && el.scrollHeight > el.clientHeight + 20;
      }) || "";

    const hasComments = !!document.querySelector(".comments-container");
    const hasLoginLayer = !!document.querySelector(".login-container, [class*='login-modal']");
    const hasRiskLayer = /300013|访问频繁|请稍后再试/.test(document.body?.innerText || "");

    return {
      ok: activeNoteId === noteId && hasComments && !hasLoginLayer && !hasRiskLayer,
      activeNoteId,
      scrollSelector,
      scrollMode: scrollSelector ? "container" : "window",
      hasComments,
      hasLoginLayer,
      hasRiskLayer,
    };
  }, { noteId: targetNoteId, scrollSelectors: DETAIL_SCROLL_SELECTORS });
}

module.exports = {
  probeDetailSession,
};
