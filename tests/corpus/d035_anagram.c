#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int an(const char*a,const char*b){int c[26]={0};for(;*a;a++)if(isalpha((unsigned char)*a))c[tolower((unsigned char)*a)-'a']++;for(;*b;b++)if(isalpha((unsigned char)*b))c[tolower((unsigned char)*b)-'a']--;for(int i=0;i<26;i++)if(c[i])return 0;return 1;}
int main(void){printf("%d %d %d\n",an("Listen","Silent"),an("abc","abd"),an("Dormitory","dirty room"));return 0;}
