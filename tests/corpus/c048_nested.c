#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int i=1;i<=5;i++){for(int j=1;j<=i;j++)putchar('*');putchar('\n');}for(int i=5;i>=1;i--){printf("%*s",5-i,"");for(int j=0;j<2*i-1;j++)putchar('#');putchar('\n');}return 0;}
