#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){char c=200;unsigned char u=200;printf("%d %d %d\n",c,u,c==u);signed char s=-128;s--;printf("%d\n",s);printf("%d\n",'\377');return 0;}
