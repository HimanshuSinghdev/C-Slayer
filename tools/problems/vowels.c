#include <stdio.h>
int main(void){
char s[256];
 if(!fgets(s,sizeof s,stdin)){
puts("0");
return 0;
} int c=0;
 for(char*p=s;
*p;
p++){
char d=*p|32;
 if(d=='a'||d=='e'||d=='i'||d=='o'||d=='u') c++;
} printf("%d\n",c);
 return 0;
}