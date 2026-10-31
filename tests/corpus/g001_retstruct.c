#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdarg.h>
#include <stddef.h>
#include <limits.h>
#include <float.h>
struct V{double x,y;};
struct V add(struct V a,struct V b){return (struct V){a.x+b.x,a.y+b.y};}
struct V sc(struct V a,double k){a.x*=k;a.y*=k;return a;}
int main(void){struct V r=sc(add((struct V){1,2},(struct V){3,4}),2);printf("%.1f %.1f\n",r.x,r.y);struct V arr[2]={{1,1},{2,2}};struct V t=arr[0];arr[0]=arr[1];arr[1]=t;printf("%.0f %.0f\n",arr[0].x,arr[1].x);return 0;}
