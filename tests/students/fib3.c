#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    scanf("%d", &n);
    if (n < 0) return 1;
    
    int* arr = (int*)malloc((n+1) * sizeof(int));
    arr[0] = 0;
    if (n > 0) arr[1] = 1;
    
    for(int i = 2; i <= n; i++) {
        arr[i] = arr[i-1] + arr[i-2];
    }
    printf("%d", arr[n]);
    return 0;
}
