#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){int a[10];ptrdiff_t d=&a[7]-&a[2];printf("%td %zu\n",d,sizeof(ptrdiff_t));char*p=(char*)&a[3]-(char*)&a[0];printf("%d\n",(int)(long)p);return 0;}
