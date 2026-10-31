#include <stdio.h>
int main(void){
    int a[5];
    for (int i = 0; i <= 5; i++) a[i] = i;
    printf("%d\n", a[4]);
    return 0;
}
