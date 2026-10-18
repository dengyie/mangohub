import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("pixel cat frame model is complete and wraps frame indexes", async () => {
  const { PIXEL_CAT_FRAMES, PIXEL_CAT_SIZE, getPixelCatFrame } = await import(
    "../src/components/pixelCatFrames.ts"
  );

  for (const mood of ["idle", "watching", "happy", "sleeping"]) {
    assert.ok(PIXEL_CAT_FRAMES[mood]?.length >= 2, `${mood} needs animation frames`);
    for (const frame of PIXEL_CAT_FRAMES[mood]) {
      assert.equal(frame.length, PIXEL_CAT_SIZE);
      assert.ok(frame.every((row) => row.length === PIXEL_CAT_SIZE));
    }
  }

  assert.deepEqual(getPixelCatFrame("idle", -1), getPixelCatFrame("idle", PIXEL_CAT_FRAMES.idle.length - 1));
  assert.deepEqual(getPixelCatFrame("sleeping", 99), getPixelCatFrame("sleeping", 99 % PIXEL_CAT_FRAMES.sleeping.length));
});

test("pixel cat component keeps the interaction contract", () => {
  const component = source("../src/components/PixelCat.tsx");
  assert.match(component, /imageSmoothingEnabled\s*=\s*false/);
  assert.match(component, /onTogglePaused/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /requestAnimationFrame/);
});

test("node map view wires globe state to the cat companion", () => {
  const nodeMap = source("../src/components/NodeMapView.tsx");
  const globe = source("../src/components/PixelGlobe.tsx");
  assert.match(nodeMap, /<PixelCat/);
  assert.match(nodeMap, /setGlobePaused/);
  assert.match(nodeMap, /hoveredKey/);
  assert.match(globe, /onPausedChange/);
  assert.match(globe, /paused/);
});
