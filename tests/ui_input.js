const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  const setCode = (c) => p.evaluate(c => document.querySelector('.CodeMirror').CodeMirror.setValue(c), c);
  const out = () => p.evaluate(() => document.querySelector('#out').textContent);
  const send = async (t) => { await p.waitForSelector('#inForm:not([hidden])', { timeout: 6000 }); await p.fill('#inLine', t); await p.keyboard.press('Enter'); await p.waitForTimeout(250); };
  const done = () => p.waitForFunction(() => /program exited|error/i.test(document.querySelector('#out').textContent), null, { timeout: 8000 });
  // 1. several inputs, prompts without newline, random numbers seeded from the clock, state across inputs
  await setCode('#include <stdio.h>\n#include <stdlib.h>\n#include <time.h>\nint main(void){ srand(time(NULL)); int r=rand(); printf("tag %d\\n", r%1000); int n,s=0,k=0; printf("how many? "); scanf("%d",&n); for(int i=0;i<n;i++){ int x; printf("num %d: ",i+1); scanf("%d",&x); s+=x; k++; } printf("\\nsum=%d count=%d\\n", s, k); char nm[20]; printf("name: "); scanf("%19s", nm); printf("hi %s\\n", nm); return 3; }');
  await p.click('#btnRun'); await send('3'); await send('10'); await send('20'); await send('30'); await send('Asha'); await done();
  const o1 = await out(); console.log(JSON.stringify(o1));
  const tags = o1.match(/tag \d+/g); console.log('tag printed once:', tags && tags.length === 1, '| prompts once each:', (o1.match(/num 1:/g) || []).length === 1, '| ok:', /sum=60 count=3/.test(o1) && /hi Asha/.test(o1) && /status 3/.test(o1));
  // 2. read until EOF
  await p.click('#btnClearOut');
  await setCode('#include <stdio.h>\nint main(void){ int x,t=0; while (scanf("%d",&x)==1){ t+=x; printf("running %d\\n",t);} printf("end %d\\n",t); return 0; }');
  await p.click('#btnRun'); await send('5'); await send('6'); await p.click('#btnEof'); await done();
  console.log(JSON.stringify(await out()));
  // 3. interactive game loop with getchar and fgets
  await p.click('#btnClearOut');
  await setCode('#include <stdio.h>\n#include <string.h>\nint main(void){ char l[50]; int n=0; while (fgets(l,50,stdin)) { l[strcspn(l,"\\n")]=0; if(!strcmp(l,"quit")) break; n++; printf("%d:%s\\n",n,l);} return n; }');
  await p.click('#btnRun'); await send('alpha'); await send('beta'); await send('quit'); await done();
  console.log(JSON.stringify(await out()));
  // 4. Stop while waiting for input
  await p.click('#btnClearOut');
  await setCode('#include <stdio.h>\nint main(void){ int x; printf("go: "); scanf("%d",&x); return 0; }');
  await p.click('#btnRun'); await p.waitForSelector('#inForm:not([hidden])'); await p.click('#btnStop'); await p.waitForTimeout(800);
  console.log('stopped ok, run button back:', await p.evaluate(() => !document.querySelector('#btnRun').hidden));
  console.log('errors', errs); await b.close();
})();
