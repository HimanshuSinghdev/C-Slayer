#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int x=5;int*p=&x;int**pp=&p;**pp=9;printf("%d %d %d\n",x,*p,**pp);char*names[]={"one","two","three"};char**q=names;printf("%s %s %c\n",*q,*(q+2),q[1][1]);return 0;}
