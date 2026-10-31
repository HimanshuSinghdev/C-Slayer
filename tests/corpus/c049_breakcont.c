#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){for(int i=0;i<20;i++){if(i%3==0)continue;if(i>14)break;printf("%d ",i);}puts("");return 0;}
