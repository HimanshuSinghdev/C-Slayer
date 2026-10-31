#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <limits.h>
int main(void){printf("%d %d %u\n",INT_MAX,INT_MIN,UINT_MAX);printf("%ld %lld\n",LONG_MAX,LLONG_MIN);printf("%zu %zu %zu %zu\n",sizeof(char),sizeof(short),sizeof(int),sizeof(double));return 0;}
