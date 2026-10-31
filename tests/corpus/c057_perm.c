#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void p(char*s,int l,int r){if(l==r){puts(s);return;}for(int i=l;i<=r;i++){char t=s[l];s[l]=s[i];s[i]=t;p(s,l+1,r);t=s[l];s[l]=s[i];s[i]=t;}}
int main(void){char s[]="abc";p(s,0,2);return 0;}
