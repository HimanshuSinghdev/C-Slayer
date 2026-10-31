#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){double c;while(scanf("%lf",&c)==1)printf("%.1fC = %.1fF = %.1fK\n",c,c*9/5+32,c+273.15);return 0;}
