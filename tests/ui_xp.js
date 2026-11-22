// Progress chip: shown after Grade, repeat grade earns nothing, switch turns it off
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1200);
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'BAD ', m); };
  await p.evaluate(() => { localStorage.removeItem('cs.xpdata'); document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\nint main(void) {\n    printf("hi\\n");\n    return 0;\n}'); });
  const grade = async () => { await p.evaluate(() => document.querySelector('#btnScore').click()); await p.waitForSelector('.xp, .grade, .credit', { timeout: 20000 }); await p.waitForTimeout(800); };
  await grade(); let t = await p.evaluate(() => (document.querySelector('.xp') || {}).innerText || '');
  ok(/Level 2|Level 1|Level 3/.test(t) && /\+\d+ XP/.test(t), 'chip after grade: ' + t.replace(/\s+/g, ' ').slice(0, 60));
  await p.evaluate(() => document.querySelector('#btnScore').click()); await p.waitForTimeout(3000);
  t = await p.evaluate(() => { const x = document.querySelectorAll('.xp'); return x.length ? x[x.length - 1].innerText : ''; });
  ok(/No new XP/.test(t), 'same code again earns nothing');
  await p.evaluate(() => document.querySelector('#btnXp').click());
  ok(/off/.test(await p.evaluate(() => document.querySelector('#xpLbl').textContent)), 'switch label off');
  console.log('bad', bad); await b.close(); process.exit(bad ? 1 : 0);
})();
