// Independent verification of SPEC-068 (sdd-verificador). Usage:
//   node verify-068.mjs measure <origin> <outJson>      -> row metrics (label/box variant given by origin)
//   node verify-068.mjs checks <origin> <shotsDir>      -> CA-2/3/5 checks on the branch + screenshots
import { chromium } from "file:///D:/src/tremen-dev/wt-068/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const [, , mode, origin, out] = process.argv;
const WIDTHS = [360, 1440];
const BOTH = "primera-division-2026-27-j8-real-betis-rc-deportivo";
const LIVE = "primera-rfef-g1-2026-27-j6-bilbao-athletic-ud-ourense";
const NO_GOALS = "primera-division-2026-27-j8-sevilla-fc-getafe-cf";
const FG = "rgb(245, 241, 234)";
const FG_MUTED = "rgb(167, 165, 160)";

const browser = await chromium.launch();
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
};

async function ready(page, url, width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

const measureAll = (page) =>
  page.evaluate(() => {
    const top = (el) => el.offsetTop;
    return [...document.querySelectorAll('[data-testid="match-row"]')].map(
      (li) => ({
        id: li.dataset.matchId,
        hasGoals: li.dataset.hasGoals === "true",
        height: li.offsetHeight,
        names: [...li.querySelectorAll('[data-testid="team-name"]')].map(
          (e) => top(e) - top(li),
        ),
        scores: [...li.querySelectorAll('[data-testid="score"]')].map(
          (e) => top(e) - top(li),
        ),
        affordance: li.querySelector('[data-testid="goals-affordance"]') !== null,
      }),
    );
  });

if (mode === "measure") {
  const result = {};
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await ready(page, `${origin}/demo/xornada`, width);
    const plain = await measureAll(page);
    await page.addStyleTag({
      content: '[data-testid="team-goals"] { display: none !important; }',
    });
    const noBlocks = await measureAll(page);
    await page.addStyleTag({
      content: '[data-testid="goals-affordance"] { display: none !important; }',
    });
    const noBlocksNoAffordance = await measureAll(page);
    result[width] = { plain, noBlocks, noBlocksNoAffordance };
    await page.close();
  }
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`written ${out}`);
}

if (mode === "checks") {
  mkdirSync(out, { recursive: true });
  for (const route of [
    { path: "/demo/xornada", lang: "gl" },
    { path: "/es/demo/xornada", lang: "es" },
  ]) {
    for (const width of WIDTHS) {
      const tag = `${route.lang}-${width}`;
      const page = await browser.newPage();
      await ready(page, `${origin}${route.path}`, width);
      const row = page.locator(
        `[data-testid="match-row"][data-match-id="${BOTH}"]`,
      );
      const live = page.locator(
        `[data-testid="match-row"][data-match-id="${LIVE}"]`,
      );
      const plain = page.locator(
        `[data-testid="match-row"][data-match-id="${NO_GOALS}"]`,
      );

      // CA-5 served state
      check((await row.getAttribute("aria-expanded")) === "false", `${tag} CA-5 served aria-expanded=false`);
      const ids = ((await row.getAttribute("aria-controls")) ?? "").split(" ");
      check(ids.join(" ") === `goals-${BOTH}-home goals-${BOTH}-away`, `${tag} CA-5 aria-controls ids in DOM order: ${ids.join(" ")}`);
      for (const id of ids) {
        const n = await page.locator(`[id="${id}"]`).count();
        check(n === 1, `${tag} CA-5 #${id} resolves to exactly 1 element (got ${n})`);
      }
      const servedHeights = await row.getByTestId("team-goals").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      check(servedHeights.length === 2 && servedHeights.every((h) => h === 0), `${tag} CA-5 both blocks served with height 0: ${JSON.stringify(servedHeights)}`);
      check((await plain.getAttribute("role")) === null && (await plain.getAttribute("aria-controls")) === null && (await plain.getAttribute("aria-expanded")) === null, `${tag} CA-5 row without goals gains no attributes`);
      check((await plain.getByTestId("team-goals").count()) === 0, `${tag} CA-5 row without goals has no blocks`);

      // Folded screenshot of the row
      await row.screenshot({ path: `${out}/ca6-${tag}-plegada.png` });

      // Click opens
      await row.click();
      check((await row.getAttribute("aria-expanded")) === "true", `${tag} CA-5 click on row expands`);
      await page.waitForTimeout(450);
      const openHeights = await row.getByTestId("team-goals").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      check(openHeights.every((h) => h > 10), `${tag} CA-5 both blocks open: ${JSON.stringify(openHeights)}`);
      const transitions = await row.getByTestId("team-goals").evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionProperty));
      check(transitions.every((t) => t.includes("grid-template-rows")), `${tag} CA-5 transition on grid-template-rows: ${transitions[0]}`);

      // CA-1 geometry
      const names = row.getByTestId("team-name");
      const [homeN, awayN] = [await names.nth(0).boundingBox(), await names.nth(1).boundingBox()];
      const [homeB, awayB] = [await row.getByTestId("team-goals").nth(0).boundingBox(), await row.getByTestId("team-goals").nth(1).boundingBox()];
      check(homeB.y >= homeN.y + homeN.height - 1 && homeB.y + homeB.height <= awayN.y + 1, `${tag} CA-1 home block between the two names`);
      check(awayB.y >= awayN.y + awayN.height - 1, `${tag} CA-1 away block under the away name`);
      const borders = await row.getByTestId("team-goals").evaluateAll((els) => els.flatMap((el) => [el, ...el.querySelectorAll("*")].map((e) => getComputedStyle(e).borderTopWidth + "/" + getComputedStyle(e).borderBottomWidth)));
      check(borders.every((b) => b === "0px/0px"), `${tag} CA-1 no borders inside blocks`);
      check(!(await row.textContent()).includes("⚽"), `${tag} CA-1 no emoji`);

      // CA-2
      const minutes = row.getByTestId("goal-minute");
      const players = row.getByTestId("goal-player");
      const minuteTexts = await minutes.allTextContents();
      check(JSON.stringify(minuteTexts) === JSON.stringify(["23'", "67'", "80'"]), `${tag} CA-2 minutes in order: ${minuteTexts.join(",")}`);
      const playerTexts = await players.allTextContents();
      check(playerTexts[1] === "Francisco José Sánchez Rodríguez de la Fuente", `${tag} CA-2 long name whole: ${playerTexts[1]}`);
      const mBoxes = await minutes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, right: r.right, y: r.y }; }));
      check(mBoxes.every((b) => Math.abs(b.w - mBoxes[0].w) < 0.5 && Math.abs(b.right - mBoxes[0].right) < 0.5), `${tag} CA-2 all goal-minute share width and right edge: ${JSON.stringify(mBoxes.map((b) => [b.w, b.right]))}`);
      const mStyles = await minutes.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.fontFamily, s.fontVariantNumeric, s.color, s.textAlign]; }));
      check(mStyles.every(([f, v, c, a]) => /Geist Mono/.test(f) && v === "tabular-nums" && c === FG_MUTED && a === "right"), `${tag} CA-2 minute mono/tabular/--fg-muted/right: ${JSON.stringify(mStyles[0])}`);
      const pStyles = await players.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.fontFamily, s.color]; }));
      check(pStyles.every(([f]) => /^"?Geist"?,/.test(f) && !/Geist Mono/.test(f)), `${tag} CA-2 player in --sans: ${pStyles[0][0]}`);
      check(pStyles.every(([, c]) => c === FG_MUTED), `${tag} CA-2 players --fg-muted (no recent in this row): ${pStyles.map((p) => p[1]).join("|")}`);
      const longM = await minutes.nth(1).boundingBox();
      const longP = await players.nth(1).boundingBox();
      const lines = Math.round(longP.height / 16);
      check(Math.abs(longM.y - longP.y) <= 1, `${tag} CA-2 minute top == player top (±1): ${longM.y} vs ${longP.y}`);
      if (width === 360) check(lines >= 2, `${tag} CA-2 long name wraps at 360 (lines=${lines})`);
      const overflow = await players.nth(1).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      check(!overflow, `${tag} CA-2 long name does not overflow`);
      const sidesRight = await row.locator('[class*="sides"]').first().evaluate((el) => el.getBoundingClientRect().right);
      check(longP.x + longP.width <= sidesRight + 0.5, `${tag} CA-2 long name stays inside .sides (${(longP.x + longP.width).toFixed(1)} <= ${sidesRight.toFixed(1)})`);

      // CA-3
      const kinds = row.getByTestId("goal-kind");
      const kindTexts = await kinds.allTextContents();
      check(JSON.stringify(kindTexts) === JSON.stringify(["(p.)", "(p.p.)"]), `${tag} CA-3 kinds: ${kindTexts.join(",")}`);
      const kStyles = await kinds.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.color, s.fontStyle]; }));
      check(kStyles.every(([c, f]) => c === FG_MUTED && f === "normal"), `${tag} CA-3 kind --fg-muted upright: ${JSON.stringify(kStyles)}`);
      // The kind follows the player in the same line
      const kindOrder = await row.getByTestId("goal-line").first().evaluate((el) => [...el.children].map((c) => c.dataset.testid));
      check(JSON.stringify(kindOrder) === JSON.stringify(["goal-minute", "goal-player", "goal-kind"]), `${tag} CA-3 line children order: ${kindOrder.join(",")}`);

      // Screenshot expanded
      await row.screenshot({ path: `${out}/ca1-ca2-ca3-${tag}-desplegada.png` });

      // CA-5 click inside a goal-line folds
      await row.getByTestId("goal-line").nth(1).click();
      check((await row.getAttribute("aria-expanded")) === "false", `${tag} CA-5 click inside a goal-line folds`);
      const foldedAttrs = await row.getByTestId("team-goals").evaluateAll((els) => els.map((e) => e.dataset.expanded));
      check(foldedAttrs.every((a) => a === "false"), `${tag} CA-5 blocks data-expanded=false after fold`);
      // click on goal-kind too (deep inside)
      await row.click();
      await page.waitForTimeout(350);
      await row.getByTestId("goal-kind").first().click();
      check((await row.getAttribute("aria-expanded")) === "false", `${tag} CA-5 click on goal-kind folds`);
      // keyboard
      await row.focus();
      await page.keyboard.press("Enter");
      check((await row.getAttribute("aria-expanded")) === "true", `${tag} CA-5 Enter expands`);
      await page.keyboard.press("Space");
      check((await row.getAttribute("aria-expanded")) === "false", `${tag} CA-5 Space folds`);
      await plain.click();
      check((await plain.getAttribute("aria-expanded")) === null, `${tag} CA-5 click on row without goals does nothing`);

      // CA-4 on the live row
      await live.click();
      await page.waitForTimeout(450);
      const recent = live.locator('[data-testid="goal-line"][data-recent="true"]');
      check((await recent.count()) === 1, `${tag} CA-4 one recent line`);
      check((await recent.getByTestId("goal-player").textContent()) === "Unai Gómez", `${tag} CA-4 recent is Unai Gómez`);
      const recentColor = await recent.getByTestId("goal-player").evaluate((e) => getComputedStyle(e).color);
      check(recentColor === FG, `${tag} CA-4 recent player in --fg: ${recentColor}`);
      const badge = recent.getByTestId("recent-scorer-badge");
      const badgeOrder = await recent.evaluate((el) => [...el.children].map((c) => c.dataset.testid));
      check(JSON.stringify(badgeOrder) === JSON.stringify(["goal-minute", "goal-player", "recent-scorer-badge"]), `${tag} CA-4 badge after the name: ${badgeOrder.join(",")}`);
      const badgeStyle = await badge.evaluate((e) => { const s = getComputedStyle(e); return [s.animationName, s.animationIterationCount]; });
      check(/recent-scorer-pulse/.test(badgeStyle[0]) && Number(badgeStyle[1]) > 100, `${tag} CA-4 badge animates with finite iterations: ${badgeStyle.join(" / ")}`);
      await live.screenshot({ path: `${out}/ca4-${tag}-reciente.png` });

      // Full page shot at this width (both rows expanded)
      await row.click();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${out}/pagina-${tag}.png`, fullPage: false });
      await page.close();
    }
  }
  // Reduced motion
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await ready(page, `${origin}/demo/xornada`, 360);
  const live = page.locator(`[data-testid="match-row"][data-match-id="${LIVE}"]`);
  await live.click();
  await page.waitForTimeout(100);
  const anim = await live.getByTestId("recent-scorer-badge").evaluate((e) => getComputedStyle(e).animationName);
  check(anim === "none", `reduced-motion CA-4 badge animation-name none: ${anim}`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} FAILURES`);
  process.exit(1);
}
console.log("\nALL CHECKS PASSED");
