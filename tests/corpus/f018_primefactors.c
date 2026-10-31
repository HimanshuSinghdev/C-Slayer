#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){long n;scanf("%ld",&n);for(long p=2;p*p<=n;p++){int e=0;while(n%p==0){n/=p;e++;}if(e)printf("%ld^%d ",p,e);}if(n>1)printf("%ld^1",n);puts("");return 0;}
