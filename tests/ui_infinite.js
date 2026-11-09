// Programs that never stop must stay stoppable: page responsive, Stop works, output capped (silent loop, counting loop, printing loop).
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  const cases = [['silent', '#include <stdio.h>\nint main(){while(1){}return 0;}'], ['counting', '#include <stdio.h>\nint main(){long i=0;while(1){i++;}return 0;}'],
    ['printing', '#include <stdio.h>\nint main(){int i=0;while(1){printf("%d\\n",i++);}return 0;}'], ['printing-debug-free', '#include <stdio.h>\nint main(){for(;;)putchar(\'x\');}']];
  for (const [name, src] of cases) {
    const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage(), t0 = Date.now(); let ok = true, why = '';
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(500);
    await p.evaluate(s => document.querySelector('.CodeMirror').CodeMirror.setValue(s), src);
    await p.tap('#btnRun'); await p.waitForTimeout(2000);
    const alive = await Promise.race([p.evaluate(() => document.querySelector('#out').textContent.length), new Promise(r => setTimeout(() => r(-1), 3000))]).catch(() => -1);
    if (alive < 0) { ok = false; why = 'page froze'; }
    else {
      if (await p.evaluate(() => !document.querySelector('#btnStop').hidden)) await p.tap('#btnStop'); let ended = false;
      for (let i = 0; i < 40 && !ended; i++) { await p.waitForTimeout(200); ended = await p.evaluate(() => document.querySelector('#btnRun').offsetParent !== null).catch(() => false); }
      if (!ended) { ok = false; why = 'Stop did not end the run'; }
      const len = await p.evaluate(() => document.querySelector('#out').textContent.length).catch(() => -1);
      if (len > 230000) { ok = false; why = 'output not capped ' + len; }
    }
    console.log(name.padEnd(20), ok ? 'ok' : 'FAIL ' + why, (Date.now() - t0) + 'ms'); if (!ok) bad++;
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
