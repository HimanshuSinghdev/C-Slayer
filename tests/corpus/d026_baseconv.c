#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
void cv(unsigned n,int b){char d[40];int i=0;if(!n)d[i++]='0';while(n){d[i++]="0123456789ABCDEF"[n%b];n/=b;}while(i--)putchar(d[i]);puts("");}
int main(void){cv(255,2);cv(255,8);cv(255,16);cv(0,2);cv(4095,16);return 0;}
