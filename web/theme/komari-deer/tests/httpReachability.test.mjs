import test from "node:test";
import assert from "node:assert/strict";
import { summarizePingHistory } from "../src/lib/ping.ts";

function computeHttpReachability(records, tasks) {
  return summarizePingHistory({records, tasks: tasks.map((task) => ({...task, type: "http"}))}).httpReachability;
}

test("availability = 窗口内 up 采样占比", () => {
  const task = { id: 7, name: "CNB-AI-反代" };
  const records = [
    { task_id: 7, time: "2026-09-09T22:00:00Z", value: 120 },
    { task_id: 7, time: "2026-09-09T22:01:00Z", value: -1 }, // 不可达
    { task_id: 7, time: "2026-09-09T22:02:00Z", value: 118 },
    { task_id: 7, time: "2026-09-09T22:03:00Z", value: -1 }, // 不可达
  ];
  const [h] = computeHttpReachability(records, [task]);
  assert.equal(h.availability, 50); // 2/4
  assert.equal(h.up, false); // 最新一条不可达
});

test("全部可达 → 100%，up=true；无采样 → availability=null, up=null", () => {
  const all = computeHttpReachability(
    [
      { task_id: 6, time: "2026-09-09T22:00:00Z", value: 20 },
      { task_id: 6, time: "2026-09-09T22:01:00Z", value: 21 },
    ],
    [{ id: 6, name: "本站-可达性" }],
  );
  assert.equal(all[0].availability, 100);
  assert.equal(all[0].up, true);

  const none = computeHttpReachability([], [{ id: 9, name: "任意" }]);
  assert.equal(none[0].availability, null);
  assert.equal(none[0].up, null);
});

test("只统计本任务的采样（task_id 过滤）", () => {
  const [h] = computeHttpReachability(
    [
      { task_id: 6, time: "2026-09-09T22:00:00Z", value: -1 }, // 其它任务的失败，不影响任务 7
      { task_id: 7, time: "2026-09-09T22:00:00Z", value: 90 },
    ],
    [{ id: 7, name: "CNB-AI-反代" }],
  );
  assert.equal(h.availability, 100);
});

test("complete-window availability is independent from downsampled timeline", () => {
  const stats = summarizePingHistory({
    records: [{task_id: 7, time: "2026-10-11T00:00:00Z", value: -1}],
    tasks: [{id: 7, name: "website", type: "http", total: 100, loss: 3, avg: 120}],
  });
  assert.equal(stats.httpReachability[0].availability, 97);
  assert.equal(stats.httpReachability[0].up, false);
});
