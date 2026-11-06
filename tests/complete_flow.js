const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
  const cm = (f, a) => p.evaluate(([f, a]) => { const c = document.querySelector('.CodeMirror').CodeMirror; return c[f](...a); }, [f, a || []]);
  await cm('setValue', ['']); await cm('focus');
  const T = async (s) => { await p.keyboard.type(s, { delay: 25 }); await p.waitForTimeout(220); };
  const enter = async () => { await p.keyboard.press('Enter'); await p.waitForTimeout(120); };
  await T('inc'); await enter(); await T('stdio'); await enter();   // #include <stdio.h>
  await p.keyboard.press('End'); await p.keyboard.press('Enter');
  await T('ma'); await enter();                                       // int main
  await T('printf'); await enter(); await T('Hello'); await p.keyboard.press('End'); await p.keyboard.press('Enter');
  await T('for'); await enter(); await T('3'); await p.keyboard.press('ArrowDown');
  console.log(JSON.stringify(await cm('getValue')));
  console.log('cursor', JSON.stringify(await cm('getCursor')));
  await p.click('#btnRun'); await p.waitForFunction(() => /exited|error|rror/.test(document.querySelector('#out').textContent), null, { timeout: 8000 });
  console.log(JSON.stringify(await p.textContent('#out')));
  console.log(errs); await b.close();
})();
