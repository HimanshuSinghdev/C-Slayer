#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int pal(const char*s){int i=0,j=strlen(s)-1;while(i<j){while(i<j&&!isalnum((unsigned char)s[i]))i++;while(i<j&&!isalnum((unsigned char)s[j]))j--;if(tolower((unsigned char)s[i])!=tolower((unsigned char)s[j]))return 0;i++;j--;}return 1;}
int main(void){const char*t[]={"A man, a plan, a canal: Panama","hello","racecar","",  "No lemon, no melon"};for(int i=0;i<5;i++)printf("\"%s\" -> %s\n",t[i],pal(t[i])?"yes":"no");return 0;}
