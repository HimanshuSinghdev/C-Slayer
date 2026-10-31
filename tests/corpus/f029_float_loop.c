#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
int main(void){double x=0;int c=0;while(x<1.0){x+=0.1;c++;}printf("%d %.17g\n",c,x);float f=0;for(int i=0;i<10;i++)f+=0.1f;printf("%.9g %d\n",f,f==1.0f);return 0;}
