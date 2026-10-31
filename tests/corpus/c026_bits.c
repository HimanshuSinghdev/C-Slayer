#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){unsigned x=0xF0F0u;printf("%u %u %u %u\n",x&0xFF,x|0xF,x^0xFFFF,~x&0xFFFF);printf("%u %u\n",x<<2,x>>4);int c=0;for(unsigned t=x;t;t&=t-1)c++;printf("pop=%d\n",c);return 0;}
