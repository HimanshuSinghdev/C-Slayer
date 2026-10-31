#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
enum Color{RED,GREEN=5,BLUE};
const char*nm[]={"r","g","b"};
int main(void){enum Color c=GREEN;printf("%d %d %d\n",RED,c,BLUE);switch(c){case RED:puts("red");break;case GREEN:puts("green");break;default:puts("other");}return 0;}
