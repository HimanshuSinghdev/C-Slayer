#include <stdio.h>
#include <stdlib.h>
int main(void){ srand(1); for (int i=0;i<5;i++) printf("%d ", rand()); printf("\n"); srand(42); for (int i=0;i<5;i++) printf("%d ", rand()%100); printf("\n"); printf("%d\n", rand()); srand(12345); int r1 = rand(); int r2 = rand(); printf("%d %d\n", r1, r2); return 0; }
