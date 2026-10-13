# Dashboard readability and bounded loading

Status: approved by the user on 2026-10-11. This supplement implements the accepted frontend optimization proposal.

## Baseline and scope

- `README-CN.md`: static Next.js theme, grid/table, map, internationalization, existing charts and package format.
- `src/lib/RPC2_README.md` and `web/rpc/jsonrpc/README.md`: use existing guest-readable RPC contracts; no new API or dependency.
- `2026-08-11-komari-deer-history-cache-preload-design.md`: retain shared history cache, in-flight deduplication, cached rendering and refresh on opening. This supplement replaces eager all-node preloading with demand loading; the existing five-minute cache policy remains unchanged.
- `2026-08-11-komari-deer-monthly-traffic-design.md`: preserve monthly total plus 24-hour cumulative chart in the popover, and speed charts on instance pages.
- Change the vendored theme only. Preserve CNB host-only visibility, mining metrics, authentication, pricing and theme packaging. User amendment authorizes GitHub updates, CI deployment and publishing the latest frontend theme. The backend container and data contracts stay unchanged.

## Presentation contract

1. Show total nodes, online nodes, attention count and mean CPU before the node list. CPU mean uses only online nodes with valid metrics and is an unweighted per-node mean.
2. User amendment: the globe is visible by default above the overview, with an optional collapse control. Use a pixel globe made from the existing world geometry, with region status and accessible region selection. Pause animation offscreen, in hidden tabs and for reduced motion; cap rotation at 20 fps. Keep the hero compact on mobile.
3. Cards show identity, explicit agent state, CPU/RAM/disk, network probe summary and a details toggle. Network traffic, mining, HTTP reachability, timeline and pricing remain accessible on expansion. Preserve the resource-chart popover.
4. Offline cards remain clickable, without overlays or hover-only access. Display the last report time, not an invented last-online timestamp. Cached or unavailable live data is visibly stale/unknown and is excluded from current online and CPU counts.
5. Provide all/attention/offline/high CPU/high RAM/high disk/high loss/no data filters, alongside existing text search, group and view controls. These are display filters, not notification rules. Thresholds: resource usage >=90%; network loss >5%, matching existing warning conventions. Mining CPU saturation remains visible as high usage, not a claim of miner failure.
6. Unknown data renders an em dash with explanatory copy. A measured 100% loss stays 100%; latency with no successful probe is unknown. HTTP availability, ICMP/TCP loss and agent online state are separate concepts. No interpolation across missing timeline buckets.
7. All new copy has en/zh_CN/zh_TW translations. Buttons have accessible names, focus states and touch targets. At 320/390/768/1440 CSS pixels, controls and cards do not clip or cause page overflow. The table may scroll inside its container.
8. Match MangoAPI's verified paper palette: background #fbfaf6, ink #11110f, surface #f7f6ef, inset #efeee7, muted #6f6d69 and rules #e4e1d7. Default to light; provide a browser-local day/night switch using the matching warm charcoal dark palette. Preserve the choice across reloads, including for logged-in administrators, without changing global site settings. Keep semantic status colors distinct.
9. Collapsed VPS cards have the same height regardless of missing metrics or offline status. Reserve a single status-note row; show the full last-report timestamp in details. Flags use a fixed 3:2 frame without distorting their artwork; OS images have a fixed square contain frame.

## Data and lifecycle contract

- `common:getNodesLatestStatus` already carries a map of one-hour per-task `ping` summaries. Preserve this map during DTO normalization and classify task types using `public:getPublicPingTasks` once per dashboard, refreshed once per minute. The main live request remains batched.
- Summary `latest` is the latest successful response on the current server; never interpret it as current HTTP reachability. HTTP summary shows one-hour availability, with no current up/down assertion.
- Collapsed cards request no per-node ping history or load history. Expanded cards request `common:getRecords` with `type: ping`, `hours: 1`, `max_count: 4000`. Task-level summary totals/loss describe the complete window; timeline uses returned samples. Results carry explicit loading/error/empty states and retry, rather than converting failure to healthy zeroes.
- Parse and validate unknown I/O payloads; normalize finite values only. Use explicit UTC timestamps at boundaries. No timer/randomness in aggregation functions.
- Use Map/Set for task and node lookup; summaries O(nodes + tasks + samples), bounded 24 timeline buckets. Sort node weights only when the node list changes, then partition offline/other nodes in O(n). No full history payload in the hot dashboard path.
- Requests have bounded timeouts and AbortSignal cleanup. Collapse, route changes and unmount cancel detail work; late responses cannot overwrite another node. Metadata failures must be visible and retryable.

## Acceptance

- Deterministic tests cover empty/HTTP-only/all-lost/zero-latency/mixed/invalid samples; last HTTP failure; missing bucket gaps; task classification; unknown/stale live data and thresholds; cancellation/timeout.
- Run all theme Node tests through a TypeScript/alias-aware loader, `tsc --noEmit`, and `next build` static export. No installed dependency changes.
- Browser checks: four widths, first-screen metrics, filters/search/reset, map toggle, offline detail navigation, expandable history, no eager per-node requests, and no console errors with deterministic local fixtures. Inspect screenshots for layout quality.

## Hover and release amendment — 2026-10-11

- Increase online land/marker green contrast in both palettes. Hovering the globe pauses rotation; country surfaces and small-territory markers open a country panel with names, per-node status, CPU/RAM/disk and detail links from existing live data. Leaving resumes rotation unless manually paused or reduced motion is requested. Touch and keyboard region selection remain usable.
- Hover hit-testing uses the fixed raster grid (O(1)), with no request on hover. Keep hover stable across batched live updates and theme changes.
- Add a frontend-only main-branch GitHub workflow: Node tests, types, static build, artifact checksum, bounded SSH upload to a forced-command receiver, atomic theme activation, health checks and rollback. Keep the previous release and hashed chunks for clients with older HTML. Publish commit identity at `/frontend-release.json`.
