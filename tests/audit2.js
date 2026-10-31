const { chromium } = require('playwright');
const D = '/tmp/claude-0/-home-claude/52ff6d1a-1253-58bd-a4b7-382c2ea5656c/scratchpad/';
(async () => {
  const b = await chromium.launch();
  let p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  await p.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue('int main(void){\n  pri'); cm.focus(); cm.setCursor({ line: 1, ch: 5 }); });
  await p.click('.CodeMirror-scroll', { position: { x: 300, y: 300 } });
  await p.evaluate(() => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setCursor({ line: 1, ch: 5 }); cm.execCommand('goLineEnd'); });
  await p.keyboard.insertText('n'); await p.waitForTimeout(900);
  await p.screenshot({ path: D + 'au-popup.png' });
  await p.close();
  p = await b.newPage({ viewport: { width: 780, height: 390 }, deviceScaleFactor: 1.5 });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  await p.screenshot({ path: D + 'au-land.png' });
  await b.close();
})();
