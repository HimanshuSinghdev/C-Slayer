#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#define SQ(x) ((x)*(x))
#define MAX(a,b) ((a)>(b)?(a):(b))
#define STR(x) #x
#define CAT(a,b) a##b
int main(void){int CAT(v,1)=5;printf("%d %d %s %d\n",SQ(3+1),MAX(2,9),STR(hello),v1);return 0;}
