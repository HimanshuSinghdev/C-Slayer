#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct P{int x,y;};
int sum(struct P p){return p.x+p.y;}
int main(void){printf("%d\n",sum((struct P){3,4}));int*a=(int[]){1,2,3};printf("%d\n",a[1]+a[2]);return 0;}
