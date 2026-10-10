# Dashboard UX validation — 2026-10-11

Implemented against [the dashboard supplement](../specs/2026-10-11-dashboard-ux.md) on `codex/dashboard-ux` in `/Users/mango/project/mango-hub-worktrees/dashboard`.

## Delivered behavior

- Overview: total nodes, fresh online nodes, attention count and valid online CPU mean.
- Existing search, groups and grid/table views retained; eight health filters added. Small screens use a labeled select; desktop uses buttons.
- Pixel globe is visible by default above the overview, with optional collapse. Compact cards expose CPU/RAM/disk and one-hour network summaries; details retain traffic, mining, HTTP availability, timestamps and pricing. The resource-chart popover and monthly traffic/cache behavior remain intact.
- Live normalization retains the existing batched per-task ping summaries. One public task-metadata request per dashboard classifies ICMP/TCP/HTTP, refreshed once per minute.
- Expanded card history requests use `hours: 1` and `max_count: 4000`. Collapse/unmount aborts transport; timeouts and refresh/retry states are explicit.
- Missing data stays unknown. All-failed network probes retain measured loss and have no successful latency. HTTP current status comes only from timestamped samples; a latest-success summary is not treated as current reachability.
- Never-reported and stale nodes are distinct from offline nodes. Map, cards, table and detail metrics agree with this distinction. CNB visibility remains restricted to its UUID.
- No new runtime dependency or backend API. The separately documented frontend release changes only the mounted theme files; it does not restart or modify backend services.

## Automated checks

All commands ran from `web/theme/komari-deer`, using Node 26.9.0, installed dependencies and the existing Next 16.1/React 19/TypeScript 5.8 stack.

| Check | Result |
| --- | --- |
| `npm test` | 77 passed, 0 failed |
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0; static export generated in `dist/` |
| `git diff --check` | Exit 0 |
| Changed text encoding | UTF-8 without BOM |

The test loader uses the existing TypeScript dependency to resolve aliases and TS/TSX modules. Previously inlined HTTP/mining tests now call the actual production helpers. New tests cover all-lost/HTTP-only/zero-latency/invalid/empty histories, missing buckets, latest HTTP failure, complete-window availability, live normalization, threshold filters, missing resources, map unknown state, caller cancellation and timeout.

The baseline map compatibility-cache test also exposed a missing cache. The initial projection is now cached independently of rotation. Its test checks hemisphere clipping and ensures rotation does not mutate the cached initial geometry.

Build output retains the existing static-export/rewrites warning. Node 26 also emits a `module.register()` deprecation notice. Neither is a build or type error; no dependencies were installed to suppress these notices.

## Browser checks

The files below are async Playwright function expressions. With a local static server serving `dist/` on port 4173 and an existing Playwright `page`, invoke the fixture function, then one check function. The fixture routes `https://mangohub.test` to the local export and intercepts all API requests with deterministic data; it makes no production writes. Run fixture setup again before each independent suite.

- `tests/dashboard.browser.mjs`: eight nodes including high usage, measured loss, HTTP-only, offline, never-reported and missing metrics.
- `tests/dashboard.browser-checks.mjs`: initial request counts, viewport checks, all filters, search/keyboard behavior, groups/reset, bounded detail request, CNB/mining/HTTP semantics, failure/retry, map mount/unmount, table overflow and offline navigation.
- `tests/dashboard.browser-visuals.mjs`: exact MangoAPI palette, fixed flag/OS dimensions, automatic rotation, pause, drag, keyboard controls, region links, reduced motion, offscreen and hidden-document suspension.
- `tests/dashboard.browser-lifecycle.mjs`: metadata failure/retry, actual `net::ERR_ABORTED` on collapse, on-demand resource history and monthly traffic popover, stale snapshot exclusion and live recovery.
- `tests/dashboard.browser-theme-hover.mjs`: local day/night persistence, bright dark-mode globe green, country hover details, pause across live refresh and resume on leave, no hover history fetch, and 320/390/768/1440 widths.

| Width | Document width | First card top (English fixture) | Compact card height |
| --- | --- | --- | --- |
| 320 | 320 | 936.8px | 230px |
| 390 | 390 | 962.0px | 230px |
| 768 | 768 | 971.3px | 230px |
| 1440 | 1440 | 854.5px | 230px |

All eight filters returned the expected counts. Initial per-node ping and load-history requests were zero, including after the former three-second preload window. Expanding one card issued exactly one bounded one-hour history request. Closing it aborted the pending transport. The resource popover separately requested its existing 24-hour load history on demand.

Normal interaction suite: zero browser console/runtime errors. Failure injection: expected live-poll error only, no unexpected errors. Metadata and history errors were visible and retryable. Stale online count became zero and CPU mean became an em dash, then recovered to the expected values.

Simplified Chinese was inspected at 390px: no raw translation keys or document overflow. Desktop and mobile screenshots were visually inspected. The table scrolls within its container.

## User visual amendment

- Reference: the live MangoAPI homepage `https://api.mangoqwq.com/`, inspected on 2026-10-11, and its `web/src/styles/site-design.css` paper tokens. Runtime values matched `#fbfaf6` background, `#11110f` ink and `#f7f6ef` card. Global palette, default appearance and footer now share these values.
- Original mixed-state card heights reproduced at 201.5, 226 and 250.5px. The same eight-node fixture now measures **230px for every collapsed card** at all four widths. Flags use 30×20px outer frames (28×18px content); OS images use 14×14px contain frames. Last-report timestamps remain in expanded details.
- The globe uses the existing local topology. A cached 720×360 country-index texture and a fixed 96×96 sphere grid avoid full polygon reprojection on each frame. Rotation is capped at 20fps and does not request any remote map assets or telemetry. Region status comes from the existing batched data; unknown remains distinct from offline.
- The browser-local day/night switch keeps the warm paper palette in daylight and uses a warm charcoal night palette with vivid `#38ef83` online land. Canvas palette changes repaint immediately. Hover uses the fixed grid for constant-time region lookup; country land and small-territory markers show live node status and resource values without fetching history. Leaving resumes rotation, while manual pause and reduced motion remain respected.
- Final local verification: `npm test` 77/77; deployment receiver tests 7/7; `npm run typecheck`, `npm run build`, and `git diff --check` all exited 0. Browser visual, lifecycle, layout and theme/hover suites all passed without unexpected console errors. An additional Sydney land-hover check confirmed country-level hit detection and that manual pause survives both hover and leave.
- Browser interaction and lifecycle suites passed with no unexpected console/runtime errors. Region selection exposes node links, including keyboard interaction. Hidden-document behavior was exercised via the visibility event and hidden flag; offscreen behavior used a real viewport scroll.
- Final preview images (fixture data, not production): `/Users/mango/project/codex/.playwright-mcp/mangohub-paper-desktop-zh.png` and `mangohub-paper-mobile-zh.png`.

## Workspace protection

## Production release

- GitHub `main` revision `d735d8262657bfb898f092a3e94947ce9722935c` deployed successfully by [Frontend checks and deploy run 38087170874](https://github.com/dengyie/mango-hub/actions/runs/38087170874). Both verify and deploy jobs completed successfully. The independent restricted receiver was updated from the checked-in source and its SHA-256 matched before rerunning the deploy job.
- The active release is retained at `data/theme-releases/d735d8262657bfb898f092a3e94947ce9722935c-e3d09edb`; the previous legacy theme remains available for rollback. `last-success.json` records both paths. `/frontend-release.json` returns the deployed revision, `/api/public` reports `komari-deer`, and the live homepage serves 21 nodes.
- Public browser verification on the live site confirmed the release identity, 21 real node cards, the `#141413` night palette, 889 vivid-green canvas pixels, a Hong Kong hover panel with its two nodes and live metrics, rotation paused through a live refresh, rotation resumed after leaving, and the night preference persisted across reload. No browser errors occurred. The temporary appearance preference was restored after the check.
- The host loopback path is used for the deployment receiver's release/API/HTML checks. Public Cloudflare access was verified in a normal browser because this host's own request to its public Cloudflare hostname returns 403.

The primary `/Users/mango/project/mango-hub` remains on `main` with the original four user-provided brand files. Implementation is isolated in `/Users/mango/project/mango-hub-worktrees/dashboard`.
