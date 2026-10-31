#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char b[64];int n=sprintf(b,"%d-%s-%.1f",42,"x",2.55);printf("%s %d\n",b,n);snprintf(b,8,"%s","truncation test");puts(b);return 0;}
