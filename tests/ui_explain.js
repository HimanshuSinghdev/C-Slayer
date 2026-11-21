// Explain line: the card follows the cursor, English and Hinglish, and the switch/close button turn it off
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1200);
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'BAD ', m); };
  await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\nint main(void) {\n    int n = 5;\n    for (int i = 0; i < n; i++) {\n        printf("%d\\n", i);\n    }\n    return 0;\n}'));
  const at = (l) => p.evaluate((l) => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.focus(); cm.setCursor(l, 2); }, l);
  const card = () => p.evaluate(() => { const c = document.querySelector('.lcard'); return c.hidden ? null : c.innerText.replace(/\s+/g, ' '); });
  ok((await card()) === null, 'off by default');
  await p.evaluate(() => document.querySelector('#btnExplain').click()); await p.waitForTimeout(300);
  await at(1); await p.waitForTimeout(400); let c = await card(); ok(/main function/.test(c || ''), 'line 2 → ' + (c || '').slice(0, 60));
  await at(3); await p.waitForTimeout(400); c = await card(); ok(/counting loop/.test(c || '') && /i < n/.test(c || ''), 'for loop → ' + (c || '').slice(0, 70));
  await at(4); await p.waitForTimeout(400); c = await card(); ok(/Prints/.test(c || '') && /whole number/.test(c || ''), 'printf → ' + (c || '').slice(0, 70));
  await p.evaluate(() => { window.CC.lang = 'hi'; }); await at(2); await p.waitForTimeout(400); c = await card(); ok(/variable|Variable/.test(c || '') && /rakhte|banata/.test(c || ''), 'Hinglish → ' + (c || '').slice(0, 70));
  await p.evaluate(() => { window.CC.lang = 'en'; document.querySelector('.lcard button').click(); }); await p.waitForTimeout(200);
  ok((await card()) === null, 'close button turns it off');
  console.log('bad', bad); await b.close(); process.exit(bad ? 1 : 0);
})();
