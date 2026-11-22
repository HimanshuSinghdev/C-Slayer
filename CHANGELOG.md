# Changelog

- 2026-11-23: bug sweep — 500 more fuzz programs clean; Fix it no longer offers to delete an unused variable whose initializer calls a function; interactive-input end-to-end test; phone checklist updated.
- 2026-11-22: Explain line — a card that explains the line under the cursor in plain English or Hinglish (menu switch).
- 2026-11-22: live check — problems and Fix it buttons appear while typing (menu switch: Live check).
- 2026-11-22: "Fix it" buttons in Problems (missing ;, #include, scanf &, printf %d/%lld/%f, void main, gets, = vs ==, unused variable, misspelled function), each tested by recompiling.
- 2026-11-21: the credit signature writes itself letter by letter in a loop (part of the animation switch).
- 2026-11-21: int-overflow note after Run and in the grade; Wasm wide-constant fix (found by fuzzing).
- 2026-11-21: roadmap + daily check (`sh tests/daily.sh`).
- 2026-11-17: fairer grading (no marks lost for missing tests; EOF-spinning loops are a small deduction), smarter code helper, conio.h, faster first start.
- 2026-11-12: WebAssembly tier, output limit 64 MB.
