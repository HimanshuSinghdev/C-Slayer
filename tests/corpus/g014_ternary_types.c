#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){int i=1;double d=i?1:2.5;printf("%.1f %d\n",d,(int)sizeof(i?1:2.5));char c='a';printf("%d %d\n",(int)sizeof(c),(int)sizeof(c+1));return 0;}
