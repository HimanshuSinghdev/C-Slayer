// Fix it on style variants (comments, arrays, several statements per line…): every offered fix must remove its own problem
const load=require('./load.js');
const CT=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js']);
const FX=require('../js/cc/fixit.js');
const H='#include <stdio.h>\n';
const V=[
 H+'int main(void) {\n    int x = 5 // five\n    printf("%d\\n", x);\n    return 0;\n}',
 H+'int main(void) {\n    int a[3];\n    scanf("%d", a[1]);\n    return 0;\n}',
 H+'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, b);\n    return 0;\n}',
 H+'int main(void) {\n    float f;\n    scanf("%f", f);\n    return 0;\n}',
 H+'int main(void) {\n    char s[20];\n    scanf("%s", s);\n    printf("%d\\n", s);\n    return 0;\n}',
 H+'int main(void) {\n    int x = 3; int y = 4\n    printf("%d\\n", x+y);\n    return 0;\n}',
 H+'int main(void) {\n    int i = 0;\n    while (i = 3) { i++; }\n    return 0;\n}',
 H+'int main(void) {\n    unsigned long u = 5;\n    printf("%d\\n", u);\n    return 0;\n}',
 H+'int main(void) {\n    double d = 1.5;\n    printf("%5.2d|%d\\n", d, 3);\n    return 0;\n}',
 H+'int main(void) {\n    int x;\n    x = 4\n    return 0;\n}',
 H+'int main(void) {\n    int r = 0;\n    printf("hi")\n    return r;\n}',
 'int main(void) {\n    int n = abs(-3);\n    printf("%d\\n", n);\n    return 0;\n}',
 'int main(void) {\n    double r = sqrt(4.0);\n    return 0;\n}',
 H+'int main(void) {\n    int a = 1\n    int b = 2;\n    return a + b;\n}',
 H+'void main() {\n    int unused2 = 4;\n    puts("x");\n}',
];
let bad=0,fixed=0,none=0;
V.forEach((src,i)=>{const c=CT.compile(src,{});const ds=c.errors||[];if(!ds.length){console.log(i,'compiles clean');return}
  let any=false;for(const d of ds){const f=FX.suggest(src,d);if(!f)continue;any=true;const out=FX.apply(src,f.edits);const c2=CT.compile(out,{});
   const key=x=>x.msg.replace(/\d+/g,'#');const gone=!(c2.errors||[]).some(x=>key(x)===key(d)&&x.line===d.line);
   if(!gone){bad++;console.log('BAD',i,f.title,'\n'+out)}else{fixed++;console.log('ok ',i,f.title)}}
  if(!any){none++;console.log('-- ',i,'no fix for:',ds.map(d=>d.msg.slice(0,50)).join(' | '))}});
console.log('fixed',fixed,'bad',bad,'none',none);process.exit(bad?1:0);
