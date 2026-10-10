import test from "node:test";
import assert from "node:assert/strict";
import { formatHashrate, miningStatusPill } from "../src/utils/miningHelper.ts";
import { normalizeLiveData } from "../src/lib/liveData.ts";

test("formatHashrate adapts units across magnitudes", () => {
  // xinyun XEL CPU 矿工实测 ~1094 H/s
  assert.equal(formatHashrate(1094.16), "1.09 kH/s");
  // home-win pearlhash GPU 矿工实测 ~62.4 TH/s
  assert.equal(formatHashrate(62403052604616.36), "62.4 TH/s");
  assert.equal(formatHashrate(62400000000000000), "62.4 PH/s");
});

test("formatHashrate handles zero and invalid input", () => {
  assert.equal(formatHashrate(0), "0 H/s");
  assert.equal(formatHashrate(null), "0 H/s");
  assert.equal(formatHashrate(-5), "0 H/s");
  assert.equal(formatHashrate(NaN), "0 H/s");
});

test("formatHashrate picks digit precision by magnitude", () => {
  assert.equal(formatHashrate(42.7), "42.7 H/s"); // >=10 → 1 位小数
  assert.equal(formatHashrate(999), "999 H/s"); // >=100 → 0 位小数
  assert.equal(formatHashrate(1049), "1.05 kH/s"); // 1.05 → 2 位小数
  assert.equal(formatHashrate(5.25), "5.25 H/s"); // <10 → 2 位小数
});

test("miningStatusPill only appears when live mining exists", () => {
  assert.equal(miningStatusPill(null), null);
  assert.equal(miningStatusPill(undefined), null);
  const xel = miningStatusPill({ algorithm: "xelishashv3", hashrate_1min: 1094.16, wallet: "krxXGNKMD4/vps01" });
  assert.deepEqual(xel, {
    name: "xelishashv3",
    up: true,
    metric: "1.09 kH/s",
    title: "xelishashv3 · 1.09 kH/s",
  });
  assert.ok(!JSON.stringify(xel).includes("krxX"));
  const idle = miningStatusPill({ algorithm: "pearlhash", hashrate_1min: 0 });
  assert.equal(idle.up, false);
  assert.equal(idle.metric, "0 H/s");
  assert.equal(idle.title, "pearlhash · idle");
  const unnamed = miningStatusPill({ hashrate_1min: 62403052604616.36 });
  assert.equal(unnamed.name, "Mining");
  assert.equal(unnamed.metric, "62.4 TH/s");
});

test("live normalization preserves mining metrics without private wallet fields", () => {
  const value = normalizeLiveData({node: {online:true, mining:{algorithm:"xelishashv3",hashrate_1min:1094.16,wallet:"private"}}});
  assert.deepEqual(value.data.data.node.mining, {algorithm:"xelishashv3",hashrate_1min:1094.16});
  assert.equal(miningStatusPill(value.data.data.node.mining).metric, "1.09 kH/s");
  assert.ok(!JSON.stringify(value).includes("private"));
});
