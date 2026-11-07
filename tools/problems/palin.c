#include <stdio.h>
#include <string.h>
int main(void){
char s[101];
 if(scanf("%100s",s)!=1) return 1;
 int n=strlen(s),ok=1;
 for(int i=0;
i<n/2;
i++) if(s[i]!=s[n-1-i]) ok=0;
 puts(ok?"Yes":"No");
 return 0;
}