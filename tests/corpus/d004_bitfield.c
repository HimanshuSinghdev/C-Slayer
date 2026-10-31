#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct F{unsigned a:3;unsigned b:5;int c:4;};
int main(void){struct F f={0};f.a=9;f.b=33;f.c=-3;printf("%u %u %d\n",f.a,f.b,f.c);f.c=9;printf("%d\n",f.c);return 0;}
