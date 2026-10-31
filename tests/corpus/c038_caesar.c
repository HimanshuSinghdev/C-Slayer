#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
void enc(char*s,int k){for(;*s;s++){if(isupper((unsigned char)*s))*s='A'+(*s-'A'+k+26)%26;else if(islower((unsigned char)*s))*s='a'+(*s-'a'+k+26)%26;}}
int main(void){char m[]="Hello, World! xyz";enc(m,3);puts(m);enc(m,-3);puts(m);return 0;}
