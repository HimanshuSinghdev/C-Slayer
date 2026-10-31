#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){for(int n=2;n<10000;n++){int s=1;for(int i=2;i*i<=n;i++)if(n%i==0){s+=i;if(i!=n/i)s+=n/i;}if(s==n)printf("%d ",n);}puts("");return 0;}
