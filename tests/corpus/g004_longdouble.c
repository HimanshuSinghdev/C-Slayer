#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){long double x=1.0L/3;printf("%.15Lf %zu\n",x,sizeof x);double d=DBL_MAX;printf("%d %d\n",d>1e300,DBL_DIG);printf("%g %g\n",FLT_EPSILON>0?1.0:0.0,(double)((double)FLT_MAX>1e38));return 0;}
