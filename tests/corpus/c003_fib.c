#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){long a=0,b=1;for(int i=0;i<60;i++){printf("%ld ",a);long t=a+b;a=b;b=t;}printf("\n");return 0;}
