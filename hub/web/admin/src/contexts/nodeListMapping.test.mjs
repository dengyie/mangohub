import assert from "node:assert/strict";
import test from "node:test";

import { toNodeBasicInfo } from "./nodeListMapping.ts";

test("omitted miner flags stay omitted on the node", () => {
  const node = toNodeBasicInfo({ uuid: "a", name: "plain" });
  assert.equal("miner_configured" in node, false);
  assert.equal("miner_controllable" in node, false);
});

test("explicit false miner flags stay false", () => {
  const node = toNodeBasicInfo({
    uuid: "b",
    miner_configured: false,
    miner_controllable: false,
  });
  assert.equal(node.miner_configured, false);
  assert.equal(node.miner_controllable, false);
});

test("explicit true miner flags stay true", () => {
  const node = toNodeBasicInfo({
    uuid: "c",
    miner_configured: true,
    miner_controllable: true,
  });
  assert.equal(node.miner_configured, true);
  assert.equal(node.miner_controllable, true);
});

test("non-boolean miner flags stay omitted", () => {
  const node = toNodeBasicInfo({
    uuid: "d",
    miner_configured: 0,
    miner_controllable: "false",
  });
  assert.equal("miner_configured" in node, false);
  assert.equal("miner_controllable" in node, false);
});
