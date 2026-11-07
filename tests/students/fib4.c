#include <stdio.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1 || n < 0) {
        return 1;
    }

    if (n == 0) {
        printf("0\n");
        return 0;
    }

    long long a = 0, b = 1, next;
    for (int i = 2; i <= n; i++) {
        next = a + b;
        a = b;
        b = next;
    }
    
    printf("%lld\n", b);
    return 0;
}
