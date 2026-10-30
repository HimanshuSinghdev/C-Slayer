#include <stdio.h>
#include <stdint.h>
int main(void){
  printf("[%5d][%-5d][%05d][%+d][% d]\n", 42, 42, 42, 42, 42);
  printf("[%5d][%-5d][%05d][%+d]\n", -42, -42, -42, -42);
  printf("[%x][%X][%#x][%08x][%o]\n", 48879, 48879, 48879, 48879, 64);
  printf("[%c][%5c][%-5c]\n", 'a', 'b', 'c');
  printf("[%s][%8s][%-8s][%.2s]\n", "hello", "hi", "hi", "hello");
  printf("[%u][%u]\n", -1, 4294967295u);
  printf("[%ld][%lld][%lu][%zu]\n", -5L, 1LL<<62, 3000000000UL, sizeof(int));
  printf("[%hd][%hhd][%hu]\n", 70000, 300, 70000);
  printf("[%*d][%-*d][%.*f]\n", 6, 7, 6, 7, 2, 3.14159);
  printf("[%5.1f][%-8.3f][%08.2f]\n", 2.25, 2.25, -2.25);
  printf("[%e][%E][%g][%G]\n", 12345.6789, 0.000123, 1e-10, 1e20);
  printf("%d%%\n", 50);
  printf("[%.3d][%.0d][%5.3d]\n", 5, 0, 7);
  printf("[%i]\n", 077);
  printf("%d %d\n", INT8_MAX, (int)UINT16_MAX);
  printf("%s\n", "tab\there \"quoted\" back\\slash");
  printf("[%10.3e]\n", 1234.5678);
  printf("[%-+6d][%+06d]\n", 5, 5);
  printf("[%#o][%#X]\n", 8, 255);
  printf("%lld %llu\n", -9223372036854775807LL-1, 18446744073709551615ULL);
  printf("%c%c%c\n", 72, 105, 33);
  int n = printf("abc\n"); printf("%d\n", n);
  puts("puts line"); putchar('Z'); putchar('\n');
  return 0; }
