#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int a=7,b=2;printf("%d %d %.2f %.2f\n",a/b,a%b,(double)a/b,(float)a/b);char c=300;unsigned char u=-1;short s=70000;printf("%d %d %d\n",c,u,s);printf("%d\n",(int)3.99);printf("%d\n",(int)-3.99);return 0;}
