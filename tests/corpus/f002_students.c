#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
struct S{char n[20];int m[3];double avg;};
int main(void){int n;scanf("%d",&n);struct S s[10];for(int i=0;i<n;i++){scanf("%19s %d %d %d",s[i].n,&s[i].m[0],&s[i].m[1],&s[i].m[2]);s[i].avg=(s[i].m[0]+s[i].m[1]+s[i].m[2])/3.0;}int b=0;for(int i=1;i<n;i++)if(s[i].avg>s[b].avg)b=i;for(int i=0;i<n;i++)printf("%-10s %6.2f\n",s[i].n,s[i].avg);printf("top: %s\n",s[b].n);return 0;}
