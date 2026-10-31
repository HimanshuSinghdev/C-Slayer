#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>
#include <stdint.h>
#include <stdbool.h>
int main(void){int a[2][3]={{1,2,3},{4,5,6}},t[3][2];for(int i=0;i<2;i++)for(int j=0;j<3;j++)t[j][i]=a[i][j];for(int i=0;i<3;i++){for(int j=0;j<2;j++)printf("%d ",t[i][j]);puts("");}return 0;}
