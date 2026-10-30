#include <stdio.h>
#include <string.h>
typedef struct { int x, y; } Pt;
typedef struct { double re, im; } Cx;
int fact(int n){ return n<=1 ? 1 : n*fact(n-1); }
int fib(int n){ return n<2 ? n : fib(n-1)+fib(n-2); }
int gcd(int a,int b){ return b==0 ? a : gcd(b, a%b); }
int ack(int m,int n){ return m==0 ? n+1 : (n==0 ? ack(m-1,1) : ack(m-1, ack(m, n-1))); }
int counter(void){ static int c = 0; return ++c; }
int apply(int (*f)(int,int), int a, int b){ return f(a,b); }
int add(int a,int b){ return a+b; } int mul(int a,int b){ return a*b; }
Pt mk(int x,int y){ Pt p = {x,y}; return p; }
Pt addp(Pt a, Pt b){ Pt r = {a.x+b.x, a.y+b.y}; return r; }
Cx cmul(Cx a, Cx b){ Cx r; r.re=a.re*b.re-a.im*b.im; r.im=a.re*b.im+a.im*b.re; return r; }
void swap(int *a,int *b){ int t=*a; *a=*b; *b=t; }
long power(long b, int e){ long r=1; while(e--) r*=b; return r; }
double avg(int *a, int n){ double s=0; for(int i=0;i<n;i++) s+=a[i]; return s/n; }
void fill(char *s, int n, char c){ for(int i=0;i<n;i++) s[i]=c; s[n]=0; }
int sum_to(int n){ return n==0 ? 0 : n + sum_to(n-1); }
static int sq(int x){ return x*x; }
int main(void){
  printf("%d %d %d %d\n", fact(10), fib(20), gcd(84, 36), ack(2,3));
  counter(); counter(); printf("%d\n", counter());
  printf("%d %d\n", apply(add, 3, 4), apply(mul, 3, 4));
  int (*ops[2])(int,int) = {add, mul}; printf("%d\n", ops[1](5,6));
  Pt p = mk(1,2), q = addp(p, mk(10,20)); printf("%d %d\n", q.x, q.y);
  Cx z = cmul((Cx){1,2}, (Cx){3,4}); printf("%.1f %.1f\n", z.re, z.im);
  int a=1,b=2; swap(&a,&b); printf("%d %d\n", a, b);
  printf("%ld\n", power(3, 20));
  int arr[] = {1,2,3,4}; printf("%.2f\n", avg(arr, 4));
  char buf[8]; fill(buf, 5, 'z'); printf("%s %zu\n", buf, strlen(buf));
  printf("%d %d\n", sum_to(1000), sq(12));
  return 0; }
