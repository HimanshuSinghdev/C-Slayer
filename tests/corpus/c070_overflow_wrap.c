#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){unsigned char c=250;c+=10;unsigned u=0;u--;printf("%d %u\n",c,u);unsigned long long x=1ULL<<63;printf("%llu\n",x);printf("%d\n",(int)(unsigned char)200);return 0;}
