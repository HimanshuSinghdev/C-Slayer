#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int g=10;
void f(void){g*=2;}
int main(void){f();f();printf("%d\n",g);{int g=1;printf("%d\n",g);}printf("%d\n",g);return 0;}
