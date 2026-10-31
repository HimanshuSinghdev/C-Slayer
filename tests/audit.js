const { chromium } = require('playwright');
const D = '/tmp/claude-0/-home-claude/52ff6d1a-1253-58bd-a4b7-382c2ea5656c/scratchpad/';
(async () => {
  const b = await chromium.launch();
  for (const theme of ['paper', 'slate']) {
    const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1.5 });
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
    await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await p.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue('#include <stdio.h>\nint main(void){\n  int veryLongVariableNameNumberOne = 1, veryLongVariableNameNumberTwo = 2, another = 3;\n  printf("%d %d %d\\n", veryLongVariableNameNumberOne, veryLongVariableNameNumberTwo, another);\n  return 0;\n}\n'); document.querySelector('.CodeMirror').CodeMirror.scrollTo(260, 0); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: D + 'au-' + theme + '-scroll.png' });
    for (const tab of ['tests', 'debug']) {
      if (tab === 'debug') { await p.locator('.CodeMirror-linenumber:visible', { hasText: /^4$/ }).click(); await p.click('#btnDebug'); await p.waitForTimeout(1200); }
      else await p.locator('.tabs button[data-tab="' + tab + '"]').click();
      await p.waitForTimeout(300); await p.screenshot({ path: D + 'au-' + theme + '-' + tab + '.png' });
    }
    console.log(theme, errs);
    await p.close();
  }
  await b.close();
})();
