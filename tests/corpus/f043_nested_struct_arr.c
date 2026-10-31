#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct Item{char n[12];int q;double p;};struct Order{int id;struct Item it[3];int n;};
double total(const struct Order*o){double t=0;for(int i=0;i<o->n;i++)t+=o->it[i].q*o->it[i].p;return t;}
int main(void){struct Order o={7,{{"pen",10,1.5},{"book",2,12.25},{"bag",1,30}},3};printf("%d %.2f\n",o.id,total(&o));return 0;}
