// Speed table: gcc -O0 / -O2 versus the Turbo engine (what the Run button uses). Usage: node tests/bench_turbo.js [name]
'use strict';
const cp = require('child_process'), fs = require('fs'), load = require('./load');
const CT = load(['lexer.js', 'preproc.js', 'types.js', 'parser.js', 'isa.js', 'vm.js', 'inspect.js', 'headers.js', 'libc.js', 'cdecl.js', 'cexpr.js', 'cstmt.js', 'cfmt.js', 'compile.js', 'turbo.js']);
const H = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n';
const P = {
  loop50m: H + 'int main(){long s=0;for(int i=0;i<50000000;i++){s+=i%7;}printf("%ld\\n",s);return 0;}',
  fib35: H + 'int fib(int n){return n<2?n:fib(n-1)+fib(n-2);}\nint main(){printf("%d\\n",fib(35));return 0;}',
  sieve: H + 'int main(){int n=20000000;char*c=calloc(n+1,1);int cnt=0;for(int i=2;i<=n;i++){if(!c[i]){cnt++;for(long j=(long)i*i;j<=n;j+=i)c[j]=1;}}printf("%d\\n",cnt);return 0;}',
  hash64: H + 'int main(){unsigned long long h=1469598103934665603ULL;for(int i=0;i<5000000;i++){h^=i;h*=1099511628211ULL;}printf("%llu\\n",h);return 0;}',
  modpow: H + 'unsigned long long mp(unsigned long long b,unsigned long long e,unsigned long long m){unsigned long long r=1;b%=m;while(e){if(e&1)r=r*b%m;b=b*b%m;e>>=1;}return r;}\nint main(){unsigned long long s=0;for(int i=1;i<200000;i++)s+=mp(i,1000000005ULL,1000000007ULL);printf("%llu\\n",s);return 0;}',
  matmul: H + 'int a[300][300],b[300][300],c[300][300];int main(){for(int i=0;i<300;i++)for(int j=0;j<300;j++){a[i][j]=i+j;b[i][j]=i-j;}for(int i=0;i<300;i++)for(int j=0;j<300;j++){int s=0;for(int k=0;k<300;k++)s+=a[i][k]*b[k][j];c[i][j]=s;}printf("%d\\n",c[7][9]);return 0;}',
  bubble: H + 'int a[6000];int main(){for(int i=0;i<6000;i++)a[i]=(i*7919)%6007;for(int i=0;i<6000;i++)for(int j=0;j+1<6000-i;j++)if(a[j]>a[j+1]){int t=a[j];a[j]=a[j+1];a[j+1]=t;}printf("%d %d\\n",a[0],a[5999]);return 0;}',
  strings: H + 'int main(){char s[64];long t=0;for(int i=0;i<300000;i++){sprintf(s,"item-%d",i);t+=strlen(s)+(s[5]-48);}printf("%ld\\n",t);return 0;}',
  prints: H + 'int main(){for(int i=0;i<200000;i++)printf("%d\\n",i);return 0;}',
  list: H + 'typedef struct N{int v;struct N*n;}N;int main(){N*h=0;for(int i=0;i<1000000;i++){N*x=malloc(sizeof(N));x->v=i;x->n=h;h=x;}long s=0;for(N*p=h;p;p=p->n)s+=p->v;printf("%ld\\n",s);return 0;}',
  doubles: H + 'int main(){double s=0;for(int i=1;i<20000000;i++)s+=1.0/((double)i*i);printf("%.6f\\n",s);return 0;}',
};
const only = process.argv[2], rows = [];
for (const [k, src] of Object.entries(P)) {
  if (only && k !== only) continue;
  fs.writeFileSync('/tmp/_b.c', src); const g = {};
  for (const o of ['-O0', '-O2']) { cp.spawnSync('gcc', [o, '-w', '-o', '/tmp/_b', '/tmp/_b.c']); const t = Date.now(); const r = cp.spawnSync('/tmp/_b', { maxBuffer: 1e9 }); g[o] = Date.now() - t; g.out = r.stdout.toString(); }
  let ms = 0, st = '', out = '';
  try { const c = CT.compile(src, {}); const vm = new CT.VM(c.program, {}); vm.feedInput('', true); const t = Date.now(); const m = CT.Turbo.build(vm, { tick() { for (const q of vm.drainOutput()) if (q.fd === 1) out += q.s; } }); st = CT.Turbo.run(vm, m); ms = Date.now() - t; for (const q of vm.drainOutput()) if (q.fd === 1) out += q.s; if (vm.error) st = vm.error.message.slice(0, 40); } catch (e) { st = 'ERR ' + e.message.slice(0, 40); }
  rows.push({ k, o0: g['-O0'], o2: g['-O2'], ms, st, same: out === g.out });
}
console.log('program    gcc-O0  gcc-O2   Turbo   x(O0)  check');
for (const r of rows) console.log(r.k.padEnd(9), String(r.o0).padStart(6), String(r.o2).padStart(7), String(r.ms).padStart(7), ('x' + (r.ms / Math.max(r.o0, 1)).toFixed(1)).padStart(7), r.same && r.st === 'done' ? ' same output' : ' ' + (r.st === 'done' ? 'OUTPUT DIFFERS' : r.st));
