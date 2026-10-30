#include <stdio.h>
int main(void){
  int a[5] = {1,2,3}; int m[3][4]; int idx[10] = {[2]=5, [7]=9};
  for (int i=0;i<5;i++) printf("%d ", a[i]); printf("\n");
  for (int i=0;i<3;i++) for (int j=0;j<4;j++) m[i][j] = i*4+j;
  for (int i=0;i<3;i++){ for (int j=0;j<4;j++) printf("%3d", m[i][j]); printf("\n"); }
  for (int i=0;i<10;i++) printf("%d ", idx[i]); printf("\n");
  printf("%zu %zu %zu\n", sizeof a, sizeof m, sizeof m[0]);
  int n = sizeof a / sizeof a[0]; printf("%d\n", n);
  int *p = a; printf("%d %d %d\n", *p, *(p+1), p[2]);
  int *e = &a[4]; printf("%ld\n", (long)(e - p));
  const char *names[] = {"alpha","beta","gamma"}; for (int i=0;i<3;i++) printf("%s ", names[i]); printf("\n");
  char s[] = "hello"; printf("%zu %zu\n", sizeof s, sizeof "hello");
  int t[2][3] = {{1,2,3},{4,5,6}}; int sum=0; for (int i=0;i<2;i++) for (int j=0;j<3;j++) sum += t[i][j]; printf("%d\n", sum);
  int flat[2][2] = {1,2,3,4}; printf("%d %d\n", flat[1][0], flat[1][1]);
  int vn = 6; int v[vn]; for (int i=0;i<vn;i++) v[i]=i*i; int vs=0; for (int i=0;i<vn;i++) vs+=v[i]; printf("%d %zu\n", vs, sizeof v);
  int grid[3][3] = {0}; grid[1][1]=5; for (int i=0;i<3;i++){ for (int j=0;j<3;j++) printf("%d", grid[i][j]); } printf("\n");
  int bub[] = {5,2,9,1,7,3}; int bn = 6; for (int i=0;i<bn-1;i++) for (int j=0;j<bn-1-i;j++) if (bub[j]>bub[j+1]){ int tmp=bub[j]; bub[j]=bub[j+1]; bub[j+1]=tmp; } for (int i=0;i<bn;i++) printf("%d ", bub[i]); printf("\n");
  char word[6] = {'a','b','c'}; printf("%d %d %d\n", word[3], word[5], (int)sizeof word);
  long long ll[3] = {1LL<<33, 2, 3}; printf("%lld\n", ll[0]+ll[1]+ll[2]);
  double d[3] = {1.5, 2.5}; printf("%.1f %.1f %.1f\n", d[0], d[1], d[2]);
  return 0; }
