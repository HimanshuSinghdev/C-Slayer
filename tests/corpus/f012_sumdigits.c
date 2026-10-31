#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){long n;while(scanf("%ld",&n)==1){int s=0;if(n<0)n=-n;while(n){s+=n%10;n/=10;}printf("%d\n",s);}return 0;}
