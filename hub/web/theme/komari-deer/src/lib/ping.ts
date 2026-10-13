export type PingTaskType = "icmp" | "tcp" | "http";
export interface PingTask { id: number; name: string; type: PingTaskType }
export interface LivePingSummary { name: string; avg: number; loss: number }
export type LivePing = { [id: string]: LivePingSummary };
export interface PingHistoryPoint { time: string; latency: number | null; loss: number | null }
export interface PingStats {
  avgLatency: number | null;
  avgLoss: number | null;
  history: PingHistoryPoint[];
  hasData: boolean;
  httpReachability: { name: string; up: boolean | null; availability: number | null }[];
}

export function emptyPingStats(): PingStats {
  return { avgLatency: null, avgLoss: null, history: [], hasData: false, httpReachability: [] };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid ping object");
  return value as Record<string, unknown>;
}
function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ping ${label}`);
  return value;
}
function id(value: unknown): number {
  const result = finite(value, "task id");
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Invalid ping task id");
  return result;
}
function loss(value: unknown): number {
  const result = finite(value, "loss");
  if (result < 0 || result > 100) throw new Error("Invalid ping loss");
  return result;
}
function latency(value: unknown): number {
  const result = finite(value, "latency");
  if (result < 0) throw new Error("Invalid ping latency");
  return result;
}
function timestamp(value: unknown): number {
  if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error("Invalid ping timestamp");
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error("Invalid ping timestamp");
  return result;
}

export function parsePingTasks(value: unknown): PingTask[] {
  if (!Array.isArray(value)) throw new Error("Invalid ping tasks");
  const ids = new Set<number>();
  return value.map((item) => {
    const task = object(item);
    if (task.type !== "icmp" && task.type !== "tcp" && task.type !== "http") throw new Error("Invalid ping task type");
    if (typeof task.name !== "string") throw new Error("Invalid ping task name");
    const taskId = id(task.id);
    if (ids.has(taskId)) throw new Error("Invalid duplicate ping task");
    ids.add(taskId);
    return { id: taskId, name: task.name, type: task.type };
  });
}

export function parseLivePing(value: unknown): LivePing {
  const result: LivePing = {};
  for (const [key, item] of Object.entries(object(value))) {
    id(Number(key));
    const task = object(item);
    if (typeof task.name !== "string") throw new Error("Invalid ping task name");
    result[key] = { name: task.name, avg: latency(task.avg), loss: loss(task.loss) };
  }
  return result;
}

export function summarizeLivePing(summaries: LivePing, types: ReadonlyMap<number, PingTaskType>): PingStats {
  const result = emptyPingStats();
  let latencySum = 0, latencyCount = 0, lossSum = 0, lossCount = 0;
  for (const [key, task] of Object.entries(summaries)) {
    const type = types.get(Number(key));
    if (!type) continue;
    result.hasData = true;
    if (type === "http") {
      result.httpReachability.push({ name: task.name, up: null, availability: 100 - task.loss });
      continue;
    }
    lossSum += task.loss;
    lossCount++;
    if (task.loss === 100) continue;
    latencySum += task.avg;
    latencyCount++;
  }
  result.avgLatency = latencyCount ? latencySum / latencyCount : null;
  result.avgLoss = lossCount ? lossSum / lossCount : null;
  return result;
}

interface Samples { total: number; success: number; sum: number; newest: number; up: boolean | null }
const samples = (): Samples => ({ total: 0, success: 0, sum: 0, newest: -Infinity, up: null });
function addSample(target: Samples, value: number, time: number): void {
  target.total++;
  if (value >= 0) { target.success++; target.sum += value; }
  if (time >= target.newest) { target.newest = time; target.up = value >= 0; }
}

export function summarizePingHistory(value: unknown): PingStats {
  const payload = object(value);
  if (!Array.isArray(payload.records) || !Array.isArray(payload.tasks)) throw new Error("Invalid ping history");
  const tasks = parsePingTasks(payload.tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const byTask = new Map<number, Samples>();
  const records = payload.records.map((item) => {
    const record = object(item);
    return { id: id(record.task_id), time: timestamp(record.time), value: finite(record.value, "value") };
  });
  let first = Infinity, last = -Infinity;
  for (const record of records) { first = Math.min(first, record.time); last = Math.max(last, record.time); }
  const from = payload.from == null ? first : timestamp(payload.from);
  const to = payload.to == null ? last + 1 : timestamp(payload.to);
  if (Number.isFinite(from) && Number.isFinite(to) && to <= from) throw new Error("Invalid ping time range");
  const buckets = Array.from({ length: 24 }, samples);
  const width = (to - from) / buckets.length;
  for (const record of records) {
    const task = byId.get(record.id);
    if (!task || record.time < from || record.time > to) continue;
    let aggregate = byTask.get(record.id);
    if (!aggregate) { aggregate = samples(); byTask.set(record.id, aggregate); }
    addSample(aggregate, record.value, record.time);
    if (task.type === "http") continue;
    const index = Math.min(23, Math.floor((record.time - from) / width));
    addSample(buckets[index], record.value, record.time);
  }
  const result = emptyPingStats();
  let lossSum = 0, lossCount = 0, latencySum = 0, latencyCount = 0;
  tasks.forEach((task, index) => {
    const raw = object((payload.tasks as unknown[])[index]);
    const measured = byTask.get(task.id);
    const total = raw.total == null ? measured?.total ?? 0 : id(raw.total);
    const taskLoss = raw.loss == null ? undefined : loss(raw.loss);
    const taskAvg = raw.avg == null ? undefined : latency(raw.avg);
    const measuredLoss = measured?.total ? (1 - measured.success / measured.total) * 100 : null;
    const averageLoss = total > 0 ? taskLoss ?? measuredLoss : null;
    result.hasData ||= total > 0;
    if (task.type === "http") {
      result.httpReachability.push({ name: task.name, up: measured?.up ?? null, availability: averageLoss == null ? null : 100 - averageLoss });
      return;
    }
    if (averageLoss != null) { lossSum += averageLoss; lossCount++; }
    if (averageLoss == null || averageLoss === 100) return;
    const avg = taskAvg ?? (measured?.success ? measured.sum / measured.success : null);
    if (avg != null) { latencySum += avg; latencyCount++; }
  });
  result.avgLoss = lossCount ? lossSum / lossCount : null;
  result.avgLatency = latencyCount ? latencySum / latencyCount : null;
  if (Number.isFinite(from) && Number.isFinite(to)) {
    result.history = buckets.map((bucket, index) => ({
      time: new Date(from + width * index).toISOString(),
      latency: bucket.success ? bucket.sum / bucket.success : null,
      loss: bucket.total ? (1 - bucket.success / bucket.total) * 100 : null,
    }));
  }
  return result;
}
