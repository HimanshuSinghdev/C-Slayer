const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  const setCode = async (c) => { await p.evaluate(c => { document.querySelector('.CodeMirror').CodeMirror.setValue(c); }, c); };
  await setCode('#include <stdio.h>\nint main(void){ long long s=0; for (long long i=0;i<20000000;i++){ s += i%3; if (s>1000000000) s-=1000000000; } printf("%lld\\n",s); return 0; }');
  let t = Date.now(); await p.click('#btnRun'); await p.waitForFunction(() => /program exited/.test(document.querySelector('#out, .out, #console')?.textContent || document.body.innerText), null, { timeout: 30000 });
  console.log('speed run ms', Date.now() - t, (await p.evaluate(() => document.body.innerText)).match(/19999999|exited with status \d+/g));
  await setCode('int main(void){ for(;;){} return 0; }');
  await p.click('#btnRun'); await p.waitForTimeout(1500); t = Date.now(); await p.click('#btnStop');
  await p.waitForFunction(() => !document.querySelector('#btnRun').hidden, null, { timeout: 5000 }); console.log('stop took ms', Date.now() - t);
  // run again after the worker restart
  await setCode('#include <stdio.h>\nint main(void){ printf("again\\n"); return 0; }');
  await p.click('#btnRun'); await p.waitForFunction(() => /again/.test(document.body.innerText), null, { timeout: 5000 }); console.log('rerun ok');
  // interactive program still works (VM path)
  await setCode('#include <stdio.h>\nint main(void){ int x; printf("n? "); scanf("%d",&x); printf("sq=%d\\n",x*x); return 0; }');
  await p.click('#btnRun'); await p.waitForSelector('#inForm:not([hidden])', { timeout: 5000 }); await p.fill('#inLine', '9'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /sq=81/.test(document.body.innerText), null, { timeout: 5000 }); console.log('input ok');
  console.log('errors', errs); await b.close();
})();
