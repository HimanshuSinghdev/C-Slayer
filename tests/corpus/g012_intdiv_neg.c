#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){for(int a=-7;a<=7;a+=7)for(int b=-3;b<=3;b+=2)if(b)printf("%d/%d=%d %d ",a,b,a/b,a%b);puts("");return 0;}
