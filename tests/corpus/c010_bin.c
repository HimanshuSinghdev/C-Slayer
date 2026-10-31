#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void bin(unsigned n){if(n>1)bin(n/2);putchar('0'+n%2);}
int main(void){unsigned t[]={0,1,2,5,255,1024,65535};for(int i=0;i<7;i++){printf("%u = ",t[i]);bin(t[i]);printf("\n");}return 0;}
