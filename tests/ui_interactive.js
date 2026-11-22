// interactive programs end to end: typed input, menu loop, overflow note after typed input, Stop mid-wait
const { chromium } = require('playwright');
const SQ = '#include <stdio.h>\nint main(void) {\n    int n;\n    printf("n? ");\n    scanf("%d", &n);\n    printf("%d\\n", n * n);\n    return 0;\n}';
const MENU = '#include <stdio.h>\nint main(void) {\n    int c, total = 0;\n    while (1) {\n        printf("1.add 2.exit: ");\n        if (scanf("%d", &c) != 1 || c == 2) break;\n        total++;\n    }\n    printf("total=%d\\n", total);\n    return 0;\n}';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1200);
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'BAD ', m); };
  const set = (s) => p.evaluate((s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s), s);
  const out = () => p.evaluate(() => document.querySelector('#out').innerText);
  const type = async (t) => { await p.waitForSelector('#inLine', { state: 'visible', timeout: 8000 }); await p.fill('#inLine', t); await p.keyboard.press('Enter'); };
  await set(SQ); await p.click('#btnRun'); await type('50000');
  await p.waitForFunction(() => /program exited/.test(document.body.innerText), { timeout: 15000 });
  let o = await out(); ok(/-1794967296/.test(o), 'typed 50000 → wrapped result like gcc'); ok(/went past 2,147,483,647/.test(o), 'overflow note after a typed-input run');
  await set(SQ); await p.click('#btnRun'); await type('12');
  await p.waitForFunction(() => /program exited/.test(document.body.innerText), { timeout: 15000 });
  o = await out(); ok(/144/.test(o) && !/went past/.test(o), 'typed 12 → 144, no note');
  await set(MENU); await p.click('#btnRun'); await type('1'); await type('1'); await type('1'); await type('2');
  await p.waitForFunction(() => /program exited/.test(document.body.innerText), { timeout: 15000 });
  o = await out(); ok(/total=3/.test(o), 'menu loop: three adds then exit → total=3');
  await set(MENU); await p.click('#btnRun'); await p.waitForSelector('#inLine', { state: 'visible' });
  await p.click('#btnStop'); await p.waitForTimeout(500); ok(await p.isVisible('#btnRun'), 'Stop while waiting for input → Run is back');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  console.log('bad', bad); await b.close(); process.exit(bad ? 1 : 0);
})();
