#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){char w[64];char words[50][64];int cnt[50]={0};int n=0;while(scanf("%63s",w)==1){for(char*p=w;*p;p++)*p=tolower((unsigned char)*p);int f=-1;for(int i=0;i<n;i++)if(!strcmp(words[i],w)){f=i;break;}if(f<0){strcpy(words[n],w);f=n++;}cnt[f]++;}for(int i=0;i<n;i++)printf("%s %d\n",words[i],cnt[i]);return 0;}
