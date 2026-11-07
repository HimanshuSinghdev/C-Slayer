#include <stdio.h>
int main(void){
long long n;
 if(scanf("%lld",&n)!=1) return 1;
 puts(n%2==0?"Even":"Odd");
 return 0;
}