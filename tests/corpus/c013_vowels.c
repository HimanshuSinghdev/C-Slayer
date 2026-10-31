#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){const char*s="The quick brown fox jumps over the lazy dog";int v=0,c=0,sp=0;for(const char*p=s;*p;p++){if(isalpha((unsigned char)*p)){if(strchr("aeiouAEIOU",*p))v++;else c++;}else if(*p==' ')sp++;}printf("v=%d c=%d sp=%d\n",v,c,sp);return 0;}
