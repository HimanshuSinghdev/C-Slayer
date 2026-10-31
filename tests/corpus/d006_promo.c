#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){signed char c=-1;unsigned char u=255;short s=-2;printf("%d %d %d\n",c+u,s*s,(unsigned)c>100);unsigned a=3;int b=-5;printf("%d %d\n",a+b<0,(int)(a+b));long l=-1;printf("%d\n",l<(unsigned)1);return 0;}
