#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
#define B 7
struct E{char k[8];int v;struct E*n;};struct E*t[B];
unsigned h(const char*s){unsigned x=5381;while(*s)x=x*33+(unsigned char)*s++;return x%B;}
void put(const char*k,int v){struct E*e=malloc(sizeof*e);strcpy(e->k,k);e->v=v;e->n=t[h(k)];t[h(k)]=e;}
int get(const char*k){for(struct E*e=t[h(k)];e;e=e->n)if(!strcmp(e->k,k))return e->v;return -1;}
int main(void){put("one",1);put("two",2);put("three",3);put("four",4);printf("%d %d %d %d\n",get("one"),get("three"),get("nine"),get("four"));return 0;}
