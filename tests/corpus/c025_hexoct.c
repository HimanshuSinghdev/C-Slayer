#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int n=255;printf("%x %X %o %#x %#o %08.3f %+d %e\n",n,n,n,n,n,3.14159,n,12345.678);printf("%5s|%-5s|%.2s\n","ab","cd","efgh");printf("%c%c%c\n",72,105,33);return 0;}
