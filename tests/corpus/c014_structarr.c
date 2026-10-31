#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct S{char name[16];int mark;float avg;};
int cmp(const void*a,const void*b){return ((const struct S*)b)->mark-((const struct S*)a)->mark;}
int main(void){struct S s[]={{"Asha",82,3.5f},{"Ben",95,3.9f},{"Chitra",67,2.8f},{"Dev",88,3.1f}};qsort(s,4,sizeof s[0],cmp);for(int i=0;i<4;i++)printf("%-8s %3d %.2f\n",s[i].name,s[i].mark,s[i].avg);return 0;}
