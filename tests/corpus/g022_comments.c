#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){/* block */int x=1;// line
/* multi
line */ x+=2; // done
printf("%d /* not comment */ %d\n",x,'/'==47);return 0;}
