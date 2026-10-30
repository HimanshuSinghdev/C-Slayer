#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct Node { int val; struct Node *next; } Node;
typedef struct Tree { int k; struct Tree *l, *r; } Tree;
Node *push(Node *h, int v){ Node *n = malloc(sizeof *n); n->val=v; n->next=h; return n; }
Tree *ins(Tree *t, int k){ if(!t){ t=calloc(1,sizeof *t); t->k=k; return t; } if(k<t->k) t->l=ins(t->l,k); else t->r=ins(t->r,k); return t; }
void inorder(Tree *t){ if(!t) return; inorder(t->l); printf("%d ", t->k); inorder(t->r); }
int height(Tree *t){ if(!t) return 0; int a=height(t->l), b=height(t->r); return 1+(a>b?a:b); }
void freet(Tree *t){ if(!t) return; freet(t->l); freet(t->r); free(t); }
int cmp(const void *a, const void *b){ return *(const int*)a - *(const int*)b; }
int cmps(const void *a, const void *b){ return strcmp(*(char* const*)a, *(char* const*)b); }
int main(void){
  Node *h = NULL; for (int i=1;i<=5;i++) h = push(h, i*i);
  for (Node *p=h;p;p=p->next) printf("%d ", p->val); printf("\n");
  Node *prev=NULL,*cur=h; while(cur){ Node *nx=cur->next; cur->next=prev; prev=cur; cur=nx; } h=prev;
  for (Node *p=h;p;){ printf("%d ", p->val); Node *d=p; p=p->next; free(d); } printf("\n");
  Tree *t = NULL; int ks[] = {50,30,70,20,40,60,80,35}; for (int i=0;i<8;i++) t=ins(t,ks[i]);
  inorder(t); printf("h=%d\n", height(t)); freet(t);
  int *arr = malloc(4*sizeof(int)); int cap=4,n=0; for (int i=0;i<20;i++){ if(n==cap){ cap*=2; arr=realloc(arr,cap*sizeof(int)); } arr[n++]=(i*7)%11; }
  qsort(arr, n, sizeof(int), cmp); for (int i=0;i<n;i++) printf("%d ", arr[i]); printf("\n");
  int key=5; int *f = bsearch(&key, arr, n, sizeof(int), cmp); printf("%d\n", f ? (int)(f-arr) >= 0 : -1);
  free(arr);
  char *w[] = {"pear","apple","fig","banana"}; qsort(w, 4, sizeof(char*), cmps); for (int i=0;i<4;i++) printf("%s ", w[i]); printf("\n");
  int x=10; int *p=&x; int **pp=&p; **pp=20; printf("%d\n", x);
  int m[2][3] = {{1,2,3},{4,5,6}}; int (*row)[3] = m; printf("%d %d\n", row[1][2], (*(row+1))[0]);
  void *vp = &x; printf("%d\n", *(int*)vp);
  int **mat = malloc(3*sizeof(int*)); for (int i=0;i<3;i++){ mat[i]=calloc(3,sizeof(int)); mat[i][i]=1; } int tr=0; for (int i=0;i<3;i++) tr+=mat[i][i]; printf("%d\n", tr); for (int i=0;i<3;i++) free(mat[i]); free(mat);
  char *s = malloc(6); strcpy(s, "hello"); s[0]='J'; printf("%s\n", s); free(s);
  double dd[3] = {1,2,3}; double *dp = dd; dp += 2; printf("%.0f %ld\n", *dp, (long)(dp - dd));
  return 0; }
