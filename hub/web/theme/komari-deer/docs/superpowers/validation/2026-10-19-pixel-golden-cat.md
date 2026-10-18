---
title: Pixel golden cat validation
tags:
  - theme
  - frontend
  - validation
status: active
updated: 2026-10-19
aliases:
  - 金渐层像素猫咪
  - pixel golden cat
---

# Pixel Golden Cat Validation

> **速读**：Mango Hub 首页地球仪旁新增金渐层像素猫咪；猫咪和地球仪共享暂停状态，地区悬停、选择和 reduced-motion 均有对应行为。

## Verification

- `npm test`: 81 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed; static export generated successfully.
- `node --test tests/build-output/branding.test.mjs`: 1 passed.
- `python3 -m unittest discover -s hub/tests -p 'test_deploy_theme.py' -v`: 7 passed.
- Browser fixture check at desktop width: the cat canvas rendered at `80x80` with `3500` non-transparent pixels; the globe canvas rendered at `310x310`.
- Browser fixture check at `390px` width: page width remained `390px` with no horizontal overflow; globe rendered at `140.4px` and the cat control stayed at `104px`.
- Interaction check: clicking the cat set `aria-pressed=true`, changed the status to `Globe is paused`, and kept the globe rotation unchanged during a 500ms sample. Clicking the globe pause control produced the same sleeping state.

## Interaction contract

- `idle`: default network-watching animation.
- `watching`: active region hover.
- `happy`: selected region.
- `sleeping`: globe rotation paused.
- Cat click toggles the same lifted pause state used by the globe control.
- Canvas animation stops for a paused globe, hidden document, offscreen component, or `prefers-reduced-motion: reduce`.

## Notes

- The default Turbopack dev server could not start in the isolated worktree because its external `node_modules` symlink is outside the filesystem root. Webpack dev/build mode was used for browser and production checks.
- Existing Komari compatibility identifiers remain unchanged.
