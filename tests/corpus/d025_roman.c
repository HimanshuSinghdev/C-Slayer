#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void rom(int n){int v[]={1000,900,500,400,100,90,50,40,10,9,5,4,1};const char*s[]={"M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"};for(int i=0;i<13;i++)while(n>=v[i]){printf("%s",s[i]);n-=v[i];}puts("");}
int main(void){rom(1994);rom(2024);rom(49);return 0;}
