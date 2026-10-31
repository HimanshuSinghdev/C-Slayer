#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int a=(1,2,3);int b;for(int i=0,j=10;i<j;i+=3,j-=2)printf("%d,%d ",i,j);b=(a++,a*2);printf("\n%d %d\n",a,b);return 0;}
