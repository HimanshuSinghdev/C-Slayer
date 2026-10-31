#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){char a[8]="seven77";char b[8];strcpy(b,a);b[0]='S';printf("%s %s\n",a,b);char c[4];strncpy(c,"abcdef",3);c[3]=0;puts(c);char d[10]="xx";strncat(d,"yyyyyy",3);puts(d);return 0;}
