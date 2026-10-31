#include <stdio.h>
int f(int a,int b,int c,int d){int r=0;int i,j,k;for(i=0;i<a;i++){for(j=0;j<b;j++){for(k=0;k<c;k++){if(i>j){if(j>k){if(k>d){r+=1;}else{r+=2;}}else{r+=3;}}else{r+=4;}}}}return r;}
int main(void){printf("%d\n",f(5,5,5,1));return 0;}
