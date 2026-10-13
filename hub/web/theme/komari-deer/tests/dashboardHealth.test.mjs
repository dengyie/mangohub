import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLivePing, summarizePingHistory, parsePingTasks, parseLivePing, emptyPingStats } from "../src/lib/ping.ts";
import { getNodeHealth, aggregateHealth, matchesHealthFilter } from "../src/lib/dashboard.ts";

const types = new Map([[1, "icmp"], [2, "http"], [3, "tcp"]]);
const stat = (loss, avg = 0) => ({ name: "probe", latest: 10, avg, tail: 0, loss, min: 0, max: 10 });
const record = (task_id, minute, value) => ({ task_id, time: `2026-10-11T00:${minute}:00Z`, value, client: "a" });

test("all failed ICMP keeps measured loss but never reports zero latency", () => {
  const stats = summarizeLivePing({ 1: stat(100) }, types);
  assert.equal(stats.avgLatency, null);
  assert.equal(stats.avgLoss, 100);
  assert.equal(stats.hasData, true);
});

test("HTTP-only summary is distinct from network probes and latest successful reply is not current health", () => {
  const stats = summarizeLivePing({ 2: stat(25, 120) }, types);
  assert.equal(stats.avgLatency, null);
  assert.equal(stats.avgLoss, null);
  assert.equal(stats.httpReachability[0].availability, 75);
  assert.equal(stats.httpReachability[0].up, null);
});

test("zero latency is valid with successful probes; missing metadata does not mix HTTP into loss", () => {
  assert.equal(summarizeLivePing({ 1: stat(0, 0) }, types).avgLatency, 0);
  assert.equal(summarizeLivePing({ 99: stat(100) }, types).hasData, false);
  assert.deepEqual(summarizeLivePing({}, types), emptyPingStats());
});

test("one-hour history keeps failed buckets and gaps, and reports latest HTTP failure", () => {
  const result = summarizePingHistory({
    from: "2026-10-11T00:00:00Z", to: "2026-10-11T01:00:00Z",
    records: [record(1, "00", 0), record(1, "59", -1), record(2, "01", 100), record(2, "58", -1)],
    tasks: [{ id: 1, name: "icmp", type: "icmp", total: 2, loss: 50, avg: 0 }, { id: 2, name: "http", type: "http", total: 2, loss: 50, avg: 100 }],
  });
  assert.equal(result.avgLatency, 0);
  assert.equal(result.avgLoss, 50);
  assert.equal(result.history.length, 24);
  assert.equal(result.history[12].latency, null);
  assert.equal(result.history[12].loss, null);
  assert.equal(result.history[23].latency, null);
  assert.equal(result.history[23].loss, 100);
  assert.equal(result.httpReachability[0].up, false);
  assert.equal(result.httpReachability[0].availability, 50);
});

test("empty/invalid payloads cannot fabricate success", () => {
  assert.equal(summarizePingHistory({records: [], tasks: []}).avgLoss, null);
  assert.throws(() => summarizePingHistory({records: "invalid"}), /Invalid/);
  assert.throws(() => summarizePingHistory({records: [record(1, "00", NaN)], tasks: []}), /Invalid/);
  assert.throws(() => parseLivePing({1: stat(-1)}), /Invalid/);
  assert.throws(() => parsePingTasks([{id: 1, type: "unknown"}]), /Invalid/);
});

const basic = { mem_total: 100, disk_total: 100 };
const live = { cpu: { usage: 95 }, ram: { used: 90 }, disk: { used: 5 } };
test("threshold filters use fresh online data, exclude offline metrics from CPU mean", () => {
  const hot = getNodeHealth(basic, live, "online", summarizeLivePing({1: stat(6, 10)}, types));
  const offline = getNodeHealth(basic, live, "offline", emptyPingStats());
  const unknown = getNodeHealth(basic, live, "unknown", emptyPingStats());
  assert.equal(matchesHealthFilter(hot, "cpu"), true);
  assert.equal(matchesHealthFilter(hot, "ram"), true);
  assert.equal(matchesHealthFilter(hot, "loss"), true);
  assert.equal(matchesHealthFilter(offline, "cpu"), false);
  assert.equal(matchesHealthFilter(unknown, "unknown"), true);
  assert.deepEqual(aggregateHealth([hot, offline, unknown]), { total: 3, online: 1, offline: 1, attention: 2, unknown: 1, meanCpu: 95 });
});

test("unknown/missing resource data is not zero or healthy", () => {
  const missing = getNodeHealth(basic, undefined, "online", emptyPingStats());
  assert.equal(missing.cpu, null);
  assert.equal(matchesHealthFilter(missing, "unknown"), true);
  assert.equal(aggregateHealth([missing]).meanCpu, null);
});

import { normalizeLiveData } from "../src/lib/liveData.ts";
test("live DTO preserves task summaries and marks missing resources as unknown", () => {
  const response = normalizeLiveData({a: {online:true, cpu:0, ram:NaN, disk:5, ping:{1:stat(100)}, time:"2026-10-11T08:00:00+08:00"}});
  assert.deepEqual(response.data.online, ["a"]);
  const live = response.data.data.a;
  assert.equal(live.updated_at, "2026-10-11T00:00:00.000Z");
  const health = getNodeHealth(basic, live, "online", summarizeLivePing(live.ping, types));
  assert.equal(health.cpu, 0);
  assert.equal(health.ram, null);
  assert.equal(health.loss, 100);
  assert.equal(health.unknown, true);
  assert.throws(() => normalizeLiveData({a:{online:"true"}}), /Invalid/);
});
