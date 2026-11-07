#include <stdio.h>
int main(void){
long long n;
 if(scanf("%lld",&n)!=1) return 1;
 int s=0;
 while(n>0){
s+=n%10;
n/=10;
} printf("%d\n",s);
 return 0;
}