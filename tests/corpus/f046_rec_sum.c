#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int sd(int n){return n?n%10+sd(n/10):0;}int pw(int b,int e){return e?b*pw(b,e-1):1;}int fibr(int n){return n<2?n:fibr(n-1)+fibr(n-2);}
int main(void){printf("%d %d %d\n",sd(98765),pw(3,9),fibr(22));return 0;}
