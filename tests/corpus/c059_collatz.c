#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int s=1;s<=10;s++){long n=s;int st=0;while(n!=1){n=n%2?3*n+1:n/2;st++;}printf("%d:%d ",s,st);}puts("");return 0;}
