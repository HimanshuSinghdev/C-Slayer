#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a[]={10,20,30,40,50};int*p=a;printf("%d %d %d\n",*p,*(p+2),p[4]);p+=3;printf("%d %ld\n",*p,(long)(p-a));int*q=&a[1];printf("%d\n",(int)(p-q));return 0;}
