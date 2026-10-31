#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int x=-16;printf("%d %d %u\n",x>>2,x<<1,(unsigned)x>>28);printf("%d %lld\n",1<<30,1LL<<40);unsigned char c=0x81;printf("%d %d\n",c>>1,(signed char)c>>1);return 0;}
