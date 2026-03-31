/**
 * 人类化延迟工具
 */

const { sleepRandom, randomInt } = require("../../scripts/human");

async function applyPreGotoHumanDelay(searchPage) {
  await sleepRandom(1500, 3500);

  const moves = randomInt(1, 3);
  for (let i = 0; i < moves; i++) {
    const delta = randomInt(80, 260) * (Math.random() > 0.3 ? 1 : -1);
    await searchPage.evaluate((value) => {
      window.scrollBy({ top: value, behavior: "smooth" });
    }, delta).catch(() => null);
    await sleepRandom(400, 900);
  }
}

async function applyPostGotoHumanDelay() {
  await sleepRandom(800, 1800);
}

module.exports = {
  applyPreGotoHumanDelay,
  applyPostGotoHumanDelay
};
