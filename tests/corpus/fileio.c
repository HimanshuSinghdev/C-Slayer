#include <stdio.h>
#include <string.h>
int main(void){
  FILE *f = fopen("data.txt", "w"); if (!f) return 1;
  for (int i=1;i<=4;i++) fprintf(f, "%d %s\n", i*10, "row"); fputs("tail\n", f); fclose(f);
  f = fopen("data.txt", "r"); char line[64]; while (fgets(line, sizeof line, f)) printf("> %s", line); fclose(f);
  f = fopen("data.txt", "r"); int a; char w[10]; int tot=0; while (fscanf(f, "%d %9s", &a, w) == 2) tot += a; printf("%d\n", tot); fclose(f);
  f = fopen("data.txt", "a"); fprintf(f, "appended\n"); fclose(f);
  f = fopen("data.txt", "r"); fseek(f, 0, SEEK_END); printf("%ld\n", ftell(f)); rewind(f); int c, n=0; while ((c=fgetc(f))!=EOF) n++; printf("%d %d\n", n, feof(f)!=0); fclose(f);
  f = fopen("nope.txt", "r"); printf("%d\n", f == NULL);
  return 0; }
