import test from "node:test";
import assert from "node:assert/strict";
import { buildMapViewSummary } from "../src/utils/mapRegions.ts";

test("map classifies registered nodes missing from a live response as offline", () => {
  const nodes = [{uuid:"a",region:"🇯🇵"},{uuid:"b",region:"🇯🇵"},{uuid:"c",region:"🇯🇵"}];
  const summary = buildMapViewSummary(nodes, {online:["a"],data:{a:{}}});
  assert.equal(summary.onlineNodes, 1);
  assert.equal(summary.offlineNodes, 2);
  assert.equal(summary.unknownNodes, 0);
  assert.equal(summary.regions[0].offline, 2);
  const missing = buildMapViewSummary(nodes);
  assert.equal(missing.onlineNodes, 0);
  assert.equal(missing.regions[0].status, "unknown");
});
