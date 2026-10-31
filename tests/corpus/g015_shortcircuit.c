#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
int cnt=0;int f(int x){cnt++;return x;}
int main(void){int r=f(0)&&f(1);int s=f(1)||f(1);int t=f(1)&&f(0)||f(1);printf("%d %d %d %d\n",r,s,t,cnt);return 0;}
