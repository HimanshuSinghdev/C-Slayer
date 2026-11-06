const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const src = fs.readFileSync('js/complete.js', 'utf8').replace('window.CSlayerComplete = {', 'window.__D = { FUNCS, SNIPPETS, KEYWORDS }; window.__G = getHints; window.CSlayerComplete = {');
  await p.route('**/js/complete.js*', r => r.fulfill({ contentType: 'application/javascript', body: src }));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1000);
  const D = await p.evaluate(() => ({ F: window.__D.FUNCS.map(x => x.slice(0, 3)), S: window.__D.SNIPPETS.map(x => x.slice(0, 3)) }));
  const setDoc = (t) => p.evaluate(t => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(t); cm.focus(); cm.setCursor(cm.lineCount() - 1, cm.getLine(cm.lastLine()).length); }, t);
  const getDoc = () => p.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  const hintTexts = () => p.evaluate(() => [...document.querySelectorAll('.CodeMirror-hints li')].map(e => e.textContent));
  const issues = [];
  // 1. every snippet: type its name minus last char, expect it offered, accept with Enter, check the text compiles
  for (const [n, d, t] of D.S) {
    const pre = '#include <stdio.h>\n#include <stdlib.h>\n' + (n === 'main' ? '' : 'int main(void) {\n    ');
    await setDoc(pre); await p.keyboard.type(n.slice(0, Math.max(2, n.length - 1)), { delay: 30 }); await p.waitForTimeout(250);
    const hs = await hintTexts();
    if (!hs.some(h => h.startsWith(n))) { issues.push(`snippet "${n}": not offered while typing "${n.slice(0, Math.max(2, n.length - 1))}" -> ${JSON.stringify(hs)}`); continue; }
    // select the right entry
    const idx = hs.findIndex(h => h.startsWith(n)); for (let i = 0; i < idx; i++) await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    let doc = await getDoc(); if (n !== 'main' && n !== 'func' && n !== 'struct' && n !== 'inc') doc += '\n    return 0;\n}\n';
    console.log('--- ' + n + '\n' + (await getDoc()).split('\n').slice(n === 'main' ? 2 : 3).join('\n'));
  }
  // 2. typing the whole word then Ctrl+Space (what happens when you finish a keyword)
  for (const w of ['for', 'while', 'if', 'main', 'switch', 'do']) {
    await setDoc('int main(void) {\n    '); await p.keyboard.type(w, { delay: 30 }); await p.waitForTimeout(250);
    const hs = await hintTexts(); if (!hs.length) issues.push(`full word "${w}": no suggestion offered`);
  }
  console.log('\nISSUES\n' + (issues.join('\n') || 'none'), errs);
  await b.close();
})();
