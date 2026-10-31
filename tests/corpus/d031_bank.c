#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
struct A{int id;double bal;};
int wd(struct A*a,double x){if(x>a->bal)return 0;a->bal-=x;return 1;}
int main(void){struct A a={1,100.5};printf("%d %d\n",wd(&a,50),wd(&a,60));printf("%.2f\n",a.bal);return 0;}
