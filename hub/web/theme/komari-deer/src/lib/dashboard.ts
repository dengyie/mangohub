import type { PingStats } from "./ping";

export type NodeStatus = "online" | "offline" | "unknown";
export type HealthFilter = "all" | "attention" | "offline" | "cpu" | "ram" | "disk" | "loss" | "unknown";
export interface NodeHealth {
  status: NodeStatus;
  cpu: number | null;
  ram: number | null;
  disk: number | null;
  loss: number | null;
  attention: boolean;
  unknown: boolean;
}
interface Metrics {
  cpu?: { usage: number };
  ram?: { used: number };
  disk?: { used: number };
  validMetrics?: { cpu: boolean; ram: boolean; disk: boolean; network: boolean };
}
function valid(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function percent(used: unknown, total: number): number | null {
  const value = valid(used);
  return value != null && Number.isFinite(total) && total > 0 ? value / total * 100 : null;
}
export function getNodeHealth(basic: { mem_total: number; disk_total: number }, live: Metrics | undefined, status: NodeStatus, ping: PingStats): NodeHealth {
  const current = status === "online";
  const cpu = current && live?.validMetrics?.cpu !== false ? valid(live?.cpu?.usage) : null;
  const ram = current && live?.validMetrics?.ram !== false ? percent(live?.ram?.used, basic.mem_total) : null;
  const disk = current && live?.validMetrics?.disk !== false ? percent(live?.disk?.used, basic.disk_total) : null;
  const loss = current ? ping.avgLoss : null;
  return {
    status, cpu, ram, disk, loss,
    attention: status === "offline" || [cpu, ram, disk].some((v) => v != null && v >= 90) || (loss != null && loss > 5),
    unknown: status === "unknown" || (current && (cpu == null || ram == null || disk == null || !ping.hasData)),
  };
}
export function matchesHealthFilter(health: NodeHealth, filter: HealthFilter): boolean {
  if (filter === "all") return true;
  if (filter === "offline") return health.status === "offline";
  if (filter === "attention" || filter === "unknown") return health[filter];
  const value = health[filter];
  return value != null && (filter === "loss" ? value > 5 : value >= 90);
}
export function aggregateHealth(items: Iterable<NodeHealth>) {
  let total = 0, online = 0, offline = 0, attention = 0, unknown = 0, cpuSum = 0, cpuCount = 0;
  for (const item of items) {
    total++;
    if (item.status === "online") online++;
    if (item.status === "offline") offline++;
    if (item.attention) attention++;
    if (item.unknown) unknown++;
    if (item.cpu != null) { cpuSum += item.cpu; cpuCount++; }
  }
  return { total, online, offline, attention, unknown, meanCpu: cpuCount ? cpuSum / cpuCount : null };
}
