const CC = require('./load')(['lexer.js','preproc.js','types.js','parser.js']);
const hdr = { 'stdio.h': 'int printf(const char *f, ...); typedef unsigned long size_t;' };
function front(src){
  const L = CC.lex(src,'main.c');
  const P = CC.preprocess(L.tokens,{headers:hdr,file:'main.c'});
  const R = CC.parse(P.tokens);
  return { errors:[...L.errors,...P.errors,...R.errors], ast:R.ast, pp:P };
}
let fail=0;
function t(name, src, expectErrs){
  const r = front(src);
  const errs = r.errors.filter(e=>e.sev==='error').map(e=>e.line+': '+e.msg);
  const ok = expectErrs===undefined ? errs.length===0 : (expectErrs===0? errs.length===0 : errs.length>0 && errs.join('|').includes(expectErrs));
  if(!ok){ fail++; console.log('FAIL',name,'\n  got:',errs.join('\n       ')); } else console.log('ok  ',name, errs.length?('['+errs[0]+']'):'');
  return r;
}
t('hello', '#include <stdio.h>\nint main(void){ printf("hi %d\\n", 3); return 0; }');
t('macros', '#define SQ(x) ((x)*(x))\n#define N 10\nint a[N]; int f(int y){return SQ(y+1);}\nint main(){return f(N);}');
t('stringify/paste', '#define S(x) #x\n#define C(a,b) a##b\nint C(ab,cd)=1; const char*s=S(hello world);\nint main(){return 0;}');
t('ifdef', '#define A 1\n#if A && defined(A)\nint x;\n#else\nint y z;\n#endif\nint main(){return 0;}');
t('struct', 'struct P{int x,y;}; typedef struct P P; P mk(int a){P p={a,2};return p;} int main(){P q=mk(1);return q.x;}');
t('fnptr', 'int add(int a,int b){return a+b;} int (*op)(int,int)=add; int main(){return op(1,2);}');
t('array decl', 'int main(){int a[3][4]; a[1][2]=5; char *s[]={"a","b"}; return a[1][2];}');
t('cast+sizeof', 'int main(){ double d=(double)sizeof(int)*2; long l=(long)&d; return (int)d; }');
t('for decl', 'int main(){ int s=0; for(int i=0;i<10;i++){ if(i%2) continue; s+=i; } while(s>0) s--; do{s++;}while(s<3); return s; }');
t('switch', 'int main(){ int x=2; switch(x){case 1: x=5; break; case 2: default: x=7;} return x; }');
t('goto', 'int main(){ int i=0; top: i++; if(i<3) goto top; return i; }');
t('missing semi', 'int main(){ int x = 5\n return x; }', "expected ';'");
t('missing paren', 'int main(){ if (1 { return 0;} }', "expected ')'");
t('unknown type', 'int main(){ Foo x; return 0; }', "unknown type name 'Foo'");
t('bad include', '#include <iostream>\nint main(){return 0;}', 'C++ header');
t('unterminated string', 'int main(){ char *s = "abc;\n return 0; }', 'missing terminating');
t('recursion macro', '#define A A+1\nint main(){ int A; return 0; }', 0);
t('macro bomb', '#define A B B\n#define B C C\n#define C D D\n#define D E E\n#define E F F\n#define F G G\n#define G H H\n#define H I I\n#define I J J\n#define J K K\n#define K L L\n#define L M M\n#define M N N\n#define N O O\n#define O P P\n#define P Q Q\n#define Q R R\n#define R S S\n#define S T T\n#define T 1\nint x = A;\nint main(){return 0;}', 'too large');
t('deep nesting', 'int main(){ int x = '+'('.repeat(2000)+'1'+')'.repeat(2000)+'; return x; }', 'nested too deeply');
t('implicit main', 'main(){ return 0; }', 0);
t('enum', 'enum Color {RED, GREEN=5, BLUE}; int main(){ enum Color c = BLUE; return c; }');
t('variadic macro', '#define LOG(fmt, ...) printf(fmt, __VA_ARGS__)\n#include <stdio.h>\nint main(){ LOG("%d %d\\n", 1, 2); return 0; }');
console.log(fail? ('FAILURES: '+fail) : 'all front-end smoke tests passed');
process.exit(fail?1:0);
