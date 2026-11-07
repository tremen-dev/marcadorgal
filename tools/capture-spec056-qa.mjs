import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const QA_DIR = resolve("docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-056");
mkdirSync(QA_DIR, { recursive: true });

const tokensCss = readFileSync("src/design/tokens.css", "utf8");
const rawModuleCss = readFileSync("src/components/xornada/Xornada.module.css", "utf8");

// Convert module CSS to global CSS by stripping :local and keeping class names as-is
const cleanedModuleCss = rawModuleCss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/@media \(min-width: 1024px\) \{[\s\S]*?\}/g, "");

const baseHtml = `<!DOCTYPE html>
<html lang="gl">
<head>
<meta charset="utf-8">
<style>
${tokensCss}
body {
  margin: 0;
  padding: 24px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-width: 440px;
  background: var(--bg-elev);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
${cleanedModuleCss}
</style>
</head>
<body>
<div id="root"></div>
</body>
</html>`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 440, height: 600 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Fila cerrada con goles (estado inicial)
  const htmlClosed = baseHtml.replace(
    '<div id="root"></div>',
    `<div id="root">
      <ul>
        <li class="row rowWithGoals" data-testid="match-row" role="button" tabindex="0" aria-expanded="false">
          <div class="margin">
            <span class="marginLines">
              <span class="marginMain marginMinute ember">
                <span class="dot"></span>
                74'
              </span>
              <span class="marginSub">2ª PARTE</span>
            </span>
            <span class="goalsAffordance">▸</span>
          </div>
          <div class="sides">
            <span class="team galician">Deportivo ABANCA</span>
            <span class="score">1</span>
            <span class="team">FC Barcelona Femení</span>
            <span class="score">2</span>
          </div>
          <div class="matchGoals" data-testid="match-goals" data-expanded="false">
            <div class="matchGoalsInner"></div>
          </div>
        </li>
      </ul>
    </div>`
  );

  await page.setContent(htmlClosed);
  const rowClosed = page.locator('[data-testid="match-row"]');
  await rowClosed.screenshot({ path: `${QA_DIR}/01-fila-cerrada.png` });

  // 2. Fila abierta (desplegada) tras click/tap
  const htmlOpen = baseHtml.replace(
    '<div id="root"></div>',
    `<div id="root">
      <ul>
        <li class="row rowWithGoals" data-testid="match-row" role="button" tabindex="0" aria-expanded="true">
          <div class="margin">
            <span class="marginLines">
              <span class="marginMain marginMinute ember">
                <span class="dot"></span>
                74'
              </span>
              <span class="marginSub">2ª PARTE</span>
            </span>
            <span class="goalsAffordance">▾</span>
          </div>
          <div class="sides">
            <span class="team galician">Deportivo ABANCA</span>
            <span class="score">1</span>
            <span class="team">FC Barcelona Femení</span>
            <span class="score">2</span>
          </div>
          <div class="matchGoals matchGoalsExpanded" data-testid="match-goals" data-expanded="true">
            <div class="matchGoalsInner">
              <div class="goalsTeams">
                <div class="teamGoalsCol" data-team="home">
                  <span class="teamGoalsName">Deportivo ABANCA</span>
                  <div class="teamGoalsList">
                    <span class="goalPill" data-team="home">
                      ⚽ Millene 23'<span class="goalPenalty"> (p.)</span>
                    </span>
                  </div>
                </div>
                <div class="teamGoalsCol" data-team="away">
                  <span class="teamGoalsName">FC Barcelona Femení</span>
                  <div class="teamGoalsList">
                    <span class="goalPill" data-team="away">
                      ⚽ Alexia 45'
                    </span>
                    <span class="goalPill" data-team="away">
                      ⚽ Aitana 61'<span class="goalPenalty"> (p.p.)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>`
  );

  await page.setContent(htmlOpen);
  const rowOpen = page.locator('[data-testid="match-row"]');
  await rowOpen.screenshot({ path: `${QA_DIR}/02-fila-abierta.png` });

  // 3. Fila abierta con Goleador Reciente activo (marca GOL en el marcador y en el autor)
  const htmlRecent = baseHtml.replace(
    '<div id="root"></div>',
    `<div id="root">
      <ul>
        <li class="row rowWithGoals live" data-testid="match-row" role="button" tabindex="0" aria-expanded="true">
          <div class="margin">
            <span class="marginLines">
              <span class="marginMain marginMinute ember">
                <span class="dot"></span>
                75'
              </span>
              <span class="marginSub">2ª PARTE</span>
            </span>
            <span class="goalsAffordance">▾</span>
          </div>
          <div class="sides">
            <span class="team galician winner">Deportivo ABANCA</span>
            <span class="score recentGoal recentGoalBox" data-testid="score" data-recent-goal="">2</span>
            <span class="team loser">FC Barcelona Femení</span>
            <span class="score loser">2</span>
          </div>
          <div class="matchGoals matchGoalsExpanded" data-testid="match-goals" data-expanded="true">
            <div class="matchGoalsInner">
              <div class="goalsTeams">
                <div class="teamGoalsCol" data-team="home">
                  <span class="teamGoalsName">Deportivo ABANCA</span>
                  <div class="teamGoalsList">
                    <span class="goalPill" data-team="home">
                      ⚽ Millene 23'<span class="goalPenalty"> (p.)</span>
                    </span>
                    <span class="goalPill recentGoalPill" data-team="home" data-recent="true">
                      ⚽ Ainhoa Marín 74'
                      <span class="recentScorerBadge" data-testid="recent-scorer-badge">GOL</span>
                    </span>
                  </div>
                </div>
                <div class="teamGoalsCol" data-team="away">
                  <span class="teamGoalsName">FC Barcelona Femení</span>
                  <div class="teamGoalsList">
                    <span class="goalPill" data-team="away">
                      ⚽ Alexia 45'
                    </span>
                    <span class="goalPill" data-team="away">
                      ⚽ Aitana 61'<span class="goalPenalty"> (p.p.)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>`
  );

  await page.setContent(htmlRecent);
  const rowRecent = page.locator('[data-testid="match-row"]');
  await rowRecent.screenshot({ path: `${QA_DIR}/03-goleador-reciente.png` });

  // 4. Fila sin goles (0-0 o sin eventos): sin affordance, cursor default
  const htmlNoGoals = baseHtml.replace(
    '<div id="root"></div>',
    `<div id="root">
      <ul>
        <li class="row" data-testid="match-row">
          <div class="margin">
            <span class="marginLines">
              <span class="marginMain marginMinute ember">
                <span class="dot"></span>
                18'
              </span>
              <span class="marginSub">1ª PARTE</span>
            </span>
          </div>
          <div class="sides">
            <span class="team galician">As Celtas</span>
            <span class="score">0</span>
            <span class="team">Real Oviedo Femenino</span>
            <span class="score">0</span>
          </div>
        </li>
      </ul>
    </div>`
  );

  await page.setContent(htmlNoGoals);
  const rowNoGoals = page.locator('[data-testid="match-row"]');
  await rowNoGoals.screenshot({ path: `${QA_DIR}/04-fila-sin-goles.png` });

  await browser.close();
  console.log("QA captures generated successfully in:", QA_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
