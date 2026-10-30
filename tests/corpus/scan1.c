#include <stdio.h>
int main(void){
  int n; double d; char name[32]; char c;
  if (scanf("%d %lf %31s", &n, &d, name) != 3) { printf("bad\n"); return 1; }
  printf("%d %.2f %s\n", n, d, name);
  scanf(" %c", &c); printf("[%c]\n", c);
  int sum = 0, v, count = 0; while (scanf("%d", &v) == 1) { sum += v; count++; }
  printf("%d %d\n", count, sum);
  return 0; }
