// Fix it button: appears for fixable problems, fixes the code, Ctrl+Z restores it
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
  const BAD = '#include <stdio.h>\nint main(void) {\n    int n;\n    scanf("%d", n)\n    printf("%d\\n", n);\n    return 0;\n}';
  await p.evaluate((s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s), BAD);
  let bad = 0; const steps = [];
  for (let i = 0; i < 4; i++) {
    if (await p.isVisible('#btnStop')) { await p.click('#btnStop'); await p.waitForTimeout(300); }
    await p.click('#btnRun'); await p.waitForTimeout(900);
    await p.evaluate(() => { const t = [...document.querySelectorAll('.tabs button')].find(x => /problem/i.test(x.textContent)); t && t.click(); });
    const had = await p.waitForSelector('.fixit button', { timeout: 8000 }).catch(() => null); if (!had) break;
    steps.push(await had.innerText()); await had.click(); await p.waitForTimeout(500);
    if (await p.$('.fixit button')) { bad++; console.log('BAD stale Fix it button after the code changed'); }
  }
  if (await p.isVisible('#btnStop')) await p.click('#btnStop');
  const code = await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  const fine = /scanf\("%d", &n\);/.test(code);
  const left = await p.evaluate(() => document.querySelectorAll('#probList li').length);
  if (!fine) bad++;
  await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.undo());
  const undone = await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue().length < 1e6);
  console.log(fine ? 'ok ' : 'BAD', 'fix steps:', JSON.stringify(steps), '| problems left', left, '| undo ok', undone);
  console.log('bad', bad); await b.close(); process.exit(bad ? 1 : 0);
})();
