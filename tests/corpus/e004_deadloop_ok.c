#include <stdio.h>
int main(void){
  long long total = 0, dead = 0;
  for (long long i = 0; i < 3000; i++) { total += i % 7; dead += i * 3; }
  for (int j = 10; j > 0; j -= 3) dead ^= j;
  for (int k = 0; k < 5; k++) total += k;     /* kept: total is printed */
  printf("%lld\n", total);
  return 0;
}
