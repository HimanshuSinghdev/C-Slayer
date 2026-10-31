#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
long g(long a,long b){return b?g(b,a%b):a;}
int main(void){long a,b;while(scanf("%ld %ld",&a,&b)==2)printf("gcd=%ld lcm=%ld\n",g(a,b),a/g(a,b)*b);return 0;}
