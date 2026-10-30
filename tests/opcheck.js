// Verifies the numeric opcodes baked into vm.js (`case 12 /*ICONST*/:`) still match js/cc/isa.js.
const load = require('./load'); const CC = load(['isa.js']);
const src = require('fs').readFileSync(require('path').join(__dirname, '../js/cc/vm.js'), 'utf8');
let bad = 0, n = 0;
for (const m of src.matchAll(/case (\d+) \/\*([A-Z0-9_]+)\*\/:/g)) { n++; if (CC.OP[m[2]] !== +m[1]) { bad++; console.log('MISMATCH', m[2], m[1], CC.OP[m[2]]); } }
if (/case OP\./.test(src)) { bad++; console.log('vm.js still has symbolic case labels (slow dispatch)'); }
console.log('opcodes checked', n, bad ? 'FAIL' : 'ok'); process.exit(bad ? 1 : 0);
