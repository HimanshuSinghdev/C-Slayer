#include <stdio.h>
int main(void){
int n;
 if(scanf("%d",&n)!=1) return 1;
 long long f=1;
 for(int i=2;
i<=n;
i++) f*=i;
 printf("%lld\n",f);
 return 0;
}