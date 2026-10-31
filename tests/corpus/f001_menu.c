#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){int ch,bal=1000;do{printf("1.Dep 2.Wd 3.Bal 0.Exit: ");if(scanf("%d",&ch)!=1)break;int a;switch(ch){case 1:scanf("%d",&a);bal+=a;printf("ok\n");break;case 2:scanf("%d",&a);if(a>bal)printf("insufficient\n");else{bal-=a;printf("ok\n");}break;case 3:printf("balance=%d\n",bal);break;case 0:break;default:printf("bad\n");}}while(ch!=0);return 0;}
