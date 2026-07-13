# QPA Calculator — Cleanup Summary (P1 + P4)

## Summary of this pass

**Deleted 28 unused files** (dead code, not in the reachable module graph):

- 26 unused `ui/*` components: accordion, alert, avatar, badge, calendar, chart,
  checkbox, custom-dropdown, dialog, dropdown-menu, form, label, menubar, popover,
  progress, radio-group, separator, sheet, sidebar, skeleton, slider, switch,
  table, tabs, textarea, tooltip
- `src/hooks/use-mobile.tsx`, `src/components/icons.ts`, root `icons.ts`

**Pruned `package.json`** — removed ~30 unused deps: `firebase`,
`@tanstack/react-query`, `@tanstack-query-firebase/react`, `recharts`,
`framer-motion`, `date-fns`, `react-day-picker`, `react-hook-form`, `zod`,
`@hookform/resolvers`, `next-themes`, `patch-package`, `genkit-cli`,
`@types/webpack`, and 16 unused `@radix-ui/*` packages. Kept only the 5 radix
packages actually reached (`alert-dialog`, `scroll-area`, `select`, `slot`,
`toast`) plus cva / clsx / tailwind-merge / tailwindcss-animate / lucide / next /
react / pdfjs. Also removed the dead `genkit:*` scripts.

**Verified statically** (no compiler available in the audit environment): traced
the full import graph from `app/layout.tsx` + `app/page.tsx`; ran a sweep
confirming **zero dangling imports** to any deleted file and **zero remaining
imports** of any removed dependency. No `patches/`, no `src/ai/`, no postinstall
hook depended on the removed tooling.

**P4 — honest call:** left `typescript.ignoreBuildErrors: true` (with an
explanatory comment). The repo pins `@types/pdfjs-dist@^2` against
`pdfjs-dist@^3`, and `transcript.ts` uses `item.items`, which is almost certainly
a type error under the v3 types. Flipping the gate blind would break the deploy on
that pre-existing issue, which could not be fixed without a compiler. It is
documented in `AUDIT_CRITERIA.md` as the one thing to resolve locally.

## What to run locally

```bash
npm install          # prunes node_modules to the trimmed dep set
npm run typecheck    # resolve the pdfjs v2/v3 typing issue, then set ignoreBuildErrors:false
npm run build
```

Everything else from the audit (grade-model fix, empty-state `—`, safe
localStorage, Radix Select a11y, aria-live QPA, SIO/S3 table, confirmed deletes,
CMU red + cascade-bug fix, lazy pdfjs, font fix, mobile 44px targets) is in place
and verifiable by reading the code per `AUDIT_CRITERIA.md`.
</content>
