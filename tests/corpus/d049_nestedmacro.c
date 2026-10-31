#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
#define A 3
#define B (A+2)
#define SW(a,b) do{int t=a;a=b;b=t;}while(0)
#define LOG(...) printf(__VA_ARGS__)
int main(void){int x=1,y=2;SW(x,y);LOG("%d %d %d\n",x,y,B*2);
#ifdef A
puts("A def");
#else
puts("no");
#endif
#if B>4
puts("big");
#endif
return 0;}
