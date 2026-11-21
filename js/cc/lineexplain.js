// "Explain this line": plain-words meaning of one line of C, English and Hinglish. Rule based, offline, no guessing about logic.
// CC.explainLine(lineText, lang) -> { title, text } or null for blank lines.
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const T = '(?:unsigned\\s+|signed\\s+|const\\s+|static\\s+)*(?:long\\s+long|long|short|int|char|float|double|void|size_t|FILE|bool|[A-Z]\\w*_t)';
  const TYPES = {
    int: ['a whole number (int)', 'poora number (int)'], float: ['a decimal number (float)', 'decimal number (float)'],
    double: ['a decimal number with more precision (double)', 'zyada precision wala decimal number (double)'],
    char: ['one character (char)', 'ek character (char)'], long: ['a big whole number (long)', 'bada poora number (long)'],
    'long long': ['a very big whole number (long long)', 'bahut bada poora number (long long)'], short: ['a small whole number (short)', 'chhota poora number (short)']
  };
  const FMT = {
    d: ['a whole number', 'poora number'], i: ['a whole number', 'poora number'], u: ['a positive whole number', 'positive poora number'],
    ld: ['a long number', 'long number'], lld: ['a very big whole number', 'bahut bada number'], lu: ['a long positive number', 'long positive number'],
    llu: ['a very big positive number', 'bahut bada positive number'], f: ['a decimal number', 'decimal number'], lf: ['a double decimal number', 'double decimal number'],
    c: ['one character', 'ek character'], s: ['a word / text (string)', 'ek word / text (string)'], x: ['a number in hexadecimal', 'hexadecimal number'], p: ['a memory address', 'memory address'],
    zu: ['a size', 'size'], e: ['a number in scientific form', 'scientific form wala number'], g: ['a decimal number', 'decimal number']
  };
  const HDR = {
    'stdio.h': ['input and output: printf, scanf, fopen…', 'input aur output: printf, scanf, fopen…'],
    'stdlib.h': ['general tools: malloc, free, rand, atoi, exit…', 'general tools: malloc, free, rand, atoi, exit…'],
    'string.h': ['text (string) functions: strlen, strcpy, strcmp…', 'string functions: strlen, strcpy, strcmp…'],
    'math.h': ['maths functions: sqrt, pow, sin, floor…', 'maths functions: sqrt, pow, sin, floor…'],
    'ctype.h': ['character checks: isalpha, isdigit, toupper…', 'character checks: isalpha, isdigit, toupper…'],
    'time.h': ['time functions: time, clock…', 'time functions: time, clock…'],
    'stdbool.h': ['true / false values (bool)', 'true / false values (bool)'], 'limits.h': ['limits like INT_MAX', 'INT_MAX jaise limits'],
    'stdint.h': ['fixed-size integers like int64_t', 'fixed-size integers jaise int64_t'], 'conio.h': ['old Turbo C keyboard helpers (getch, clrscr)', 'purane Turbo C ke keyboard helpers (getch, clrscr)']
  };
  const q = (s) => '“' + s.trim() + '”';

  // split a call's argument text at top-level commas
  function args(s) {
    const out = []; let d = 0, st = 0, qt = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (qt) { if (c === '\\') i++; else if (c === qt) qt = ''; continue; }
      if (c === '"' || c === "'") { qt = c; continue; }
      if ('([{'.indexOf(c) >= 0) d++; else if (')]}'.indexOf(c) >= 0) d--; else if (c === ',' && d === 0) { out.push(s.slice(st, i).trim()); st = i + 1; }
    }
    const last = s.slice(st).trim(); if (last || out.length) out.push(last);
    return out;
  }
  function inner(s, fn) {          // text between the parentheses of fn( ... )
    const m = new RegExp('\\b' + fn + '\\s*\\(').exec(s); if (!m) return null;
    let d = 0, qt = '';
    for (let i = m.index + m[0].length - 1; i < s.length; i++) {
      const c = s[i];
      if (qt) { if (c === '\\') i++; else if (c === qt) qt = ''; continue; }
      if (c === '"' || c === "'") { qt = c; continue; }
      if (c === '(') d++; else if (c === ')') { d--; if (d === 0) return s.slice(m.index + m[0].length, i); }
    }
    return s.slice(m.index + m[0].length);
  }
  function conds(fmtStr) { const out = []; const re = /%[-+ #0]*\d*(?:\.\d+)?(hh|h|ll|l|z|L)?([diouxXeEfgGcsp])/g; let m; while ((m = re.exec(fmtStr))) out.push(((m[1] || '') + m[2]).replace('l', m[2] === 'f' ? 'l' : 'l')); return out; }
  function fmtKinds(list) { return list.map((k) => FMT[k] || FMT[k.replace(/^(hh|h|ll|l|z|L)/, '')] || ['a value', 'ek value']); }
  function varWord(t) { const k = t.replace(/\b(unsigned|signed|const|static)\b/g, '').replace(/\s+/g, ' ').trim(); return TYPES[k] || ['a value of type ' + k, k + ' type ki value']; }

  function explain(line) {
    const raw = line.replace(/\s+/g, ' ').trim(); let m;
    if (!raw) return null;
    const both = (en, hi, title) => ({ title: title || '', en, hi });

    if (/^\/\//.test(raw) || /^\/\*/.test(raw) || /^\*/.test(raw)) return both('A comment. The compiler ignores it; it is a note for people reading the code.', 'Yeh comment hai. Compiler ise ignore karta hai; yeh code padhne walon ke liye note hai.', 'Comment');
    if ((m = /^#\s*include\s*[<"]([^>"]+)[>"]/.exec(raw))) { const h = HDR[m[1]]; return both('Brings in ' + m[1] + (h ? ', which gives you ' + h[0] : '') + '. Without it the compiler would not know those functions.', m[1] + ' ko jodta hai' + (h ? ', jisme ' + h[1] + ' milte hain' : '') + '. Iske bina compiler in functions ko nahi jaanta.', '#include'); }
    if ((m = /^#\s*define\s+(\w+)\s*(.*)$/.exec(raw))) return both('Defines the name ' + m[1] + ' to mean ' + (m[2] ? q(m[2]) : 'nothing') + '. Before compiling, every ' + m[1] + ' is replaced by that text.', m[1] + ' naam ko ' + (m[2] ? q(m[2]) : 'khaali') + ' ka matlab deta hai. Compile se pehle har ' + m[1] + ' is text se badal jaata hai.', '#define');
    if (/^#/.test(raw)) return both('A preprocessor line: it is handled before the real compiling starts.', 'Yeh preprocessor line hai: asli compile se pehle yeh handle hoti hai.', '#');

    if ((m = /^(int|void)\s+main\s*\(([^)]*)\)\s*\{?$/.exec(raw))) return both('The main function: every C program starts running here. It returns ' + (m[1] === 'int' ? 'an int to the system (0 means “all good”)' : 'nothing') + '.', 'main function: har C program yahin se shuru hota hai. Yeh ' + (m[1] === 'int' ? 'system ko ek int lautata hai (0 ka matlab “sab theek”)' : 'kuch nahi lautata') + '.', 'main');
    if ((m = new RegExp('^(' + T + '(?:\\s*\\*+)?)\\s*\\**\\s*(\\w+)\\s*\\(([^)]*)\\)\\s*\\{?$').exec(raw)) && !/^(if|while|for|switch|return)$/.test(m[2])) {
      const ps = m[3].trim() === '' || m[3].trim() === 'void' ? null : args(m[3]);
      return both('Starts a function named ' + m[2] + ' that gives back ' + (m[1] === 'void' ? 'nothing' : varWord(m[1])[0]) + (ps ? ' and takes ' + ps.length + ' input' + (ps.length > 1 ? 's' : '') + ': ' + ps.join(', ') : ' and takes no input') + '. The { … } below is its body.', m[2] + ' naam ka function shuru hota hai jo ' + (m[1] === 'void' ? 'kuch nahi lautata' : varWord(m[1])[1] + ' lautata hai') + (ps ? ' aur ' + ps.length + ' input leta hai: ' + ps.join(', ') : ' aur koi input nahi leta') + '. Neeche { … } iski body hai.', 'Function');
    }
    if ((m = /^return\s*(.*?);?$/.exec(raw))) return both(m[1] ? 'Sends the value ' + q(m[1]) + ' back to whoever called this function and leaves it' + (m[1] === '0' ? ' (0 in main means the program finished successfully)' : '') + '.' : 'Leaves the function without giving back a value.', m[1] ? q(m[1]) + ' value ko function bulane wale ko wapas bhejta hai aur function se bahar nikal jaata hai' + (m[1] === '0' ? ' (main mein 0 ka matlab program sahi se khatam hua)' : '') + '.' : 'Bina value diye function se bahar nikal jaata hai.', 'return');
    if (/^(break);?$/.test(raw)) return both('Jumps out of the nearest loop or switch right now.', 'Sabse paas ke loop ya switch se turant bahar nikal jaata hai.', 'break');
    if (/^(continue);?$/.test(raw)) return both('Skips the rest of this round of the loop and starts the next round.', 'Loop ke is round ka baaki hissa chhodkar agla round shuru karta hai.', 'continue');

    if ((m = /^printf\s*\(/.exec(raw))) {
      const a = args(inner(raw, 'printf') || ''), f = a[0] || '', fm = /^"((?:[^"\\]|\\.)*)"/.exec(f);
      if (fm) {
        const ks = fmtKinds(conds(fm[1])), text = fm[1].replace(/%[-+ #0]*\d*(?:\.\d+)?(?:hh|h|ll|l|z|L)?[diouxXeEfgGcsp%]/g, '…').replace(/\\n/g, '').trim();
        const nl = /\\n/.test(fm[1]);
        let en = 'Prints ' + (text && text !== '…' ? q(text) : 'a value') + ' on the screen' + (nl ? ' and then moves to a new line' : '') + '.';
        let hi = 'Screen par ' + (text && text !== '…' ? q(text) : 'ek value') + ' print karta hai' + (nl ? ' aur phir nayi line par jaata hai' : '') + '.';
        if (ks.length) { en += ' Each % in the text is filled by the next value: ' + ks.map((k, i) => (a[i + 1] ? q(a[i + 1]) + ' as ' + k[0] : k[0])).join('; ') + '.'; hi += ' Text ka har % agli value se bharta hai: ' + ks.map((k, i) => (a[i + 1] ? q(a[i + 1]) + ' ko ' + k[1] + ' ki tarah' : k[1])).join('; ') + '.'; }
        return both(en, hi, 'printf');
      }
      return both('Prints something on the screen.', 'Screen par kuch print karta hai.', 'printf');
    }
    if (/^scanf\s*\(/.test(raw)) {
      const a = args(inner(raw, 'scanf') || ''), fm = /^"((?:[^"\\]|\\.)*)"/.exec(a[0] || '');
      const ks = fm ? fmtKinds(conds(fm[1])) : [];
      let en = 'Waits for the user to type something, then stores it' + (a.length > 1 ? ' in ' + a.slice(1).map((x) => q(x.replace(/^&/, ''))).join(', ') : '') + '.';
      let hi = 'User ke type karne ka intezaar karta hai, phir use' + (a.length > 1 ? ' ' + a.slice(1).map((x) => q(x.replace(/^&/, ''))).join(', ') : '') + ' mein store karta hai.';
      if (ks.length) { en += ' It expects ' + ks.map((k) => k[0]).join(' then ') + '. The & gives scanf the variable’s address so it can fill it in.'; hi += ' Yeh ' + ks.map((k) => k[1]).join(' phir ') + ' maangta hai. & variable ka address deta hai taaki scanf use bhar sake.'; }
      return both(en, hi, 'scanf');
    }
    if ((m = /^(?:\}\s*)?else\s+if\s*\((.*)\)\s*\{?$/.exec(raw))) return both('If the earlier checks were false, checks ' + q(m[1]) + '. If it is true, the block below runs.', 'Pehle wali checks galat hui to ' + q(m[1]) + ' check karta hai. Sahi ho to neeche ka block chalta hai.', 'else if');
    if ((m = /^(?:\}\s*)?else\s*\{?$/.exec(raw))) return both('Runs when the if above was false.', 'Upar wala if galat tha to yeh chalta hai.', 'else');
    if ((m = /^if\s*\((.*)\)\s*(\{?.*)$/.exec(raw))) return both('Checks ' + q(m[1]) + '. Only if it is true does the code that follows run.', q(m[1]) + ' check karta hai. Sirf sahi hone par hi aage ka code chalta hai.', 'if');
    if ((m = /^while\s*\((.*)\)\s*\{?$/.exec(raw))) return both('Repeats the block below again and again as long as ' + q(m[1]) + ' stays true' + (/^\s*(1|true)\s*$/.test(m[1]) ? ' (that is forever, so it needs a break or return inside)' : '') + '.', 'Jab tak ' + q(m[1]) + ' sahi rahe, neeche ka block baar baar chalata hai' + (/^\s*(1|true)\s*$/.test(m[1]) ? ' (yeh hamesha chalta rahega, isliye andar break ya return chahiye)' : '') + '.', 'while');
    if (/^do\s*\{?$/.test(raw)) return both('Starts a loop that always runs once, then repeats while the condition after the closing } is true.', 'Aisa loop jo kam se kam ek baar chalta hai, phir } ke baad wali shart sahi rehne tak dohrata hai.', 'do');
    if ((m = /^for\s*\((.*?);(.*?);(.*)\)\s*\{?$/.exec(raw))) return both('A counting loop. Start: ' + (m[1].trim() ? q(m[1]) : 'nothing') + '. It keeps going while ' + (m[2].trim() ? q(m[2]) : 'always') + ' is true. After each round it does ' + (m[3].trim() ? q(m[3]) : 'nothing') + '.', 'Ginti wala loop. Shuruaat: ' + (m[1].trim() ? q(m[1]) : 'kuch nahi') + '. Yeh tab tak chalta hai jab tak ' + (m[2].trim() ? q(m[2]) : 'hamesha') + ' sahi hai. Har round ke baad ' + (m[3].trim() ? q(m[3]) : 'kuch nahi') + ' hota hai.', 'for');
    if ((m = /^switch\s*\((.*)\)\s*\{?$/.exec(raw))) return both('Looks at the value of ' + q(m[1]) + ' and jumps to the matching case below.', q(m[1]) + ' ki value dekhkar neeche ke matching case par jaata hai.', 'switch');
    if ((m = /^case\s+(.*?):/.exec(raw))) return both('The code after this runs when the switch value is ' + q(m[1]) + '. End it with break; or it keeps falling into the next case.', 'Switch ki value ' + q(m[1]) + ' hone par iske baad ka code chalta hai. break; lagao warna agle case mein ghus jaata hai.', 'case');
    if (/^default\s*:/.test(raw)) return both('Runs when no case matched.', 'Koi case match nahi hua to yeh chalta hai.', 'default');
    if (/^\}\s*;?$/.test(raw)) return both('Closes the block that a { above opened.', 'Upar ke { se khule block ko band karta hai.', '}');

    // declarations: int a = 5, b;  /  int arr[10];  /  char *s = "hi";
    if ((m = new RegExp('^(' + T + ')\\s+(.+?);?$').exec(raw)) && !/\(/.test(m[2].split('=')[0])) {
      const vt = varWord(m[1]), parts = args(m[2]), arr = /^\**\s*(\w+)\s*\[\s*(\w*)\s*\]/.exec(parts[0]), ptr = /^\*+\s*(\w+)/.exec(parts[0]);
      if (arr) return both('Makes an array named ' + arr[1] + ' that can hold ' + (arr[2] || 'several') + ' items, each ' + vt[0] + (/=/.test(m[2]) ? ', starting with the values given' : '') + '. Items are numbered from 0.', arr[1] + ' naam ka array banata hai jisme ' + (arr[2] || 'kai') + ' items aa sakte hain, har ek ' + vt[1] + (/=/.test(m[2]) ? ', diye gaye values ke saath' : '') + '. Items 0 se gine jaate hain.', 'Array');
      if (ptr) return both('Makes a pointer named ' + ptr[1] + ': a variable that holds a memory address' + (/=/.test(parts[0]) ? ' (set right away to ' + q(parts[0].split('=').slice(1).join('=')) + ')' : ', not set yet') + '.', ptr[1] + ' naam ka pointer banata hai: aisa variable jo memory address rakhta hai' + (/=/.test(parts[0]) ? ' (turant ' + q(parts[0].split('=').slice(1).join('=')) + ' se set)' : ', abhi set nahi') + '.', 'Pointer');
      const names = parts.map((p) => p.split('=')[0].trim()).filter(Boolean);
      const withVal = parts.filter((p) => /=/.test(p)).map((p) => p.split('=')[0].trim() + ' = ' + p.split('=').slice(1).join('=').trim());
      return both('Makes ' + (names.length > 1 ? 'variables ' : 'a variable ') + names.join(', ') + ' to hold ' + vt[0] + (withVal.length ? ', starting at ' + withVal.map(q).join(', ') : ' (no value yet, so it holds garbage until you set it)') + '.', (names.length > 1 ? 'Variables ' : 'Variable ') + names.join(', ') + ' banata hai jo ' + vt[1] + ' rakhte hain' + (withVal.length ? ', shuruaat mein ' + withVal.map(q).join(', ') : ' (abhi value nahi, isliye set karne tak kachra value hoti hai)') + '.', 'Variable');
    }

    if ((m = /^(\w+)\s*(\+\+|--);?$/.exec(raw)) || (m = /^(\+\+|--)\s*(\w+);?$/.exec(raw))) { const v = /\w/.test(m[1][0]) ? m[1] : m[2], op = /\w/.test(m[1][0]) ? m[2] : m[1]; return both((op === '++' ? 'Adds 1 to ' : 'Subtracts 1 from ') + v + '.', v + ' mein ' + (op === '++' ? '1 jodta hai' : 'se 1 ghatata hai') + '.', op); }
    if ((m = /^([\w\[\]\.\->\*\s]+?)\s*([+\-*\/%&|^]|<<|>>)=\s*(.+?);?$/.exec(raw))) return both('Updates ' + q(m[1]) + ': takes its current value, applies ' + q(m[2]) + ' with ' + q(m[3]) + ', and stores the result back.', q(m[1]) + ' ko update karta hai: abhi ki value par ' + q(m[3]) + ' ke saath ' + q(m[2]) + ' lagakar result wapas store karta hai.', m[2] + '=');
    if ((m = /^(\*?[\w\[\]\.\->]+)\s*=\s*(?!=)(.+?);?$/.exec(raw))) return both('Stores ' + q(m[2]) + ' into ' + q(m[1]) + '. The right side is worked out first, then copied into the left side.', q(m[2]) + ' ko ' + q(m[1]) + ' mein store karta hai. Pehle right side ki value nikalti hai, phir left side mein copy hoti hai.', 'Assignment');
    if ((m = /^(\w+)\s*\(/.exec(raw)) && !/^(if|while|for|switch)$/.test(m[1])) { const a = args(inner(raw, m[1]) || '').filter(Boolean); return both('Calls the function ' + m[1] + (a.length ? ' with ' + a.map(q).join(', ') : '') + ' and runs its code, then comes back here.', m[1] + ' function ko ' + (a.length ? a.map(q).join(', ') + ' ke saath ' : '') + 'bulata hai, uska code chalata hai, phir yahin wapas aata hai.', 'Function call'); }
    return both('A C statement. Every statement ends with a semicolon (;).', 'Yeh C ka statement hai. Har statement semicolon (;) par khatam hota hai.', 'Statement');
  }

  CC.explainLine = function (line, lang) {
    const e = explain(String(line || '')); if (!e) return null;
    return { title: e.title, text: lang === 'hi' ? e.hi : e.en };
  };
  if (typeof module !== 'undefined') module.exports = CC.explainLine;
})(typeof self !== 'undefined' ? self : globalThis);
