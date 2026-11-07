// Pushing a change to a served file must reach an already-installed app with no cache-name bump and no data clearing.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('int main(){return 7;}'));
  await p.waitForTimeout(800);
  const marker = 'window.__upd_test = 1;';
  const f = 'js/explain_hi.js', orig = fs.readFileSync(f, 'utf8');
  let ok = true;
  try {
    fs.writeFileSync(f, orig + '\n' + marker + '\n');
    await new Promise(r => setTimeout(r, 1100));          // different Last-Modified second
    fs.utimesSync(f, new Date(), new Date());
    // simulate coming back to the app
    const nav = p.waitForNavigation({ timeout: 8000 }).catch(() => null);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await nav; await p.waitForTimeout(1500);
    const got = await p.evaluate(() => window.__upd_test === 1);
    const code = await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
    console.log('new file served after update:', got, '| code kept:', code.includes('return 7'));
    ok = got && code.includes('return 7');
    // offline still works
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(1000);
    const off = await p.evaluate(() => !!document.querySelector('.CodeMirror')); console.log('offline loads:', off); ok = ok && off;
  } finally { fs.writeFileSync(f, orig); }
  await b.close(); process.exit(ok ? 0 : 1);
})();
