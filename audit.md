# QPA Calculator — Audit Criteria

Browser-free verification checklist. Items marked **MANUAL VERIFICATION REQUIRED**
need a live browser / device and cannot be confirmed by static analysis in this
environment (no Node runtime available here either — see build note at bottom).

Legend: `[x]` done & verifiable by reading code · `[ ]` pending · `MVR` manual.

## Functional correctness
- [x] Single source of truth for grades: `src/lib/grades.ts` `GRADE_OPTIONS` +
      `gradePoints()` used by BOTH manual entry (`QpaCalculator.tsx`) and import
      (`transcript.ts` via `normalizeGrade`). No divergent grade tables. (F1)
- [x] Unknown/invalid transcript grade tokens normalize to `NO_GRADE` and are
      excluded, never silently mis-scored. (`grades.ts:normalizeGrade`) (F1, E2)
- [x] R = 0 quality points AND counts in the denominator. (`grades.ts` points:0) (F1)
- [x] Excluded grades (P, S, N, W, I, AD, O, NO_GRADE) have `points: null` →
      omitted from both numerator and denominator. (F1)
- [x] Empty / all-excluded state returns `qpa: null`; UI renders `—` not `0.00`.
      (`grades.ts:computeTotals`, `QpaCalculator.formatQpa`) (F2)
- [x] Cumulative QPA = Σ(units×points) ÷ Σ(units) over all semesters.
      (`computeTotals(semesters.flatMap(...))`) (math)
- [x] Units restricted to non-negative integers, clamped to `MAX_UNITS` (999).
      (`handleUnitsChange`) (F3, E1)
- [ ] Unit tests for `computeTotals` (R=0, excluded grades, empty, mixed, clamp).
      MVR to execute — no test runner wired up. (test)

## Persistence
- [x] `localStorage` read wrapped in try/catch with reset fallback; corrupt JSON
      cannot white-screen the app. (`QpaCalculator` mount effect) (F4)
- [x] Writes guarded and gated on `hydrated` to avoid clobbering saved state on
      first paint. (F4)
- [ ] MVR: reload persistence round-trip in a real browser.

## Accessibility
- [x] Grade selector is Radix `Select` (listbox role, full keyboard nav, focus
      mgmt) — replaced the div-based `CustomSelect`. (A3)
- [x] All inputs have `aria-label`; units uses `inputMode="numeric"`;
      course name `autoComplete="off"` + `spellCheck={false}`. (A2)
- [x] Icon-only buttons have `aria-label` (delete semester/course, rename);
      decorative icons `aria-hidden="true"`. (A1)
- [x] Cumulative + semester QPA in `aria-live="polite"` region. (A4)
- [x] Semantic `<table>` with `<caption>`, `<th scope>`, `<tfoot>` totals. (IA1, A2)
- [x] Destructive semester delete gated behind `AlertDialog` confirm. (F6)
- [x] Heading order fixed: `h1` (page) → `h2` (semester names, QPA label). (A7)
- [ ] MVR: contrast ratios from rendered pixels (values improved in CSS: footer
      whites raised to ≥0.85 alpha on #C41230; muted text unchanged). (A6)

## Build / performance
- [x] `pdfjs-dist` isolated in `src/lib/transcript.ts`, dynamically imported only
      inside `handleFileUpload` — off the first-paint path. (P5)
- [x] `utils.ts` no longer imports pdfjs (only `cn`). (P5)
- [x] Dead `import Head from "next/head"` removed from `layout.tsx`. (P3)
- [x] Dead files deleted: `CourseGradeCalculator.tsx`, `ui/custom-select.tsx`. (dead code)
- [x] Loaded Geist font now actually applied (`globals.css` body uses
      `var(--font-geist-sans)`), no longer overridden by Arial. (V3, P2)
- [x] Pruned unused deps + files: removed 26 unused `ui/*` components,
      `hooks/use-mobile`, `icons.ts` x2; dropped firebase, @tanstack/*, recharts,
      framer-motion, date-fns, react-day-picker, react-hook-form, zod,
      @hookform/resolvers, next-themes, patch-package, genkit-cli, @types/webpack,
      and 16 unused `@radix-ui/*` packages from `package.json`. Kept only the
      5 radix packages in the reachable graph. Traced graph statically; no
      dangling imports remain (verified by sweep). Run `npm install` to prune
      `node_modules`. (P1)
- [ ] Re-enable `typescript.ignoreBuildErrors`. DEFERRED: blocked by the
      pdfjs-dist v3 vs @types/pdfjs-dist v2 typing mismatch in `transcript.ts`
      (`item.items`), which needs a local `tsc` to resolve. Flip to `false`
      only after that passes. ESLint gate intentionally left ignored. (P4)

## Brand / CSS
- [x] Official CMU Carnegie Red `#C41230` = `hsl(348 83% 42%)` applied in
      `variables.css`, `globals.css` (light + dark), `home.css`, `qpa-calculator.css`. (V2)
- [x] `--color-primary-rgb` cascade bug fixed: now `196, 18, 48` everywhere
      (was blue `59,130,246` winning over layered override). Hover borders render
      red. (V1)
- [x] `<meta name="theme-color" content="#C41230">` added. (theming)
- [x] Terminology unified to "QPA" (Semester QPA / Cumulative QPA); no stray "GPA"
      in user-facing copy. (IA2)
- [x] Formula/weighting note shown in intro. (F5)
- [x] Per-course quality-points column + per-semester totals row (units, quality
      points) + cumulative subtotal line. (IA1, IA3)

## Mobile
- [x] Course table reflows to stacked cards <640px with `data-label` headers. (M1)
- [x] Inputs/select/delete ≥ 44px touch target on mobile (`height: 2.75rem`). (M1)
- [x] Scroll area `min-height` raised to 220px to avoid cramped window. (M2)
- [ ] MVR: numeric keypad on real iOS/Android; tap-target comfort; on-device layout.

## MANUAL VERIFICATION REQUIRED (live browser only)
- [ ] `next build` / `tsc --noEmit` pass (no Node here).
- [ ] Real CMU transcript PDF imports end-to-end.
- [ ] Lighthouse a11y/perf/SEO scores.
- [ ] Screen-reader announces QPA updates + toast.
- [ ] Visual match to screenshots — BLOCKED: `./screenshots/` folder absent from repo.
