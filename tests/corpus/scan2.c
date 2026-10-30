#include <stdio.h>
#include <string.h>
int main(void){
  char line[100]; int ln = 0;
  while (fgets(line, sizeof line, stdin)) { line[strcspn(line, "\n")] = 0; ln++; printf("%d:[%s] len=%zu\n", ln, line, strlen(line)); }
  printf("%d lines\n", ln);
  return 0; }
