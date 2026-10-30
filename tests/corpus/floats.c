#include <stdio.h>
#include <math.h>
int main(void){
  double d[] = {0.0, 1.0, -1.5, 3.14159265358979, 2.5, 3.5, 0.5, 1e10, 1.23456789e-5, 123456789.123456789, 1e100, 0.1, 100.0, 1.0/3.0};
  for (int i=0;i<(int)(sizeof d/sizeof d[0]);i++){
    printf("%f|%.2f|%.0f|%e|%.3e|%g|%.10g|%8.3f|%-10.1f|%+.1f\n", d[i], d[i], d[i], d[i], d[i], d[i], d[i], d[i], d[i], d[i]);
  }
  float f = 1.1f; printf("%f %f %.10f\n", f, f*3, (double)f);
  printf("%g %g %g %g\n", 100000.0, 1000000.0, 1e-4, 1e-5);
  printf("%.2f %.2f %.2f\n", 0.005, 0.015, 0.025);
  printf("%f %f\n", sqrt(2.0), pow(2.0, 10.0));
  printf("%f %f %f\n", sin(1.0), cos(1.0), atan2(1.0, 2.0));
  printf("%f %f %f %f\n", floor(-2.5), ceil(-2.5), round(-2.5), trunc(-2.5));
  printf("%f %f\n", fabs(-3.5), fmod(7.5, 2.0));
  printf("%f %f %f\n", exp(1.0), log(10.0), log10(1000.0));
  printf("%d %d\n", (int)round(2.5), (int)round(-0.4));
  double z = 0.0; printf("%f %f %f\n", 1.0/z, -1.0/z, z/z == z/z ? 1.0 : 0.0);
  printf("%5.1f%%\n", 45.678);
  double sum = 0; for (int i=1;i<=100;i++) sum += 1.0/i; printf("%.12f\n", sum);
  printf("%10.4f|%-10.4f|%010.4f\n", 3.14159, 3.14159, 3.14159);
  printf("%.15g %.17g\n", 0.1, 0.1);
  return 0; }
