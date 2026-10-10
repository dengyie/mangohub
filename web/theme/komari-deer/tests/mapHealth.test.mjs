import test from "node:test";
import assert from "node:assert/strict";
import { buildMapViewSummary } from "../src/utils/mapRegions.ts";

test("map distinguishes never-reported nodes from offline agents", () => {
  const nodes = [{uuid:"a",region:"🇯🇵"},{uuid:"b",region:"🇯🇵"},{uuid:"c",region:"🇯🇵"}];
  const summary = buildMapViewSummary(nodes, {online:["a"],data:{a:{},b:{}}});
  assert.equal(summary.onlineNodes, 1);
  assert.equal(summary.offlineNodes, 1);
  assert.equal(summary.unknownNodes, 1);
  assert.equal(summary.regions[0].unknown, 1);
  const missing = buildMapViewSummary(nodes);
  assert.equal(missing.onlineNodes, 0);
  assert.equal(missing.regions[0].status, "unknown");
});
