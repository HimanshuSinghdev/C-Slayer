#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){unsigned int a=4000000000u,b=500000000u;printf("%u %u\n",a+b,a*2);long long big=3000000000LL*3;printf("%lld\n",big);int i=2147483647;unsigned u=i;u++;printf("%u\n",u);return 0;}
