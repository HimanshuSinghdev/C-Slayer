// Emulated Android phones (touch, mobile UA, real viewport + DPR): run a program, format, debug, memory picture, no page errors, no sideways scroll.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const name of ['Galaxy S8', 'Pixel 5', 'Galaxy Tab S4']) {
    const ctx = await b.newContext({ ...devices[name] }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
    const fails = [];
    await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('#include <stdio.h>\nint main(){int s=0;for(int i=1;i<=10;i++)s+=i;printf("sum=%d\\n",s);return 0;}'));
    await p.tap('#btnRun'); await p.waitForTimeout(1500);
    const out = await p.evaluate(() => document.querySelector('#out').innerText);
    if (!/sum=55/.test(out)) fails.push('run output missing');
    await p.tap('#btnFormat').catch(() => fails.push('format tap failed')); await p.waitForTimeout(300);
    await p.tap('#btnMore').catch(() => fails.push('menu tap failed')); await p.waitForTimeout(150);
    const geo = await p.evaluate(() => ({ h: document.documentElement.scrollWidth > innerWidth, m: (() => { const r = document.querySelector('#moreMenu').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; })() }));
    if (geo.h) fails.push('sideways scroll'); if (!geo.m) fails.push('menu off-screen');
    const manifest = await p.evaluate(() => !!document.querySelector('link[rel=manifest]')), sw = await p.evaluate(() => 'serviceWorker' in navigator);
    if (!manifest || !sw) fails.push('pwa pieces missing');
    await p.screenshot({ path: `/tmp/phone_${name.replace(/ /g, '')}.png` });
    if (errs.length) fails.push('errors: ' + errs.slice(0, 2).join(' | '));
    console.log(name, `${devices[name].viewport.width}x${devices[name].viewport.height}`, fails.length ? fails : 'ok'); bad += fails.length;
    await ctx.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
