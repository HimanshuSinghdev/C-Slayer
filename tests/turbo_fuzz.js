// mutation fuzzer: mutate corpus programs; any thrown exception or "internal" error is a bug
const fs = require('fs'), path = require('path');
const load=require('./load');const CC=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js','turbo.js']);
const dir = path.join(__dirname, 'corpus');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c'));
let seed = +process.argv[3] || 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const N = +process.argv[2] || 2000; const SEM = process.argv[4] === 'sem';
const toks = s => s.match(/\w+|\s+|[^\w\s]/g) || [];
const EXT = ['0', '-1', '2147483647', '4294967296', '99999999999', '1e308', '0x7fffffffffffffff', '""', "'a'", 'NULL', '(', ')', '{', '}', ';', '*', '&', '[', ']', '->', '++', '<<', '/', '%', 'sizeof', 'void', 'struct', 'int', 'return', '...', '#'];
function mutate(src) {
  const t = toks(src); const k = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < k; i++) {
    let p = Math.floor(rnd() * t.length), r = rnd();
    if (SEM) { for (let g = 0; g < 50 && !/^(\d+|[-+*\/%<>=!&|^]+)$/.test(t[p]); g++) p = Math.floor(rnd() * t.length); if (/^\d+$/.test(t[p])) { t[p] = ['0', '1', '-1', '2147483647', '255', '65536', '1000000', '4294967295', '99'][Math.floor(rnd() * 9)]; continue; } r = 0.9; }
    if (r < 0.3) t.splice(p, 1);
    else if (r < 0.5) t.splice(p, 0, t[Math.floor(rnd() * t.length)]);
    else if (r < 0.8) t[p] = EXT[Math.floor(rnd() * EXT.length)];
    else { const q = Math.floor(rnd() * t.length); const x = t[p]; t[p] = t[q]; t[q] = x; }
  }
  return t.join('');
}

function runVM(c){const vm=new CC.VM(c.program,{});vm.feedInput('1 2 3\nabc def\n',true);let out='';
 for(let g=0;g<30;g++){const st=vm.run(100000);for(const q of vm.drainOutput())out+=q.s;
  if(st==='done')return JSON.stringify([out,vm.exitCode]);if(st==='error')return JSON.stringify([out,vm.error.kind,vm.error.line]);if(st==='wait')vm.feedInput('',true);}return null;}
function runT(c){const vm=new CC.VM(c.program,{});vm.feedInput('1 2 3\nabc def\n',true);let out='';const t=Date.now();
 const mod=CC.Turbo.build(vm,{tick(){for(const q of vm.drainOutput())out+=q.s;if(Date.now()-t>4000)throw new CC.Turbo.TurboTimeout();}});
 const st=CC.Turbo.run(vm,mod);for(const q of vm.drainOutput())out+=q.s;
 if(st==='done')return JSON.stringify([out,vm.exitCode]);if(st==='error')return JSON.stringify([out,vm.error.kind,vm.error.line]);return st;}
let bad=0,cmp=0,uns=0,t0=Date.now();
for(let n=0;n<N;n++){
 const f=files[Math.floor(rnd()*files.length)];const src=mutate(fs.readFileSync(path.join(dir,f),'utf8'));
 let c;try{c=CC.compile(src,{});}catch(e){continue;}if(!c.ok)continue;
 const a=runVM(c);if(a===null)continue;
 let b;try{b=runT(c);}catch(e){if(e instanceof CC.Turbo.Unsupported){uns++;continue;}bad++;console.log('THROW',f,String(e.stack).split('\n').slice(0,2).join('|'));fs.writeFileSync('/tmp/tf_'+bad+'.c',src);continue;}
 if(b==='overflow')continue;cmp++;
 if(a!==b){bad++;console.log('DIFF',f,a.slice(0,120),'||',b.slice(0,120));fs.writeFileSync('/tmp/tf_'+bad+'.c',src);}
}
console.log('iterations',N,'compared',cmp,'unsupported',uns,'bad',bad,'secs',Math.round((Date.now()-t0)/1000));
