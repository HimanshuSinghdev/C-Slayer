#include <stdio.h>
#include <stdbool.h>
#include <stdint.h>
#define SQUARE(x) ((x)*(x))
#define MAX(a,b) ((a)>(b)?(a):(b))
#define N 8
const int K = 7; int G = 100; static int S = 5; int garr[N]; char gs[] = "global"; double gd = 2.5;
int *gp = &G;
bool is_even(int n){ return n%2==0; }
int main(void){
  printf("%d %d %d\n", SQUARE(3+1), MAX(4,9), N*2);
  printf("%d %d %d %s %.1f %d\n", K, G, S, gs, gd, *gp);
  for (int i=0;i<N;i++) garr[i]=i*i; int s=0; for (int i=0;i<N;i++) s+=garr[i]; printf("%d\n", s);
  printf("%d %d\n", is_even(4), is_even(7));
  uint8_t u8 = 250; u8 += 10; int16_t i16 = 32767; i16++; uint32_t u32 = 0; u32--; int64_t i64 = (int64_t)1 << 50;
  printf("%u %d %u %lld\n", u8, i16, u32, (long long)i64);
  printf("%zu %zu %zu %zu %zu\n", sizeof(char), sizeof(short), sizeof(int), sizeof(long), sizeof(double));
  printf("%zu %zu\n", sizeof(void*), sizeof(long long));
  long total=0; for (int i=0;i<3000000;i++) total += i & 7; printf("%ld\n", total);
  printf("%s %d\n", __FILE__ != 0 ? "file" : "nofile", __LINE__);
  int x = 5; x += 3; printf("%d\n", x);
  char c = 'a'; c += 2; printf("%c\n", c);
  unsigned char uc = 255; uc++; printf("%d\n", uc);
  printf("%d\n", (int)sizeof(bool));
  return 0; }
