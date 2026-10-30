#include <stdio.h>
#include <stdlib.h>
int main(void){ char *line = NULL; size_t cap = 0; ssize_t n; int total = 0; while ((n = getline(&line, &cap, stdin)) != -1) { total += n; printf("%zd:%s", n, line); if (line[n-1] != '\n') printf("\n"); } free(line); printf("%d\n", total); return 0; }
