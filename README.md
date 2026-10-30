# C·Slayer

A C compiler, runner and **1–10 grader** that lives entirely in your browser. No server, no install — host the folder on GitHub Pages and it works on a phone, offline (PWA).

## How it works
`lexer → preprocessor → parser → type-checked bytecode compiler → sandboxed virtual machine` (running in a Web Worker).
The VM is a sanitizer: out-of-bounds reads/writes, use-after-free, double free, stack overflow, null dereference, divide-by-zero, runaway loops/output and memory leaks are all caught and reported with the offending line. Programs can read the keyboard live (`scanf`, `fgets`, `getchar`) and use an in-memory file system (`fopen`…).

Compiler diagnostics mimic `gcc -Wall`: implicit declarations, format-string mismatches, uninitialised or unused variables, missing returns, returning addresses of locals, constant out-of-bounds indexes, and more.

## The score (1–10)
| Part | Points |
|---|---|
| Runs without crashing (no memory errors, timeouts, leaks) | 3 |
| Correct output (teacher/student test cases; otherwise estimated from a clean run) | 2.5 |
| Compiler warnings | 1.5 |
| Safe practices (unchecked `malloc`/`scanf`, unbounded `strcpy`/`%s`, `gets`) | 1 |
| Style (indentation, comments, naming, line length) | 1 |
| Structure (function size, nesting depth, `goto`, globals) | 1 |

A program that does not compile scores 1–2; a program that crashes is capped at 6. Add test cases in the **Tests** tab for an exact correctness grade.

## Security
* No `eval`, no `new Function`, no network calls, no third-party requests: everything (CodeMirror, fonts) is vendored.
* Strict Content-Security-Policy (`script-src 'self'`; no inline scripts or styles).
* Student code never runs as JavaScript — it is compiled to bytecode and interpreted in a Worker with hard limits: step/time budget, 24 MB heap, 8 MB stack, 2 MB output, 400 KB source, bounded preprocessor expansion and nesting depth.
* All program output is inserted with `textContent` (no HTML injection). Compiler tables are `Map`s (no prototype pollution). `%n` is ignored.
* Tested with fuzzing (random token soup, deep nesting, macro bombs, huge allocations).

"Zero vulnerabilities" can't be promised by anyone for any software; this design removes the usual classes (code injection, XSS, server-side attacks) by having no server and no dynamic JS execution. Please report anything you find.

## Not supported (yet)
User-defined variadic functions (`va_list`), `long double` precision beyond `double`, threads, `fork`/sockets, `#include "local.h"`.
Arguments are evaluated left-to-right (gcc evaluates right-to-left); code that depends on this is undefined behaviour anyway.

## Deploy
Upload the folder to a GitHub repo → Settings → Pages → branch `main`, root. Open the URL on your phone and "Add to Home screen".

## Develop
`node tests/diff.js` compares output with real `gcc` on `tests/corpus/*.c`; `node tests/rt.js` checks runtime-error detection; `node tests/fuzz.js` runs the fuzzers.
