#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
const char*next(void){static int i=0;static const char*w[]={"a","b","c"};return w[i++%3];}
int main(void){for(int i=0;i<7;i++)printf("%s",next());puts("");return 0;}
