// differential check of accept/reject: for each snippet, gcc -fsyntax-only (errors only) vs C-Slayer
const cp = require('child_process'), fs = require('fs');
const { run } = require('./harness.js');
const H = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n';
const S = [
 'int main(void){int x=;return 0;}', 'int main(void){return 0}', 'int main(void){int x; x=5 return 0;}',
 'int main(void){undeclared=3;return 0;}', 'int main(void){int a[3]={1,2,3,4};return 0;}',
 'int f(int a){return a;} int main(void){return f(1,2);}', 'int f(int a){return a;} int main(void){return f();}',
 'int main(void){int x=1;int x=2;return 0;}', 'void f(void){} int main(void){int x=f();return 0;}',
 'int main(void){char*p="a";p=5.5;return 0;}', 'struct S{int a;}; int main(void){struct S s;s.b=1;return 0;}',
 'int main(void){int x=5;x();return 0;}', 'int main(void){1=2;return 0;}', 'int main(void){const int c=1;c=2;return 0;}',
 'int main(void){for(int i=0;i<3;i++{}return 0;}', 'int main(void){if(1){return 0;}else else{}}', 'int main(void){break;return 0;}',
 'int main(void){continue;return 0;}', 'int main(void){case 1:;return 0;}', 'int main(void){goto nowhere;return 0;}',
 'int main(void){switch(1){case 1:case 1:break;}return 0;}', 'int f(int a,int a){return a;} int main(void){return 0;}',
 'int main(void){int*p;int q=p*2;return 0;}', 'int main(void){double d=1.5;int x=d%2;return 0;}', 'int main(void){void v;return 0;}',
 'int main(void){int a[-1];return 0;}', 'int main(void){struct T t;return 0;}', 'union U{int a;}; int main(void){union U u=5;return 0;}',
 'int main(void){return sizeof(struct Nope);}', 'enum E{A,B}; int main(void){enum E e=A;e=3.5;return e;}',
 'int main(void){int x=08;return x;}', 'int main(void){int x=0x;return x;}', 'int main(void){char c=\'ab\';return 0;}',
 'int main(void){char*s="unterminated;return 0;}', 'int main(void){/* open comment return 0;}', 'int main(void){int 1a=3;return 0;}',
 '#include <nonexistent.h>\nint main(void){return 0;}', '#define\nint main(void){return 0;}', 'int main(void){return (int)"s"+;}',
 'static int f(void); int main(void){return f();}', 'int main(){int x;return x}', 'int f(void){return 1;}int f(void){return 2;}int main(void){return 0;}',
 'int main(void){int a=1,b=2;a+b=3;return 0;}', 'int main(void){int x=1;&x=0;return 0;}', 'int main(void){int*p=0;*p++=;return 0;}',
 'typedef int T; int main(void){T T=1;return T;}', 'int main(void){struct{int a;}s;return s.a.b;}', 'int main(void){int x;x.y=1;return 0;}',
 'int main(void){int x;return x->y;}', 'int main(void){return main(1);}', 'void f(int);int main(void){f("s");return 0;}',
 'int main(void){int a[2][2]={{1,2},{3,4}};return a[1];}', 'int main(void){float f=1.0;f<<=2;return 0;}', 'int main(void){return ~1.5;}',
 'int main(void){int x=1;return x?1;}', 'int main(void){do{}while(1)return 0;}', 'int main(void){while(1){}else{}}',
 'int main(void){static int x=rand();return x;}', 'int x=rand();int main(void){return 0;}', 'extern int e;int main(void){return 0;}',
 'int main(void){_Static_assert(0,"no");return 0;}', 'int main(void){int n=3;int a[n]={1};return 0;}', 'inline int f(void){return 1;}int main(void){return f();}',
 'int main(void){label:}', 'int main(void){int x=({1;});return x;}', 'int main(void){return 1 ? "a" : 2;}',
 'struct A{struct A a;};int main(void){return 0;}', 'struct A;int main(void){struct A*p;return sizeof *p;}', 'int main(void){char c[3]="abcd";return 0;}',
 'int main(void){int(*f)(int)=main;return f(1);}', 'int main(void){long long x=1LLL;return 0;}', 'int main(void){return 1.2.3;}',
 'void f(void){return 1;}int main(void){f();return 0;}', 'int f(void){return;}int main(void){return f();}', 'int main(void){unsigned long u=-1UL;return u>0;}',
];
let ok = 0, bad = 0;
fs.mkdirSync('/tmp/neg', { recursive: true });
S.forEach((s, i) => {
  const src = H + s + '\n', f = '/tmp/neg/n' + i + '.c';
  fs.writeFileSync(f, src);
  const g = cp.spawnSync('gcc', ['-std=gnu11', '-fsyntax-only', '-w', f]);
  const gccErr = g.status !== 0;
  let ours; try { const r = run(src, { stdin: '', maxSlices: 1 }); ours = !r.ok; } catch (e) { ours = true; }
  if (gccErr === ours) ok++; else { bad++; console.log('MISMATCH', i, 'gcc', gccErr ? 'rejects' : 'accepts', '| ours', ours ? 'rejects' : 'accepts', '\n   ', s.slice(0, 110)); }
});
console.log('agree', ok, 'disagree', bad);
