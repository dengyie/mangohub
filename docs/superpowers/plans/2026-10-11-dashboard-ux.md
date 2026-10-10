# MangoHub Dashboard Implementation Plan

> Execute in this worktree, file by file, with the evidence-driven-bugfix and verification-before-completion workflows.

**Goal:** Implement the approved `web/theme/komari-deer/docs/superpowers/specs/2026-10-11-dashboard-ux.md` contract.

**Architecture:** Pure typed ping and health aggregation, existing RPC transport adapters, React hooks for lifecycle and components for rendering. Keep the existing cache and chart contracts; no new service layer or dependencies.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.8, Tailwind 4, Node test runner, existing RPC2/fetch.

## Global constraints

- UTF-8 without BOM. Primary `main` and four uncommitted brand files stay untouched.
- Keep production operations scoped to the user-authorized frontend theme release; do not change the backend container, database, agents or nginx.
- HTTP availability is separate from network loss and agent status; preserve missing data.

## Tasks

- [x] Establish test loader (`script/test-register.mjs`, `script/test-loader.mjs`) and package `test`/`typecheck` commands. Run baseline; 3 existing alias-resolution failures must disappear.
- [x] Add executable failing regression tests for `src/lib/ping.ts` and `src/lib/dashboard.ts`. Inputs include `loss:100, avg:0` and no samples; expected latency is `null`, measured loss is `100`, and unknown CPU is excluded from the mean.
- [x] Implement typed aggregation and payload validation; add `AbortSignal` to RPC HTTP options and test cancellation. Preserve ping summaries and freshness in `LiveDataContext`.
- [x] Implement one dashboard task-metadata hook and cancelable one-hour expanded-history hook. Wire summary/filter state in `NodeDisplay`, default-visible pixel globe in `DashboardContent`, compact accessible cards in `Node`, and mobile navigation. Translate all new copy.
- [x] Run `npm test`, `npm run typecheck`, `npm run build`; repair failures and rerun affected verification.
- [x] Serve the static export locally; verify deterministic fixtures at 320/390/768/1440px, status/filters/map/details/request counts. Inspect screenshots, review diff, update validation record and confirm primary worktree unchanged.

## Verification commands

Run from `web/theme/komari-deer`:

```sh
npm test
npm run typecheck
npm run build
```

All commands must exit 0. Browser checks must show no per-node `getRecords` or load-history request before interaction, measurable first-screen node content, and internally scrollable tables without document overflow.

## User visual amendment

- [x] Apply verified MangoAPI paper tokens and a light default.
- [x] Normalize collapsed card dimensions, flag frames and OS icons. Baseline fixture heights: 201.5 / 226 / 250.5 px because state notes add different row counts.
- [x] Show a compact pixel globe by default. Rasterize local topology once into a bounded country index texture; each frame samples a fixed sphere grid in O(pixels), without reprojecting country polygons or network I/O. Keep region status and keyboard selection.
- [x] Verify palette, equal heights, globe drag/pause/reduced-motion, four widths, existing tests and build; refresh screenshots and validation.

## Completion record

All tasks, including the user visual amendment, verified on 2026-10-11. See [validation results](../../../web/theme/komari-deer/docs/superpowers/validation/2026-10-11-dashboard-ux.md) for command results, browser fixtures and viewport measurements.

## Day/night, hover and automated release

- [x] Restore browser-local appearance selection in ThemeContext and add a Sun/Moon control to NavBar. Extend the paper dark palette; repaint canvas after theme resolution.
- [x] Add fixed-grid country hit detection, hover pause/resume and a bounded country node detail panel in PixelGlobe/NodeMapView; preserve manual pause and reduced motion.
- [x] Add frontend deploy workflow and a restricted archive receiver with validation, SHA identity, atomic switch, retained rollback and health checks; document installation and credentials by name only.
- [ ] Run tests/types/build and browser day/night persistence, hover lifecycle and responsive checks. Commit and rebase on current origin/main, publish GitHub, configure deployment key, run CI and verify production SHA and interactions.
