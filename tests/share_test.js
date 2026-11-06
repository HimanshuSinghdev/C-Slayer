const { chromium } = require('playwright'); const zlib = require('zlib');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 420, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  const code = '#include <stdio.h>\n// नमस्ते — unicode ✓\nint main(void){ printf("hi\\n"); return 0; }\n';
  await p.evaluate(c => document.querySelector('.CodeMirror').CodeMirror.setValue(c), code);
  await p.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) { } });
  await p.click('#btnShare'); await p.waitForTimeout(500);
  const link = await p.evaluate(() => navigator.clipboard.readText()); console.log('link', link.length, link.slice(0, 60));
  const q = await ctx.newPage(); q.on('pageerror', e => errs.push(String(e))); q.on('dialog', d => d.accept());
  await q.goto(link); await q.waitForTimeout(1200);
  const got = await q.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  console.log('round trip equal:', got === code, '| hash cleared:', await q.evaluate(() => location.hash === ''), '| files:', await q.evaluate(() => [...document.querySelectorAll('#fileSel option')].map(o => o.textContent)));
  // hostile links must fail quietly
  const bomb = 'z' + zlib.deflateRawSync(Buffer.alloc(20 * 1024 * 1024)).toString('base64url');
  for (const [nm, h] of [['garbage', '#s=zAAAA'], ['bomb', '#s=' + bomb], ['badjson', '#s=p' + Buffer.from('not json').toString('base64url')], ['html', '#s=p' + Buffer.from(JSON.stringify({ v: 1, n: '<img src=x onerror=alert(1)>.c', c: 'x' })).toString('base64url')]]) {
    const r = await ctx.newPage(); r.on('pageerror', e => errs.push(nm + ' ' + e)); let dlg = 0; r.on('dialog', d => { dlg++; d.accept(); });
    await r.goto('http://localhost:8765/index.html' + h); await r.waitForTimeout(1500);
    console.log(nm, 'toast:', JSON.stringify(await r.evaluate(() => document.querySelector('#toast').textContent)), 'dialogs', dlg, 'names', await r.evaluate(() => [...document.querySelectorAll('#fileSel option')].map(o => o.textContent)));
    await r.close();
  }
  console.log('errors', errs); await b.close();
})();
