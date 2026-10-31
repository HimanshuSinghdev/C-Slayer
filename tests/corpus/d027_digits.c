#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){long n=9876543210L;int c[10]={0};while(n){c[n%10]++;n/=10;}for(int i=0;i<10;i++)printf("%d",c[i]);puts("");return 0;}
