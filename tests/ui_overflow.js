// overflow note: shown after Run and in the grade, absent for programs that stay in range
const { chromium } = require('playwright');
const BAD = '#include <stdio.h>\nint main(void) {\n    for (int i = 50000; i <= 50002; i++) printf("%d\\n", i * i);\n    return 0;\n}';
const OK = '#include <stdio.h>\nint main(void) {\n    for (long long i = 50000; i <= 50002; i++) printf("%lld\\n", i * i);\n    return 0;\n}';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  let bad = 0;
  for (const [name, src, want] of [['int', BAD, true], ['long long', OK, false]]) {
    await p.evaluate((s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s), src);
    await p.click('#btnRun'); await p.waitForFunction(() => /program exited/.test(document.body.innerText), { timeout: 20000 });
    const run = await p.evaluate(() => /went past 2,147,483,647/.test(document.body.innerText));
    await p.click('#btnScore'); await p.waitForTimeout(3500);
    const grade = await p.evaluate(() => /overflowed here/.test(document.querySelector('#scoreBox').innerText));
    const ok = run === want && grade === want; if (!ok) bad++;
    console.log(ok ? 'ok ' : 'BAD', name, 'run note', run, 'grade note', grade);
    await p.evaluate(() => { const t = [...document.querySelectorAll('[data-tab]')].find(x => /out|term/i.test(x.dataset.tab)); t && t.click(); });
  }
  console.log('bad', bad); await b.close();
})();
