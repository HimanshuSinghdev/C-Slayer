#include <stdio.h>
#include <stdlib.h>

#define MAX_ITEMS 100

/* Computes the average of n integers; returns 0 for n <= 0. */
static double average(const int *values, int n)
{
    if (values == NULL || n <= 0) {
        return 0.0;
    }
    long total = 0;
    for (int i = 0; i < n; i++) {
        total += values[i];
    }
    return (double)total / n;
}

int main(void)
{
    int count = 0;
    printf("How many numbers (1-%d)? ", MAX_ITEMS);
    if (scanf("%d", &count) != 1 || count < 1 || count > MAX_ITEMS) {
        fprintf(stderr, "Invalid count\n");
        return 1;
    }
    int *data = malloc((size_t)count * sizeof *data);
    if (data == NULL) {
        fprintf(stderr, "Out of memory\n");
        return 1;
    }
    for (int i = 0; i < count; i++) {
        if (scanf("%d", &data[i]) != 1) {
            fprintf(stderr, "Bad input\n");
            free(data);
            return 1;
        }
    }
    printf("Average: %.2f\n", average(data, count));
    free(data);
    return 0;
}
