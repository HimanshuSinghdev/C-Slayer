#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct P{int x,y;};
struct R{struct P a,b;};
int area(struct R r){return(r.b.x-r.a.x)*(r.b.y-r.a.y);}
void mv(struct R*r,int dx){r->a.x+=dx;r->b.x+=dx;}
int main(void){struct R r={{0,0},{4,5}};printf("%d\n",area(r));mv(&r,3);printf("%d %d %d\n",r.a.x,r.b.x,area(r));return 0;}
