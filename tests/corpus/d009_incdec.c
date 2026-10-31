#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int i=5;int a=i++ + ++i;printf("%d\n",i);int j=3;j+=j++>0?0:0;int k=10;int arr[3]={0};int idx=0;arr[idx++]=idx;printf("%d %d\n",a>0,arr[0]>=0);k=i--;printf("%d %d\n",k,i);return 0;}
