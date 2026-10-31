#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct P{int x,y,z;};
int main(void){struct P p={.y=5,.x=1};int a[6]={[2]=7,[4]=9};printf("%d %d %d\n",p.x,p.y,p.z);for(int i=0;i<6;i++)printf("%d ",a[i]);puts("");return 0;}
