# Pixel Golden Cat Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a small golden-shaded pixel cat companion beside the homepage pixel globe, with animation and direct interaction with globe hover, selection, pause, and click controls.

**Architecture:** Keep the globe as the source of truth for map state. Lift its pause state into `NodeMapView`, pass derived globe activity into a focused `PixelCat` canvas component, and let a cat click toggle globe rotation. Render the cat from code-defined pixel frames so no image dependency or network asset is needed.

**Tech Stack:** React 19, TypeScript, Canvas 2D, CSS, react-i18next, Node test runner with the existing TypeScript loader.

## Global Constraints

- Preserve the existing `PixelGlobe` hit testing, rotation, and region detail behavior.
- Do not add runtime dependencies or remote image assets.
- Respect `prefers-reduced-motion`, hidden tabs, and the existing globe pause behavior.
- Keep all source, tests, and documentation UTF-8 without BOM.
- Do not replace internal Komari compatibility identifiers.

---

### Task 1: Define and test the pixel cat frame model

**Files:**
- Create: `hub/web/theme/komari-deer/src/components/pixelCatFrames.ts`
- Create: `hub/web/theme/komari-deer/tests/pixelCat.test.mjs`

**Interfaces:**
- Produces `PixelCatMood`, `PIXEL_CAT_SIZE`, `PIXEL_CAT_PALETTE`, `PIXEL_CAT_FRAMES`, and `getPixelCatFrame(mood, frame)` for the renderer.

- [ ] **Step 1: Write the failing source contract test**

Assert that the frame table exposes `idle`, `watching`, `happy`, and `sleeping`, every frame has exactly `PIXEL_CAT_SIZE` rows and columns, and `getPixelCatFrame` wraps indexes deterministically.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `node --import ./script/test-register.mjs --test tests/pixelCat.test.mjs` from `hub/web/theme/komari-deer`.
Expected: FAIL because `pixelCatFrames.ts` does not exist.

- [ ] **Step 3: Implement the frame model**

Use a 16x16 character grid with transparent `.`, dark outline, golden fur, cream highlights, brown eyes, and pink nose. Give each mood at least two frames: idle tail sway/blink, watching ear and eye direction, happy bounce/tail curl, sleeping closed eyes and floating `Z`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same Node test command. Expected: PASS.

- [ ] **Step 5: Commit the focused model**

Run `git add hub/web/theme/komari-deer/src/components/pixelCatFrames.ts hub/web/theme/komari-deer/tests/pixelCat.test.mjs && git commit -m "feat(theme): define pixel golden cat frames"`.

### Task 2: Build the interactive PixelCat canvas component

**Files:**
- Create: `hub/web/theme/komari-deer/src/components/PixelCat.tsx`
- Create: `hub/web/theme/komari-deer/src/components/PixelCat.css`
- Modify: `hub/web/theme/komari-deer/src/i18n/locales/en.json`
- Modify: `hub/web/theme/komari-deer/src/i18n/locales/zh_CN.json`
- Modify: `hub/web/theme/komari-deer/src/i18n/locales/zh_TW.json`

**Interfaces:**
- Consumes `PixelCatMood` and `getPixelCatFrame` from Task 1.
- Exposes `PixelCatProps = { mood, paused, selectedLabel?, onTogglePaused }`.

- [ ] **Step 1: Add the failing component contract assertions**

Extend `tests/pixelCat.test.mjs` to assert the component uses a canvas with `imageSmoothingEnabled = false`, calls `onTogglePaused` from an accessible button, and includes reduced-motion handling.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `node --import ./script/test-register.mjs --test tests/pixelCat.test.mjs`.
Expected: FAIL because `PixelCat.tsx` and its styles do not exist.

- [ ] **Step 3: Implement the renderer**

Render the selected mood at 4 frames per second using `requestAnimationFrame`, stop when paused, hidden, or reduced motion is enabled, and draw each character cell as a hard-edged pixel. Wrap the canvas in a button with an aria label that explains clicking toggles globe rotation. Show the selected region label in a small status line when present.

- [ ] **Step 4: Add localized strings**

Add `pixelCat`, `pixelCatIdle`, `pixelCatWatching`, `pixelCatHappy`, `pixelCatSleeping`, and `toggleGlobeFromCat` under `dashboard` in all three locale files.

- [ ] **Step 5: Run the focused test and typecheck**

Run `node --import ./script/test-register.mjs --test tests/pixelCat.test.mjs` and `npm run typecheck` from the theme directory. Expected: PASS and no TypeScript errors.

- [ ] **Step 6: Commit the component**

Run `git add hub/web/theme/komari-deer/src/components/PixelCat.tsx hub/web/theme/komari-deer/src/components/PixelCat.css hub/web/theme/komari-deer/src/i18n/locales && git commit -m "feat(theme): add interactive pixel golden cat"`.

### Task 3: Connect the cat to globe state

**Files:**
- Modify: `hub/web/theme/komari-deer/src/components/PixelGlobe.tsx`
- Modify: `hub/web/theme/komari-deer/src/components/NodeMapView.tsx`
- Modify: `hub/web/theme/komari-deer/src/components/NodeMapView.css`
- Modify: `hub/web/theme/komari-deer/tests/pixelCat.test.mjs`

**Interfaces:**
- `PixelGlobe` accepts `paused` and `onPausedChange` rather than owning an isolated pause state.
- `NodeMapView` derives cat mood: `sleeping` when the globe is paused, `watching` while a region is hovered, `happy` when a region is selected, and `idle` otherwise.

- [ ] **Step 1: Add failing integration assertions**

Assert that `NodeMapView` renders `PixelCat`, passes `hoveredKey`/`selected` derived state, and wires the cat callback to `setGlobePaused`; assert `PixelGlobe` receives the lifted pause props.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `node --import ./script/test-register.mjs --test tests/pixelCat.test.mjs`. Expected: FAIL on the missing integration signatures.

- [ ] **Step 3: Lift pause state and add the cat**

Move `paused` to `NodeMapView`, pass it into `PixelGlobe`, emit updates through `onPausedChange`, and render `<PixelCat>` adjacent to the globe. Clicking the cat toggles the same pause state as the globe control. Preserve region button selection and hover details unchanged.

- [ ] **Step 4: Style the companion layout**

Add a compact cat panel below the globe controls on desktop and beside the globe on mobile, using existing border/background variables. Keep the canvas pixelated and avoid layout shifts.

- [ ] **Step 5: Run focused tests and browser checks**

Run the Node test, `npm test`, `npm run typecheck`, and the existing browser hover suite. Expected: all pass; hovering a globe region changes the cat to watching, selecting a region changes it to happy, pausing changes it to sleeping, and clicking the cat toggles globe rotation.

- [ ] **Step 6: Commit the integration**

Run `git add hub/web/theme/komari-deer/src/components/PixelGlobe.tsx hub/web/theme/komari-deer/src/components/NodeMapView.tsx hub/web/theme/komari-deer/src/components/NodeMapView.css hub/web/theme/komari-deer/tests/pixelCat.test.mjs && git commit -m "feat(theme): connect pixel cat to globe interactions"`.

### Task 4: Build, inspect, and update release documentation

**Files:**
- Modify: `hub/web/theme/komari-deer/docs/superpowers/validation/2026-10-19-pixel-golden-cat.md`
- Modify: Obsidian canonical `Note/Infra/Beszel-Komari 监控迁移计划.md`
- Modify: Obsidian router `00.MOC/AI-DOC-ROUTER.md`

- [ ] **Step 1: Run the complete verification set**

Run `npm test`, `npm run typecheck`, `npm run build -- --webpack`, and `node --test tests/build-output/branding.test.mjs`. Inspect the built page with the browser and verify the cat works at desktop and mobile widths.

- [ ] **Step 2: Record validation evidence**

Create the validation note with commands, results, and the interaction contract. Update the canonical Obsidian section with the final commit and deployment result only after online verification.

- [ ] **Step 3: Commit the release record**

Run `git add hub/web/theme/komari-deer/docs/superpowers/validation/2026-10-19-pixel-golden-cat.md && git commit -m "docs(theme): record pixel golden cat validation"`.
