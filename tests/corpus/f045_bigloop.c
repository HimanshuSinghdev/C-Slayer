#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){unsigned long long s=0;for(unsigned i=1;i<=2000000;i++)s+=(unsigned long long)i*i%1000003;printf("%llu\n",s);return 0;}
