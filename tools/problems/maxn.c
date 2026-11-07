#include <stdio.h>
int main(void){
int n;
 if(scanf("%d",&n)!=1) return 1;
 long long m,x;
 for(int i=0;
i<n;
i++){
 if(scanf("%lld",&x)!=1) return 1;
 if(i==0||x>m) m=x;
} printf("%lld\n",m);
 return 0;
}