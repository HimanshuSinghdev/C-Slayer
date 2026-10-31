#include <stdio.h>
struct In{int a,b;};struct Out{struct In i;int arr[3];struct In ia[2];};
int main(void){struct Out o={.i.b=7,.arr[1]=5,.ia[1].a=9,.i.a=2};printf("%d %d %d %d %d %d\n",o.i.a,o.i.b,o.arr[1],o.ia[1].a,o.ia[0].a,o.arr[0]);return 0;}
