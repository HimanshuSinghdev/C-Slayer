#include <stdio.h>
struct V{union{struct{float x;float y;};float raw[2];};};
struct V g={.x=5.0f,.y=10.0f};
int main(void){struct V v={.x=5.0f,.y=10.0f};struct V w={1,2};struct V u={.raw={3,4}};printf("%.1f %.1f %.1f | %.1f %.1f | %.1f %.1f | %.1f %.1f\n",v.x,v.y,v.raw[1],w.x,w.y,u.x,u.y,g.x,g.y);return 0;}
