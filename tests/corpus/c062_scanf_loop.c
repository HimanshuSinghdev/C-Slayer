#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n,s=0,c=0;while(scanf("%d",&n)==1){s+=n;c++;}printf("n=%d sum=%d avg=%.2f\n",c,s,c?(double)s/c:0.0);return 0;}
