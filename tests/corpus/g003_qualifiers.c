#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int sum(const int*restrict a,int n){int s=0;for(register int i=0;i<n;i++)s+=a[i];return s;}
static inline int sq(int x){return x*x;}
int main(void){volatile int v=3;const int a[]={1,2,3};printf("%d %d\n",sum(a,3),sq(v));return 0;}
