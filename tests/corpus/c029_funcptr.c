#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int add(int a,int b){return a+b;}int mul(int a,int b){return a*b;}int sub(int a,int b){return a-b;}
int main(void){int(*f[])(int,int)={add,mul,sub};const char*n[]={"add","mul","sub"};for(int i=0;i<3;i++)printf("%s(7,3)=%d\n",n[i],f[i](7,3));return 0;}
