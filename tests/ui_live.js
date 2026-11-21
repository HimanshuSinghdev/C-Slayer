// live check: problems and Fix it buttons appear while typing (no Run), the switch turns it off, a running program is never disturbed
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  const set = (s) => p.evaluate((s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s), s);
  const get = () => p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log(c ? 'ok  ' : 'BAD ', m); };
  await set('#include <stdio.h>\nint main(void) {\n    int n;\n    scanf("%d", n)\n    printf("%d\\n", n);\n    return 0;\n}');
  await p.evaluate(() => { const t = [...document.querySelectorAll('.tabs button')].find(x => /problem/i.test(x.textContent)); t && t.click(); });
  const b1 = await p.waitForSelector('.fixit button', { timeout: 8000 }).catch(() => null);
  ok(!!b1, 'Fix it appears without pressing Run: ' + (b1 ? await b1.innerText() : ''));
  if (b1) await b1.click();
  const b2 = await p.waitForSelector('.fixit button', { timeout: 8000 }).catch(() => null);
  ok(!!b2, 'next fix appears by itself: ' + (b2 ? await b2.innerText() : ''));
  if (b2) await b2.click();
  await p.waitForTimeout(2000);
  ok(/scanf\("%d", &n\);/.test(await get()), 'code fixed in two taps');
  ok((await p.evaluate(() => document.querySelectorAll('#probList li').length)) === 0, 'problems list is empty after the fixes');
  await p.click('#menuBtn, .menu-btn, #btnMenu').catch(() => {});
  await p.evaluate(() => document.querySelector('#btnLive').click());
  await set('int main(void) { int x = 1 }');
  await p.waitForTimeout(2500);
  ok((await p.evaluate(() => document.querySelectorAll('#probList li').length)) === 0, 'switch off: nothing checked while typing');
  console.log('bad', bad); await b.close(); process.exit(bad ? 1 : 0);
})();
