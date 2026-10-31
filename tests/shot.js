const { chromium } = require('playwright');
const out = process.argv[2] || 'a', theme = process.argv[3] || '';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
  if (theme) await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  const d = '/tmp/claude-0/-home-claude/52ff6d1a-1253-58bd-a4b7-382c2ea5656c/scratchpad/';
  await p.screenshot({ path: d + out + '-editor.png' });
  await p.click('#btnScore'); await p.waitForTimeout(2500);
  const tab = p.locator('.tabs button[data-tab="score"]'); if (await tab.count()) await tab.click(); await p.waitForTimeout(600);
  await p.screenshot({ path: d + out + '-score.png' });
  await b.close();
})();
