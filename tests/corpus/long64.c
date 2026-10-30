#include <stdio.h>
#include <stdint.h>
#include <limits.h>
#include <stdlib.h>
long long fact(int n){ return n<=1 ? 1 : n*fact(n-1); }
unsigned long long hash(const char*s){ unsigned long long h=1469598103934665603ULL; while(*s){ h^=(unsigned char)*s++; h*=1099511628211ULL; } return h; }
int main(void){
  long long a=9007199254740991LL, b=9007199254740993LL;
  printf("%lld %lld %lld\n", a, a+1, a+2);
  printf("%lld %lld\n", b, b*2);
  for (int i=1;i<=25;i++) printf("%lld ", fact(i)); printf("\n");
  printf("%llu\n", hash("hello world"));
  long long mx=LLONG_MAX, mn=LLONG_MIN; printf("%lld %lld %lld %lld\n", mx, mn, mx+1, mn-1);
  printf("%lld %lld\n", mn/ -2, mx%1000);
  unsigned long long u=ULLONG_MAX; printf("%llu %llu %llu\n", u, u+1, u*u);
  printf("%llu %llu\n", u>>1, u<<4);
  printf("%lld %lld %lld\n", -17LL/5, -17LL%5, 17LL/-5);
  printf("%lld %lld\n", 1LL<<62, (1LL<<62)>>61);
  printf("%lld %lld\n", -1LL>>10, -1000000000000LL>>3);
  printf("%lld %lld %lld\n", 0xFFFFFFFFLL & 0xF0F0F0F0LL, 0x123456789ABLL | 1, 0x123456789ABLL ^ 0xFFF);
  printf("%llx %llX\n", 0xDEADBEEFCAFEBABEULL, 0xDEADBEEFULL<<20);
  printf("%lld\n", ~0LL); printf("%llu\n", ~0ULL);
  printf("%lld %llu\n", -a, -(unsigned long long)a);
  int i=-5; unsigned long long ui=i; long long li=i; printf("%llu %lld\n", ui, li);
  unsigned int x=4000000000u; long long lx=x; printf("%lld %lld\n", lx*lx, (long long)(int)x);
  long long sum=0; for (long long k=1;k<=2000000;k++) sum+=k*k; printf("%lld\n", sum);
  uint64_t f0=0,f1=1; for(int k=0;k<93;k++){ uint64_t t=f0+f1; f0=f1; f1=t; } printf("%llu\n", f0);
  printf("%d %d\n", (int)(5000000000LL), (int)(-5000000000LL));
  printf("%d %d %d\n", a<b, a==b-2, mx>mn);
  printf("%lld\n", (long long)3.99e15); printf("%.0f\n", (double)b);
  printf("%ld %lu\n", labs(-5L), (unsigned long)sizeof(long));
  long arr[3]={1L<<40, -(1L<<40), 5}; printf("%ld %ld\n", arr[0]+arr[1], arr[0]*arr[2]);
  switch ((long long)(1LL<<40)) { case 1LL<<40: puts("big case"); break; default: puts("no"); }
  printf("%lld\n", strtoll("-9223372036854775808", NULL, 10)); printf("%lld\n", atoll("123456789012"));
  size_t n = 0; n--; printf("%zu\n", n);
  return 0; }
