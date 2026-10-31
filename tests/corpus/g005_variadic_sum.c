#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int sum(int n,...){va_list ap;va_start(ap,n);int s=0;for(int i=0;i<n;i++)s+=va_arg(ap,int);va_end(ap);return s;}
double avg(int n,...){va_list ap;va_start(ap,n);double s=0;for(int i=0;i<n;i++)s+=va_arg(ap,double);va_end(ap);return s/n;}
int main(void){printf("%d %.2f\n",sum(4,1,2,3,4),avg(3,1.5,2.5,3.5));return 0;}
