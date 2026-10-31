#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){double a,b,c;scanf("%lf %lf %lf",&a,&b,&c);if(a+b>c&&a+c>b&&b+c>a){double s=(a+b+c)/2;printf("area %.3f\n",sqrt(s*(s-a)*(s-b)*(s-c)));if(a==b&&b==c)puts("equilateral");else if(a==b||b==c||a==c)puts("isosceles");else puts("scalene");}else puts("invalid");return 0;}
