#include <stdio.h>

int main() {
    int n, a = 0, b = 1, next;
    scanf("%d", &n);
    
    for(int i = 2; i <= n; i++) {
        next = a + b;
        a = b;
        b = next;
    }
    printf("%d", next);
    return 0;
}
