// Fix it: every suggested fix must remove its own problem when applied (recompiled with the real compiler)
const load=require('./load.js');
const CT=load(['lexer.js','preproc.js','types.js','parser.js','isa.js','vm.js','inspect.js','headers.js','libc.js','cdecl.js','cexpr.js','cstmt.js','cfmt.js','compile.js']);
const cases={
 semi:'#include <stdio.h>\nint main(void) {\n    int x = 5\n    printf("%d\\n", x);\n    return 0;\n}',
 inc:'int main(void) {\n    printf("hi\\n");\n    return 0;\n}',
 amp:'#include <stdio.h>\nint main(void) {\n    int n;\n    scanf("%d", n);\n    printf("%d\\n", n);\n    return 0;\n}',
 fmt:'#include <stdio.h>\nint main(void) {\n    long long v = 5;\n    double d = 2.5;\n    printf("%d %d\\n", v, d);\n    return 0;\n}',
 vmain:'#include <stdio.h>\nvoid main() {\n    printf("x\\n");\n}',
 ret:'#include <stdio.h>\nint main(void) {\n    printf("x\\n");\n}',
 typo:'#include <stdio.h>\nint main(void) {\n    pritnf("x\\n");\n    return 0;\n}',
 eq:'#include <stdio.h>\nint main(void) {\n    int a = 1;\n    if (a = 2) printf("x\\n");\n    return 0;\n}',
 unused:'#include <stdio.h>\nint main(void) {\n    int unused;\n    printf("x\\n");\n    return 0;\n}',
 gets:'#include <stdio.h>\nint main(void) {\n    char s[20];\n    gets(s);\n    return 0;\n}',
 undecl:'#include <stdio.h>\nint main(void) {\n    y = 3;\n    printf("%d\\n", y);\n    return 0;\n}',
};
const FX=require('../js/cc/fixit.js');
let bad=0,fixed=0;
for(const [k,src] of Object.entries(cases)){
  const c=CT.compile(src,{});const ds=(c.errors||[]).concat(c.warnings||[]);let shown=false;
  for(const d of ds){const f=FX.suggest(src,d);if(!f)continue;const out=FX.apply(src,f.edits);const c2=CT.compile(out,{});
    const key=(x)=>x.msg.replace(/\d+/g,'#');const gone=!(c2.errors||[]).concat(c2.warnings||[]).some(x=>key(x)===key(d)&&x.line===d.line);
    if(!gone)bad++;fixed++;console.log(gone?'ok  ':'BAD ',k,'|',f.title);shown=true;}
  if(!shown)console.log('--  ',k,'| no fix offered');
}
console.log('fixes',fixed,'bad',bad);process.exit(bad?1:0);
