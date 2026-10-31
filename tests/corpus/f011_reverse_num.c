#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n;scanf("%d",&n);int neg=n<0;if(neg)n=-n;long r=0;while(n){r=r*10+n%10;n/=10;}printf("%ld\n",neg?-r:r);return 0;}
