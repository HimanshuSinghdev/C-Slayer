const {run}=require('./harness.js');
const cases={
 'heap-overflow':'#include <stdlib.h>\nint main(){int*p=malloc(4*sizeof(int));p[4]=1;return 0;}',
 'use-after-free':'#include <stdlib.h>\nint main(){int*p=malloc(8);free(p);return *p;}',
 'double-free':'#include <stdlib.h>\nint main(){int*p=malloc(8);free(p);free(p);return 0;}',
 'segv':'int main(){int*p=0;*p=1;return 0;}',
 'stack-array':'int main(){int a[3];a[3]=1;return 0;}',
 'global-array':'int g[3];int main(){g[3]=1;return 0;}',
 'sigfpe':'int main(){int z=0;return 1/z;}',
 'stack-overflow':'int f(int n){return f(n+1)+1;}int main(){return f(0);}',
 'leak':'#include <stdlib.h>\nint main(){malloc(10);return 0;}',
 'infinite':'int main(){for(;;);}',
 'rodata-write':'int main(){char*s="abc";s[0]=1;return 0;}',
 'exit3':'#include <stdlib.h>\nint main(){exit(3);}',
 'abort':'#include <stdlib.h>\nint main(){abort();}',
 'assert':'#include <assert.h>\nint main(){assert(1==2);return 0;}',
 'outlimit':'#include <stdio.h>\nint main(){for(;;)puts("xxxxxxxxxxxxxxxxxxxxxxxx");}',
 'hugealloc':'#include <stdlib.h>\n#include <stdio.h>\nint main(){void*p=malloc(1UL<<40);printf("%d\\n",p==0);return 0;}',
 'proto':'#include <stdio.h>\nint main(){int __proto__=1,constructor=2,toString=3,hasOwnProperty=4;printf("%d\\n",__proto__+constructor+toString+hasOwnProperty);return 0;}',
 'uninit-warn':'#include <stdio.h>\nint main(){int x;printf("%d\\n",x);int y=5;return 0;}',
 'syntax':'int main(){int x=;}',
 'undef':'int main(){foo();return 0;}',
};
for(const [k,s] of Object.entries(cases)){
  const t=Date.now();let r;
  try{r=run(s,{stdin:'',maxSlices:30});}catch(e){console.log(k,'CRASH',e.message);continue;}
  console.log(k.padEnd(15),'ok='+r.ok,'exit='+r.exit,'err='+JSON.stringify(r.runError&&(r.runError.kind||r.runError.message)),'leaks='+(r.leaks&&r.leaks.length),'diag='+JSON.stringify(r.errors.map(e=>e.sev[0]+e.line+':'+e.msg.slice(0,60))).slice(0,160),(Date.now()-t)+'ms');
}
