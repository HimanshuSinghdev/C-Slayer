const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 700 } });
  p.on('console', m => console.log('  [page]', m.text())); await p.goto('http://localhost:8765/'); await p.waitForTimeout(800);
  const val = () => p.evaluate(() => JSON.stringify(document.querySelector('.CodeMirror').CodeMirror.getValue()));
  await p.evaluate(() => { const c = document.querySelector('.CodeMirror').CodeMirror; c.on('inputRead', (c, ch) => console.log('inputRead', JSON.stringify(ch.text), ch.origin)); c.on('change', (c, ch) => console.log('change', JSON.stringify(ch.text), ch.origin)); });
  for (const text of ['int main(){\n', '((']) {
    await p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('')); await p.click('.CodeMirror-scroll'); await p.waitForTimeout(300);
    for (const ch of text) { if (ch === '\n') await p.keyboard.press('Enter'); else await p.keyboard.insertText(ch); await p.waitForTimeout(120); console.log(JSON.stringify(ch), await val()); }
  }
  await p.keyboard.press('Backspace'); await p.waitForTimeout(200); console.log('after bksp', await val()); await b.close();
})();
