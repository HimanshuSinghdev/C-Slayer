#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int leap(int y){return(y%4==0&&y%100!=0)||y%400==0;}
int main(void){int ys[]={1900,2000,2023,2024,2100};for(int i=0;i<5;i++)printf("%d %s\n",ys[i],leap(ys[i])?"leap":"common");return 0;}
