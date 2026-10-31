#include <stdio.h>
#include <stdlib.h>
int main(void){
    int *p = malloc(40);
    for (int i = 0; i < 10; i++) p[i] = i;
    int *q = malloc(80);
    printf("%d\n", p[3]);
    free(p);
    return 0;
}
