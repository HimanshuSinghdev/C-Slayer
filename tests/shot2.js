const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(700);
  await p.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue('#include <stdio.h>\nint main(void){\n  int x;\n  printf("%d\\n", x)\n  return 0;\n}\n'); });
  await p.click('#btnRun'); await p.waitForTimeout(1200);
  await p.locator('.tabs button[data-tab="problems"]').click(); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/52ff6d1a-1253-58bd-a4b7-382c2ea5656c/scratchpad/prob-320.png' });
  await p.click('#btnTheme'); await p.waitForTimeout(300);
  console.log('theme attr', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'overflowX', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), errs);
  await b.close();
})();
