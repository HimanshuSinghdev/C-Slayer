const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  const val = () => p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  const reset = async () => { await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('')); await p.click('.CodeMirror-scroll'); await p.waitForTimeout(300); };
  const ins = async (t) => { for (const ch of t) { if (ch === '\n') await p.keyboard.press('Enter'); else await p.keyboard.insertText(ch); await p.waitForTimeout(150); } };
  const T = async (name, typed, want) => { await reset(); await ins(typed); await p.waitForTimeout(250); const v = await val(); console.log(v === want ? 'ok  ' : 'FAIL', name, JSON.stringify(v), v === want ? '' : 'want ' + JSON.stringify(want)); };
  await T('paren', '(', '()');
  await T('printf', 'printf("hi")', 'printf("hi")');
  await T('brace-enter', 'int main(){\n', 'int main(){\n    \n}');
  await T('arr', 'a[0]', 'a[0]');
  await T('char', "c='x';", "c='x';");
  await T('nested', 'f(g(1))', 'f(g(1))');
  await T('apostrophe', "don't", "don't");
  await reset(); await ins('(('); await p.keyboard.press('Backspace'); console.log('bksp', JSON.stringify(await val()));
  await reset(); await p.click('#keys button[aria-label="("]'); await p.click('#keys button[aria-label=")"]'); console.log('bar ()', JSON.stringify(await val()));
  await reset(); await p.click('#keys button[aria-label="{"]'); console.log('bar {', JSON.stringify(await val()));
  // keyboard simulation: shrink visual viewport isn't possible; check the bar is within viewport
  const r = await p.locator('#keys').boundingBox(); console.log('keys bar bottom', r.y + r.height, 'of', 700);
  console.log('errors', errs); await b.close();
})();
