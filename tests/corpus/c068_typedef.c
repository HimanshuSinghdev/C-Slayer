#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
typedef struct{char n[10];int a;}Person;typedef int(*Op)(int);
int dbl(int x){return 2*x;}
int main(void){Person p={"Zed",30};Op o=dbl;printf("%s %d %d\n",p.n,p.a,o(21));return 0;}
