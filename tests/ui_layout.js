// No toolbar control may overlap another, overflow the screen, or be smaller than a finger target.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [w, theme] of [[320, 'slate'], [360, 'paper'], [393, 'slate'], [412, 'paper'], [600, 'slate'], [900, 'paper']]) {
    const p = await b.newPage({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2 });
    await p.addInitScript((t) => { try { localStorage.setItem('cs.theme', JSON.stringify(t)); } catch (e) {} }, theme);
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const rows = ['header .btn, header .brand', 'nav.files > :not(.menu):not(input)', '.conrow > *'];
      const out = [];
      for (const sel of rows) {
        const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null && !e.hidden);
        const bx = els.map(e => ({ id: e.id || e.className, r: e.getBoundingClientRect() }));
        for (let i = 0; i < bx.length; i++) {
          const a = bx[i].r; if (a.right > innerWidth + 0.5 || a.left < -0.5) out.push('offscreen ' + bx[i].id);
          if (sel !== 'header .btn, header .brand' && (a.height < 38 || a.width < 38) && els[i].tagName !== 'SELECT') out.push('small ' + bx[i].id + ' ' + Math.round(a.width) + 'x' + Math.round(a.height));
          for (let j = i + 1; j < bx.length; j++) { const c = bx[j].r; if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5) out.push('overlap ' + bx[i].id + ' / ' + bx[j].id); }
        }
      }
      if (document.documentElement.scrollWidth > innerWidth) out.push('hscroll');
      return out;
    });
    await p.click('#btnMore'); await p.waitForTimeout(100);
    const m = await p.evaluate(() => { const r = document.querySelector('#moreMenu').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 && r.bottom <= innerHeight; });
    if (!m) r.push('menu off-screen');
    if (w === 393 || w === 320) await p.screenshot({ path: '/tmp/lay' + w + '.png' });
    console.log(w, theme, r.length ? r : 'ok'); bad += r.length;
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
