#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){enum{N=100};char s[N+1];memset(s,1,sizeof s);s[0]=s[1]=0;for(int i=2;i*i<=N;i++)if(s[i])for(int j=i*i;j<=N;j+=i)s[j]=0;for(int i=0;i<=N;i++)if(s[i])printf("%d ",i);puts("");return 0;}
