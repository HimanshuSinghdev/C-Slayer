#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){printf("[%*d][%-*d][%.*f]\n",6,42,6,42,2,3.14159);printf("[%*s]\n",-8,"ab");return 0;}
