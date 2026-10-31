#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){long long a=1LL<<62;unsigned long long b=18446744073709551615ULL;printf("%lld %llu %llx\n",a,b,b);printf("%lld\n",a*2);long long f=1;for(int i=1;i<=20;i++)f*=i;printf("%lld\n",f);return 0;}
