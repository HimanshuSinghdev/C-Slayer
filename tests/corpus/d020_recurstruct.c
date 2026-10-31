#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct N{int v;struct N*ch[3];};
int cnt(struct N*n){if(!n)return 0;int c=1;for(int i=0;i<3;i++)c+=cnt(n->ch[i]);return c;}
int main(void){struct N a={1,{0}},b={2,{0}},c={3,{&a,&b,0}};printf("%d\n",cnt(&c));return 0;}
