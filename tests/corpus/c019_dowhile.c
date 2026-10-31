#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n=12345,r=0;do{r=r*10+n%10;n/=10;}while(n);printf("%d\n",r);return 0;}
