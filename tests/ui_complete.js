// helper (autocomplete) check: what each pick produces in common spots
const { chromium } = require('playwright');
const CASES = [
  // [doc before cursor, word picked, expected full text after pick]
  ['#include <stdio.h>\n\nma', 'main', '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}'],
  ['#include <stdio.h>\n\nint ma', 'main', '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}'],
  ['int main(void) {\n    ret', 'return', 'int main(void) {\n    return 0;'],
  ['int main(void) {\n    int n;\n    scanf', 'scanf', 'int main(void) {\n    int n;\n    scanf("%d", &);'],
  ['int main(void) {\n    int n;\n    if (n) scanf', 'scanf', 'int main(void) {\n    int n;\n    if (n) scanf("%d", &);'],
  ['int main(void) {\n    int n;\n    switch (n) {\n    case 1: scanf', 'scanf', 'int main(void) {\n    int n;\n    switch (n) {\n    case 1: scanf("%d", &);'],
  ['int main(void) {\n    int n;\n    if (scanf', 'scanf', 'int main(void) {\n    int n;\n    if (scanf("%d", &)'],
  ['int main(void) {\n    int n = ato', 'atoi', 'int main(void) {\n    int n = atoi()'],
  ['int main(void) {\n    for (int i = 0; pri', 'printf', null],
  ['int main(void) {\n    while (1) {\n        bre', 'break', 'int main(void) {\n    while (1) {\n        break;'],
  ['int main(void) {\n    if (1) {\n    } els', 'else', null],
  ['int main(void) {\n    pri', 'printf', 'int main(void) {\n    printf("\\n");']
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  let bad = 0;
  for (const [doc, word, want] of CASES) {
    const got = await p.evaluate(({ doc, word }) => {
      const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(doc); cm.focus();
      cm.setCursor({ line: cm.lineCount() - 1, ch: cm.getLine(cm.lineCount() - 1).length });
      window.CSlayerComplete.ctrlSpace(cm);
      const a = cm.state.completionActive; if (!a || !a.data) return { none: true };
      const i = a.data.list.findIndex((x) => x.text === word); if (i < 0) return { none: true, have: a.data.list.map((x) => x.text) };
      a.pick(a.data, i); return { text: cm.getValue() };
    }, { doc, word });
    const ok = want === null ? true : got.text === want;
    if (want !== null && !ok) bad++;
    console.log(ok ? 'ok  ' : 'BAD ', JSON.stringify(doc.slice(-30)), '→', got.none ? 'no hint ' + JSON.stringify(got.have || '') : JSON.stringify(got.text.slice(-45)));
  }
  console.log('bad', bad); await b.close();
})();
