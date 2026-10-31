#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a;char c;float f;char s[20];int n=scanf("%d %c %f %19s",&a,&c,&f,s);printf("%d: %d %c %.2f %s\n",n,a,c,f,s);return 0;}
