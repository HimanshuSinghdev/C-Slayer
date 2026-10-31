#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int n=5;int a[n];for(int i=0;i<n;i++)a[i]=i*i;int s=0;for(int i=0;i<n;i++)s+=a[i];printf("%d %zu\n",s,sizeof a);return 0;}
