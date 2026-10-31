#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){int a=1,b=2,c=3;int*p[3]={&a,&b,&c};for(int i=0;i<3;i++)*p[i]*=10;printf("%d %d %d\n",a,b,c);int(*pa)[3]=&(int[3]){7,8,9};printf("%d\n",(*pa)[2]);return 0;}
