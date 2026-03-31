const {
  DELAYS,
  CONFIG,
  sleepRandom,
  getScrollRatio,
  calculateScrollDelta,
  shouldBacktrackScroll,
  calculateBacktrackDelta,
} = require("../../scripts/human");

async function getScrollMetrics(page, detailContext) {
  return page.evaluate((ctx) => {
    const target =
      ctx.scrollMode === "container" && ctx.scrollSelector
        ? document.querySelector(ctx.scrollSelector)
        : document.scrollingElement || document.documentElement;

    if (!target) {
      return {
        top: 0,
        viewportHeight: window.innerHeight,
        scrollHeight: 0,
      };
    }

    if (ctx.scrollMode === "container") {
      return {
        top: target.scrollTop,
        viewportHeight: target.clientHeight || window.innerHeight,
        scrollHeight: target.scrollHeight || target.clientHeight || 0,
      };
    }

    return {
      top: window.scrollY || document.documentElement.scrollTop,
      viewportHeight: window.innerHeight,
      scrollHeight:
        document.scrollingElement?.scrollHeight || document.body?.scrollHeight || 0,
    };
  }, detailContext);
}

async function performScroll(page, detailContext, delta, forceToBottom = false) {
  return page.evaluate(
    ({ ctx, step, toBottom }) => {
      const target =
        ctx.scrollMode === "container" && ctx.scrollSelector
          ? document.querySelector(ctx.scrollSelector)
          : document.scrollingElement || document.documentElement;

      if (!target) {
        return 0;
      }

      if (ctx.scrollMode === "container") {
        const before = target.scrollTop;
        target.scrollTo({
          top: toBottom ? target.scrollHeight : before + step,
          behavior: "smooth",
        });
        return before;
      }

      const before = window.scrollY || document.documentElement.scrollTop;
      if (toBottom) {
        window.scrollTo(0, document.body.scrollHeight);
      } else {
        window.scrollBy({ top: step, behavior: "smooth" });
      }
      return before;
    },
    { ctx: detailContext, step: Math.round(delta), toBottom: forceToBottom }
  );
}

async function humanScroll(page, speed, largeMode, pushCount, detailContext) {
  const beforeState = await getScrollMetrics(page, detailContext);
  let baseRatio = getScrollRatio(speed);
  if (largeMode) {
    baseRatio *= 2.0;
  }

  let actualDelta = 0;
  let currentScrollTop = beforeState.top;
  let prevTop = beforeState.top;
  let furthestScrollTop = beforeState.top;

  for (let i = 0; i < Math.max(1, pushCount); i++) {
    const scrollDelta = calculateScrollDelta(beforeState.viewportHeight, baseRatio);
    await performScroll(page, detailContext, scrollDelta);
    await sleepRandom(...DELAYS.SCROLL_WAIT);

    const state = await getScrollMetrics(page, detailContext);
    currentScrollTop = state.top;
    furthestScrollTop = Math.max(furthestScrollTop, currentScrollTop);
    const deltaThis = currentScrollTop - prevTop;
    prevTop = currentScrollTop;

    if (
      shouldBacktrackScroll(
        speed,
        largeMode,
        currentScrollTop,
        state.viewportHeight || beforeState.viewportHeight
      )
    ) {
      const backtrackDelta = calculateBacktrackDelta(
        state.viewportHeight || beforeState.viewportHeight,
        Math.max(deltaThis, scrollDelta),
        currentScrollTop
      );
      await performScroll(page, detailContext, -backtrackDelta);
      await sleepRandom(...DELAYS.POST_SCROLL);

      const afterBacktrackState = await getScrollMetrics(page, detailContext);
      currentScrollTop = afterBacktrackState.top;
      prevTop = currentScrollTop;
    }

    actualDelta = furthestScrollTop - beforeState.top;

    if (i < pushCount - 1) {
      await sleepRandom(...DELAYS.HUMAN_DELAY);
    }
  }

  if (actualDelta < CONFIG.MIN_SCROLL_DELTA && pushCount > 0) {
    await performScroll(page, detailContext, 0, true);
    await sleepRandom(...DELAYS.POST_SCROLL);
    const state = await getScrollMetrics(page, detailContext);
    currentScrollTop = state.top;
    actualDelta = currentScrollTop - beforeState.top;
  }

  return { actualDelta, currentScrollTop };
}

async function scrollToCommentsArea(page, detailContext) {
  console.log("  📜 滚动到评论区...");
  await page.evaluate((ctx) => {
    const root = ctx.rootSelector ? document.querySelector(ctx.rootSelector) : document;
    const container = root?.querySelector(".comments-container") || document.querySelector(".comments-container");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const target =
      ctx.scrollMode === "container" && ctx.scrollSelector
        ? document.querySelector(ctx.scrollSelector)
        : window;
    target.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
      })
    );
  }, detailContext);
  await sleepRandom(500, 1000);
}

module.exports = {
  getScrollMetrics,
  performScroll,
  humanScroll,
  scrollToCommentsArea,
};
