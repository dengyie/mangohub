import test from "node:test";
import assert from "node:assert/strict";

import { getProjectedWorldMap, getRotatedMap } from "../src/components/nodeMapViewGeometry.ts";

test("node map world geometry is computed once and reused", () => {
  const first = getProjectedWorldMap();
  const second = getProjectedWorldMap();

  assert.equal(first, second);
  assert.ok(first.spherePath.length > 0);
  assert.ok(first.graticulePath.length > 0);
  assert.ok(first.countries.length > 100);
  assert.ok(first.countries.some((country) => country.pathData.length > 0));
  // Orthographic projection intentionally clips the far hemisphere.
  assert.ok(first.countries.some((country) => country.pathData.length === 0));
  const originalPaths = first.countries.map((country) => country.pathData);
  const rotated = getRotatedMap([100, -15, 0]);
  assert.notDeepEqual(rotated.countries.map((country) => country.pathData), originalPaths);
  assert.deepEqual(getProjectedWorldMap().countries.map((country) => country.pathData), originalPaths);
});
