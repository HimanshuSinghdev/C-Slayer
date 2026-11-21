// "Fix it": safe, rule-based quick fixes for the compiler's own messages. No guessing, no network.
// CC.fixit.suggest(src, diag) -> { title, why, edits: [{ line, from, to, text }] } or null
//   line is 1-based, from/to are 0-based columns on that line (from === to inserts); an edit with line = 0 inserts text as new first lines.
// CC.fixit.apply(src, edits) -> new source. Every suggestion is verified by the app (recompile) before it is kept.
(function (CC) {
  'use strict';

  const KNOWN = ('printf scanf puts putchar getchar fgets fputs fprintf sprintf snprintf sscanf fopen fclose fread fwrite fscanf fflush ' +
    'malloc calloc realloc free exit abs atoi atof atol strtol strtod rand srand qsort bsearch system ' +
    'strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr strtok memcpy memmove memset memcmp strdup ' +
    'sqrt pow sin cos tan atan atan2 exp log log10 floor ceil fabs round fmod ' +
    'toupper tolower isalpha isdigit isalnum isspace isupper islower time clock').split(' ');
  const HEADER_OF = { stdio: 1, stdlib: 1, string: 1, math: 1, ctype: 1, time: 1 };

  function lineText(lines, n) { return lines[n - 1] || ''; }

  // split "a, f(b, c), d" at top-level commas -> [{text, start, end}] (offsets inside the given string)
  function splitArgs(s) {
    const out = []; let depth = 0, start = 0, q = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) { out.push({ start, end: i }); start = i + 1; }
    }
    out.push({ start, end: s.length });
    return out;
  }

  // the argument list of the first call to `fn` on a line: { open, close } column of "(" and matching ")"
  function callSpan(text, fn) {
    const m = new RegExp('\\b' + fn + '\\s*\\(').exec(text); if (!m) return null;
    const open = m.index + m[0].length - 1; let depth = 0, q = '';
    for (let i = open; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(') depth++; else if (c === ')') { depth--; if (depth === 0) return { open, close: i }; }
    }
    return null;
  }

  const TYPE_SPEC = {
    'int': 'd', 'unsigned int': 'u', 'long int': 'ld', 'long unsigned int': 'lu', 'long long int': 'lld', 'long long unsigned int': 'llu',
    'short int': 'hd', 'char': 'c', 'double': 'f', 'float': 'f', 'char *': 's', 'const char *': 's', 'size_t': 'zu', 'long unsigned int ': 'zu'
  };

  function nearest(name) {
    let best = null, bd = 3;
    for (const k of KNOWN) {
      if (Math.abs(k.length - name.length) > 2) continue;
      const d = dist(name, k);
      if (d < bd) { bd = d; best = k; }
    }
    return bd <= 2 && best && name.length >= 4 ? best : null;
  }
  function dist(a, b) {
    const m = a.length, n = b.length, d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // swapped letters count once
    }
    return d[m][n];
  }

  function suggest(src, diag) {
    const lines = src.split('\n'), L = diag.line | 0, text = lineText(lines, L), msg = String(diag.msg || '');
    let m;

    // 1. missing semicolon: the compiler points just after the last token of the unfinished statement
    if ((m = /^expected ';' before/.exec(msg)) && L >= 1) {
      const col = Math.min(Math.max((diag.col | 0) - 1, 0), text.length);
      const before = text.slice(0, col);
      if (/[A-Za-z0-9_\])"'+\-]\s*$/.test(before) && !/;\s*$/.test(before) && !/^\s*#/.test(text))
        return { title: 'Add the missing ;', why: 'A C statement must end with a semicolon (;). The compiler found the next statement starting before this one was finished.', edits: [{ line: L, from: col, to: col, text: ';' }] };
    }

    // 2. missing #include
    if ((m = /did you forget #include <([a-z]+)\.h>/.exec(msg)) && HEADER_OF[m[1]]) {
      const inc = '#include <' + m[1] + '.h>';
      if (src.indexOf(inc) < 0) return { title: 'Add ' + inc, why: 'This function is declared in ' + m[1] + '.h, so the file has to include it at the top.', edits: [{ line: 0, from: 0, to: 0, text: inc + '\n' }] };
    }

    // 3. scanf("%d", n) -> scanf("%d", &n)
    if ((m = /format '%[^']*' expects argument of type '([a-z ]+) \*', but argument (\d+) has type '[a-z ]+'/.exec(msg)) && /\bscanf\s*\(/.test(text)) {
      const sp = callSpan(text, 'scanf'), idx = +m[2] - 1;
      if (sp) {
        const args = splitArgs(text.slice(sp.open + 1, sp.close)), a = args[idx];
        if (a) {
          const raw = text.slice(sp.open + 1 + a.start, sp.open + 1 + a.end), lead = raw.length - raw.trimStart().length, word = raw.trim();
          if (/^[A-Za-z_]\w*(\s*(\[[^\]]+\]|\.\s*[A-Za-z_]\w*))*$/.test(word) && word[0] !== '&')
            return { title: 'Add & before ' + word, why: 'scanf stores the value into a variable, so it needs the variable\'s address: &' + word + '.', edits: [{ line: L, from: sp.open + 1 + a.start + lead, to: sp.open + 1 + a.start + lead, text: '&' }] };
        }
      }
    }

    // 4. wrong printf conversion for the argument's type
    if ((m = /format '%([^']*)' expects argument of type '[^']*', but argument (\d+) has type '([^']*)'/.exec(msg)) && /\bprintf\s*\(/.test(text)) {
      const want = TYPE_SPEC[m[3].replace(/\s+/g, ' ').trim()], argNo = +m[2];
      const sp = callSpan(text, 'printf');
      if (want && sp) {
        const body = text.slice(sp.open + 1, sp.close), fmt = splitArgs(body)[0], fs = body.slice(fmt.start, fmt.end), base = sp.open + 1 + fmt.start;
        const re = /%([-+ #0]*\d*(?:\.\d+)?)(hh|h|ll|l|z|L)?([diouxXeEfgGcsp%])/g; let k = 0, mm;
        while ((mm = re.exec(fs))) {
          if (mm[3] === '%') continue;
          k++;
          if (k === argNo - 1) {
            if (mm[0] === '%' + mm[1] + want) return null;
            return { title: 'Change ' + mm[0] + ' to %' + want, why: 'The value is a ' + m[3] + ', so printf needs %' + want + ' to print it correctly.', edits: [{ line: L, from: base + mm.index, to: base + mm.index + mm[0].length, text: '%' + mm[1] + want }] };
          }
        }
      }
    }

    // 5. void main
    if (/return type of 'main' is not 'int'/.test(msg) && /\bvoid\s+main\b/.test(text)) {
      const i = text.search(/\bvoid\s+main\b/);
      return { title: 'Use int main', why: 'main must return an int (0 means success). void main only works by luck on some compilers.', edits: [{ line: L, from: i, to: i + text.slice(i).match(/^void\s+/)[0].length, text: 'int ' }] };
    }

    // 6. unused variable: remove a plain declaration line
    if ((m = /^unused variable '(\w+)'/.exec(msg))) {
      const re = new RegExp('^\\s*(?:const\\s+)?(?:unsigned\\s+|signed\\s+)?(?:long\\s+long|long|short|int|char|float|double)\\s+' + m[1] + '\\s*(?:=[^;,]*)?;\\s*(?://.*)?$');
      let ln = L; if (!re.test(lineText(lines, ln))) { ln = 0; for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { ln = i + 1; break; } }
      if (ln) return { title: 'Remove unused ' + m[1], why: 'The variable "' + m[1] + '" is declared but never used, so it can be deleted.', edits: [{ line: ln, from: 0, to: lines[ln - 1].length + 1, text: '' }] };
    }

    // 7. gets(s) -> fgets(s, sizeof(s), stdin)
    if (/'gets' function is dangerous/.test(msg)) {
      const sp = callSpan(text, 'gets');
      if (sp) {
        const arg = text.slice(sp.open + 1, sp.close).trim();
        if (/^[A-Za-z_]\w*$/.test(arg) && new RegExp('\\bchar\\s+' + arg + '\\s*\\[').test(src)) {
          const g = text.search(/\bgets\s*\(/);
          return { title: 'Use fgets instead of gets', why: 'gets() cannot limit how much is read and can overflow the array. fgets(' + arg + ', sizeof(' + arg + '), stdin) is safe.', edits: [{ line: L, from: g, to: sp.close + 1, text: 'fgets(' + arg + ', sizeof(' + arg + '), stdin)' }] };
        }
      }
    }

    // 8. if (a = b) -> if (a == b)
    if (/suggest parentheses around assignment used as truth value/.test(msg)) {
      const mm = /\b(if|while)\s*\(/.exec(text);
      if (mm) {
        const open = mm.index + mm[0].length - 1, sp = callSpan(text.slice(mm.index), mm[1]);
        if (sp) {
          const inner = text.slice(open + 1, mm.index + sp.close);
          const eq = /(^|[^=!<>])=(?!=)/.exec(inner);
          if (eq && !/[=!<>]=/.test(inner) && !/\(/.test(inner.slice(0, eq.index))) {
            const at = open + 1 + eq.index + eq[1].length;
            return { title: 'Use == to compare', why: 'A single = assigns a value. To check whether two values are equal, use ==.', edits: [{ line: L, from: at, to: at + 1, text: '==' }] };
          }
        }
      }
    }

    // 9. misspelled library function
    if ((m = /undefined reference to '(\w+)'/.exec(msg)) || (m = /implicit declaration of function '(\w+)'(?! ?; did)/.exec(msg))) {
      const good = nearest(m[1]);
      if (good && good !== m[1] && m[1] !== 'gets') {
        const i = text.search(new RegExp('\\b' + m[1] + '\\b'));
        if (i >= 0) return { title: 'Did you mean ' + good + '?', why: '"' + m[1] + '" does not exist. "' + good + '" is the closest function in the C library.', edits: [{ line: L, from: i, to: i + m[1].length, text: good }] };
      }
    }
    return null;
  }

  function apply(src, edits) {
    let lines = src.split('\n');
    const top = edits.filter((e) => e.line === 0), rest = edits.filter((e) => e.line > 0).sort((a, b) => b.line - a.line || b.from - a.from);
    for (const e of rest) {
      const l = lines[e.line - 1] === undefined ? '' : lines[e.line - 1];
      if (e.to > l.length && e.line < lines.length) {       // removing a whole line (the newline is part of the edit)
        lines.splice(e.line - 1, 1);
      } else lines[e.line - 1] = l.slice(0, e.from) + e.text + l.slice(e.to);
    }
    let out = lines.join('\n');
    if (top.length) {
      // put new #includes after the last existing #include (or at the very top)
      const ls = out.split('\n'); let at = 0;
      ls.forEach((x, i) => { if (/^\s*#\s*include\b/.test(x)) at = i + 1; });
      ls.splice(at, 0, ...top.map((e) => e.text.replace(/\n$/, '')));
      out = ls.join('\n');
    }
    return out;
  }

  CC.fixit = { suggest, apply };
  if (typeof module !== 'undefined') module.exports = CC.fixit;
})(typeof CC !== 'undefined' ? CC : (typeof self !== 'undefined' ? (self.CC = self.CC || {}) : {}));
