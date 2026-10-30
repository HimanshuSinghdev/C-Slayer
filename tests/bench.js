const {run}=require('./harness.js');
const progs={
 rec100k:'#include <stdio.h>\nint s(int n){return n==0?0:n+s(n-1);}\nint main(){printf("%d\\n",s(100000));return 0;}',
 rec1m:'int s(int n){return n==0?0:n+s(n-1);}\nint main(){return s(1000000)&1;}',
 big64:'#include <stdlib.h>\n#include <stdio.h>\nint main(){char*p=malloc(60*1024*1024);for(long i=0;i<60*1024*1024;i+=4096)p[i]=1;printf("ok\\n");free(p);return 0;}',
 loop50m:'#include <stdio.h>\nint main(){long s=0;for(int i=0;i<50000000;i++){s+=i%7;}printf("%ld\\n",s);return 0;}',
 sieve:'#include <stdio.h>\n#include <stdlib.h>\nint main(){int n=5000000;char*c=calloc(n+1,1);int cnt=0;for(int i=2;i<=n;i++){if(!c[i]){cnt++;for(long j=(long)i*i;j<=n;j+=i)c[j]=1;}}printf("%d\\n",cnt);free(c);return 0;}',
 fib35:'int fib(int n){return n<2?n:fib(n-1)+fib(n-2);}\nint main(){return fib(32)&255;}',
};
for(const [k,s] of Object.entries(progs)){const t=Date.now();const r=run(s,{stdin:'',maxSlices:100000});console.log(k.padEnd(8),'exit='+r.exit,'err='+(r.runError&&r.runError.kind),JSON.stringify(r.out.trim()),(Date.now()-t)+'ms');}
