#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int gcd(int a,int b){return b?gcd(b,a%b):a;}
int main(void){printf("%d %d %d\n",gcd(48,18),gcd(17,5),gcd(0,9));printf("lcm %d\n",48/gcd(48,18)*18);return 0;}
