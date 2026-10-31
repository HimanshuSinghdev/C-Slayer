#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int main(void){unsigned u=1;int i=-1;printf("%d %d %d\n",i<u,i<(int)u,(long)i<(long)u);size_t n=0;n--;printf("%d\n",n>0);for(unsigned k=3;k<4;k--){printf("%u ",k);if(k==0)break;}puts("");return 0;}
