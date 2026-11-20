# C-Slayer roadmap — one small step every day

Goal: **Good → Best → Pro**. A day is one finished, tested, pushed improvement (not a pile of half-done ones).

## The daily routine (≈ 30 minutes)
1. `sh tests/daily.sh` — everything green before and after.
2. Pick **one** item from today's theme (below) and finish it.
3. Add a test for it (a corpus program, a UI check, or a gcc comparison).
4. Commit with a one-line message, push, add one line to `CHANGELOG.md`.
5. Every 7th day: a "polish & fix" day — real-phone checklist (`tests/phone_checklist.md`), bug list, no new features.

## Weekly theme rotation
| Day | Theme | Examples of one-day items |
|---|---|---|
| Mon | Compiler correctness | `%a`, `setjmp`/`signal`, statement expressions, struct → variadic, bit-field in Wasm |
| Tue | Speed | function-pointer calls in Wasm, cheaper malloc records, faster printf/strings, Wasm-vs-Turbo choice |
| Wed | Grader & feedback | fairer rules, clearer "why" notes, new probes, per-problem hints |
| Thu | Student experience | helper/autocomplete, error messages in plain words (EN + Hinglish), examples, more problems |
| Fri | UI & motion | polish, accessibility, dark/light, tablet layout, install/offline flow |
| Sat | Learning tools | step-by-step debugger, memory view, "explain this line", practice sets |
| Sun | Polish & fix | phone checklist, bug triage, README/CHANGELOG, dependency-free cleanup |

## Levels (what "done" means)
**Good (now)** — compiles ~everything students write, grades fairly, runs offline on a phone, 0 differences vs gcc on the corpus.
**Best** — 50+ graded practice problems with hidden tests; Wasm covers function pointers and bit-fields; first Run under 2 s on a mid phone; every error message has a plain-words fix; `setjmp`/`signal`/`%a`; one-tap share of a result.
**Pro** — teacher mode (class code, results table, CSV export), assignments with deadlines, multi-file projects, line-by-line visual debugger, 100% of the c-testsuite that makes sense in a browser, public benchmark page vs gcc.

## Backlog (pick from the top of each theme)
- Compiler: `%a`; `setjmp.h`; `signal.h`; statement expressions; `wchar.h`
- Speed: Wasm `CALLI`; `STOREBF`; `atexit`; allocator bookkeeping; stdout buffering
- Grader: integer-overflow note ("`i*i` can exceed `int` at 46341"); per-problem hidden tests; style rules per course
- Student: more problems; "common mistakes" explainer; `scanf` input box per run; saved programs
- Rules: anything new is switchable or easy to revert (`git revert`), and never breaks the test suites.
