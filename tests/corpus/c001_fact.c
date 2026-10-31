#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
unsigned long long f(int n){return n<2?1:n*f(n-1);}
int main(void){for(int i=0;i<=20;i++)printf("%d! = %llu\n",i,f(i));return 0;}
