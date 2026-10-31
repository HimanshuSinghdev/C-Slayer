#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct Op{const char*n;double(*f)(double,double);};
double add(double a,double b){return a+b;}double mul(double a,double b){return a*b;}double pw(double a,double b){return pow(a,b);}
int main(void){struct Op ops[]={{"add",add},{"mul",mul},{"pow",pw}};for(int i=0;i<3;i++)printf("%s %.2f\n",ops[i].n,ops[i].f(2.5,3));return 0;}
