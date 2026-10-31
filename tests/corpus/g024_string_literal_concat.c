#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){const char*s="abc" "def" "ghi";puts(s);printf("%zu\n",strlen("a\0b"));printf("a" "b\n");return 0;}
