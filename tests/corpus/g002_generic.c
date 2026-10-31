#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
#define T(x) _Generic((x),int:"int",double:"double",char*:"str",default:"other")
int main(void){int i=0;double d=0;char*s="";printf("%s %s %s %s\n",T(i),T(d),T(s),T(1.5f));return 0;}
