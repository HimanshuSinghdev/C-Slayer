#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int a[5]={1,2,3,4,5};int*p=a,*e=a+5;int s=0;while(p<e)s+=*p++;printf("%d\n",s);int*q=&a[3];printf("%d %d %d\n",q>a,q-a,*(q-1));return 0;}
