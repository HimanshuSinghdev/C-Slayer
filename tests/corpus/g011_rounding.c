#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){printf("%.0f %.0f %.0f %.0f\n",0.5,1.5,2.5,3.5);printf("%.1f %.1f %.2f\n",0.05,0.15,1.005);printf("%d %d %d\n",(int)2.9999999,(int)-0.5,(int)1e9);printf("%.3g %.3g %g\n",0.0001234,123456.0,1e-10);return 0;}
