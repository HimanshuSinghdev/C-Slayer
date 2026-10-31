/* C-Slayer · editor assistance: auto-complete with whole-line snippets. Pure data + CodeMirror hooks; no eval. */
(function () {
  'use strict';
  const HEADERS = ['stdio.h', 'stdlib.h', 'string.h', 'math.h', 'ctype.h', 'stdbool.h', 'stdint.h', 'limits.h', 'time.h', 'assert.h', 'float.h', 'errno.h', 'stddef.h', 'stdarg.h', 'unistd.h', 'strings.h'];
  const KEYWORDS = ['int', 'char', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'void', 'const', 'static', 'struct', 'union', 'enum', 'typedef', 'sizeof', 'return', 'break', 'continue', 'switch', 'case', 'default', 'goto', 'else', 'if', 'for', 'while', 'do', 'NULL', 'bool', 'true', 'false', 'size_t'];
  // [name, signature shown in the list, text inserted (| = cursor)]
  const FUNCS = [
    ['printf', 'printf("…")', 'printf("|\\n");'], ['scanf', 'scanf("%d", &x)', 'scanf("%d", &|);'], ['puts', 'puts(str)', 'puts(|);'], ['putchar', 'putchar(c)', 'putchar(|);'],
    ['getchar', 'getchar()', 'getchar()'], ['fgets', 'fgets(buf, size, stdin)', 'fgets(|, sizeof(buf), stdin);'], ['sprintf', 'sprintf(buf, "…")', 'sprintf(|);'], ['snprintf', 'snprintf(buf, n, "…")', 'snprintf(|);'],
    ['fprintf', 'fprintf(fp, "…")', 'fprintf(|);'], ['fscanf', 'fscanf(fp, "…")', 'fscanf(|);'], ['fopen', 'fopen(name, mode)', 'FILE *fp = fopen("|", "r");'], ['fclose', 'fclose(fp)', 'fclose(|);'],
    ['malloc', 'malloc(size)', 'malloc(|)'], ['calloc', 'calloc(n, size)', 'calloc(|)'], ['realloc', 'realloc(p, size)', 'realloc(|)'], ['free', 'free(p)', 'free(|);'],
    ['strlen', 'strlen(s)', 'strlen(|)'], ['strcpy', 'strcpy(dst, src)', 'strcpy(|);'], ['strncpy', 'strncpy(dst, src, n)', 'strncpy(|);'], ['strcmp', 'strcmp(a, b)', 'strcmp(|)'], ['strcat', 'strcat(dst, src)', 'strcat(|);'],
    ['strchr', 'strchr(s, c)', 'strchr(|)'], ['strstr', 'strstr(s, sub)', 'strstr(|)'], ['memcpy', 'memcpy(dst, src, n)', 'memcpy(|);'], ['memset', 'memset(p, v, n)', 'memset(|);'],
    ['atoi', 'atoi(s)', 'atoi(|)'], ['atof', 'atof(s)', 'atof(|)'], ['strtol', 'strtol(s, &end, base)', 'strtol(|)'], ['abs', 'abs(x)', 'abs(|)'], ['rand', 'rand()', 'rand()'], ['srand', 'srand(seed)', 'srand(|);'], ['exit', 'exit(code)', 'exit(|);'],
    ['qsort', 'qsort(base, n, size, cmp)', 'qsort(|);'], ['sqrt', 'sqrt(x)', 'sqrt(|)'], ['pow', 'pow(x, y)', 'pow(|)'], ['fabs', 'fabs(x)', 'fabs(|)'], ['floor', 'floor(x)', 'floor(|)'], ['ceil', 'ceil(x)', 'ceil(|)'],
    ['isalpha', 'isalpha(c)', 'isalpha(|)'], ['isdigit', 'isdigit(c)', 'isdigit(|)'], ['toupper', 'toupper(c)', 'toupper(|)'], ['tolower', 'tolower(c)', 'tolower(|)'], ['time', 'time(NULL)', 'time(NULL)'], ['assert', 'assert(cond)', 'assert(|);']
  ];
  // whole-line templates: the word typed is the trigger
  const SNIPPETS = [
    ['main', 'int main(void) { … }', 'int main(void) {\n    |\n    return 0;\n}'],
    ['for', 'for loop', 'for (int i = 0; i < |; i++) {\n    \n}'],
    ['while', 'while loop', 'while (|) {\n    \n}'],
    ['do', 'do … while', 'do {\n    |\n} while ();'],
    ['if', 'if', 'if (|) {\n    \n}'],
    ['ifelse', 'if / else', 'if (|) {\n    \n} else {\n    \n}'],
    ['switch', 'switch', 'switch (|) {\n    case 0:\n        break;\n    default:\n        break;\n}'],
    ['struct', 'struct definition', 'typedef struct {\n    |\n} Name;'],
    ['func', 'function', 'int name(int a) {\n    |\n    return 0;\n}'],
    ['inc', '#include <stdio.h>', '#include <|.h>'],
    ['array', 'int array[n]', 'int arr[|];'],
    ['readint', 'read an int', 'int n;\nif (scanf("%d", &n) != 1) {\n    |return 1;\n}'],
    ['mallocchk', 'malloc + NULL check', 'int *p = malloc(| * sizeof *p);\nif (p == NULL) {\n    return 1;\n}'],
    ['fileread', 'open file safely', 'FILE *fp = fopen("|", "r");\nif (fp == NULL) {\n    return 1;\n}']
  ];

  function wordAt(cm) {
    const cur = cm.getCursor(), line = cm.getLine(cur.line);
    let s = cur.ch; while (s > 0 && /\w/.test(line.charAt(s - 1))) s--;
    return { word: line.slice(s, cur.ch), from: CodeMirror.Pos(cur.line, s), to: cur, before: line.slice(0, s) };
  }
  function docWords(cm, exclude) {
    const seen = new Set(), out = [];
    const re = /[A-Za-z_]\w{2,}/g; const text = cm.getValue();
    let m, guard = 0;
    while ((m = re.exec(text)) && guard++ < 20000) { const w = m[0]; if (w !== exclude && !seen.has(w)) { seen.add(w); out.push(w); } }
    return out;
  }
  function insertTemplate(cm, tpl, from, to) {
    const MARK = '\u2063';
    const text = tpl.replace('|', MARK);
    cm.operation(() => {
      cm.replaceRange(text, from, to);
      const lastLine = from.line + text.split('\n').length - 1;
      for (let l = from.line + 1; l <= lastLine; l++) cm.indentLine(l, 'smart');
      for (let l = from.line; l <= lastLine; l++) {
        const i = cm.getLine(l).indexOf(MARK);
        if (i >= 0) { cm.replaceRange('', { line: l, ch: i }, { line: l, ch: i + 1 }); cm.setCursor({ line: l, ch: i }); return; }
      }
      cm.setCursor({ line: lastLine, ch: cm.getLine(lastLine).length });
    });
  }
  function snippetItem(label, detail, tpl, cls) {
    return { text: label, displayText: label + '  —  ' + detail, className: cls, render(el, self, data) { const a = document.createElement('b'); a.textContent = label; const b = document.createElement('span'); b.textContent = '  ' + detail; el.append(a, b); }, hint(cm, data, c) { insertTemplate(cm, tpl, c.from || data.from, c.to || data.to); } };
  }

  function getHints(cm) {
    const w = wordAt(cm);
    // #include <…>
    const inc = /^\s*#\s*include\s*<(\w*\.?\w*)$/.exec(cm.getLine(w.from.line).slice(0, cm.getCursor().ch));
    if (inc) {
      const start = CodeMirror.Pos(w.from.line, cm.getCursor().ch - inc[1].length);
      const list = HEADERS.filter(h => h.indexOf(inc[1]) === 0).map(h => ({ text: h + '>', displayText: h, className: 'hint-hdr' }));
      return list.length ? { list, from: start, to: cm.getCursor() } : null;
    }
    const tok = cm.getTokenAt(cm.getCursor());
    if (tok.type && /comment|string/.test(tok.type)) return null;
    if (/^\s*#/.test(cm.getLine(w.from.line))) return null;
    if (w.word.length < 2 || /^\d/.test(w.word)) return null;
    if (/[.>]$/.test(w.before.trimEnd().slice(-2)) && /(\.|->)\s*$/.test(w.before)) return null;     // member access: unknown field names
    const lw = w.word.toLowerCase();
    const list = [], used = new Set();
    const add = (it, key) => { if (!used.has(key) && list.length < 9) { used.add(key); list.push(it); } };
    for (const [n, d, t] of SNIPPETS) if (n.indexOf(lw) === 0 && n !== w.word + '#') add(snippetItem(n, d, t, 'hint-snip'), n);
    for (const [n, d, t] of FUNCS) if (n.indexOf(lw) === 0) add(snippetItem(n, d, t, 'hint-fn'), n);
    for (const k of KEYWORDS) if (k.indexOf(lw) === 0 && k !== w.word) add({ text: k, displayText: k, className: 'hint-kw' }, k);
    for (const d of docWords(cm, w.word)) if (d.toLowerCase().indexOf(lw) === 0) add({ text: d, displayText: d, className: 'hint-id' }, 'd' + d);
    if (!list.length) return null;
    if (list.length === 1 && list[0].text === w.word) return null;
    return { list, from: w.from, to: w.to };
  }

  window.CSlayerComplete = {
    attach(cm) {
      // 'changes' fires for every input path (desktop keys and Android/IME text, which never fires 'inputRead')
      cm.on('changes', (c, list) => {
        const ch = list[list.length - 1];
        if (!ch || ch.origin !== '+input' || c.state.completionActive) return;
        const t = ch.text && ch.text[0];
        if (!t || !(/[\w<]/.test(t))) return;
        clearTimeout(c._hintT);
        c._hintT = setTimeout(() => { if (!c.state.completionActive && c.hasFocus()) c.showHint({ hint: getHints, completeSingle: false, closeOnUnfocus: true, alignWithWord: true }); }, 60);
      });
    },
    ctrlSpace(cm) { cm.showHint({ hint: getHints, completeSingle: false, alignWithWord: true }); }
  };
})();
