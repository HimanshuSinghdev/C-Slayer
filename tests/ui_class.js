const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 393, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); let prompts = [];
  p.on('dialog', d => { if (d.type() === 'prompt') { d.accept(prompts.shift() || 'Asha'); } else d.accept(); });
  const links = [];
  await p.addInitScript(() => { window.__cb = []; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__cb.push(t); return Promise.resolve(); } }, configurable: true }); });
  for (const [name, code] of [['Asha', 'int main(void){return 0;}'], ['<img src=x onerror=alert(1)>', '#include <stdio.h>\nint main(void){printf("hi\\n");return 0;}']]) {
    prompts = [name];
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
    await p.selectOption('#samples', 'p0'); await p.waitForTimeout(200);
    await p.evaluate((c) => document.querySelector('.CodeMirror').CodeMirror.setValue(c), code);
    await p.click('#btnScore'); await p.waitForTimeout(2500); await p.click('[role=tab]:has-text("Score")'); await p.waitForTimeout(400);
    await p.click('.score button:has-text("Send result")'); await p.waitForTimeout(600);
    links.push(await p.evaluate(() => window.__cb[0]));
  }
  console.log('links', links.map(l => l && l.length));
  const t = await ctx.newPage(); t.on('pageerror', e => errs.push(e.message)); t.on('dialog', d => { errs.push('DIALOG ' + d.message()); d.dismiss(); });
  await t.goto('http://localhost:8765/' + links[0].replace(/^.*\/class\.html/, 'class.html')); await t.waitForTimeout(800);
  await t.fill('#paste', links[1].replace(/^.*\/class\.html/, 'http://x/class.html') + '\n' + links[0]); await t.click('#add'); await t.waitForTimeout(500);
  const rowsN = await t.locator('#tbl tbody tr').count(); const msg = await t.textContent('#msg');
  await t.click('#tbl tbody tr >> nth=0'); await t.waitForTimeout(200);
  const code = await t.textContent('#dCode'); const ov = await t.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const [dl] = await Promise.all([t.waitForEvent('download'), t.click('#csv')]);
  const csv = require('fs').readFileSync(await dl.path(), 'utf8');
  await t.screenshot({ path: '/tmp/class.png' });
  console.log('rows', rowsN, '|', msg, '| code shown', code.length > 5, '| hscroll', ov, '| csv lines', csv.trim().split('\n').length, 'errs', errs);
  await b.close(); process.exit(rowsN === 2 && !errs.length && csv.trim().split('\n').length === 3 ? 0 : 1);
})();
