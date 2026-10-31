#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){const char*w[]={"","a","hello","The quick brown fox"};for(int i=0;i<4;i++){size_t n=0;while(w[i][n])n++;printf("%zu=%zu ",n,strlen(w[i]));}puts("");return 0;}
