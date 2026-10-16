import type { NodeBasicInfo } from "./NodeListContext";

export function toNodeBasicInfo(n: Record<string, any>): NodeBasicInfo {
  return {
    uuid: n.uuid,
    name: n.name,
    cpu_name: n.cpu_name,
    virtualization: n.virtualization,
    arch: n.arch,
    cpu_cores: n.cpu_cores,
    os: n.os,
    kernel_version: n.kernel_version,
    gpu_name: n.gpu_name,
    region: n.region,
    mem_total: n.mem_total,
    swap_total: n.swap_total,
    disk_total: n.disk_total,
    // 兼容旧字段，若无版本信息则给空串
    version: n.version ?? "",
    weight: n.weight ?? 0,
    price: n.price ?? 0,
    tags: n.tags ?? "",
    // 缺字段必须保持缺字段。收成 false 会让「上报没带到」和「明确不可控」变成同一种机器。
    ...(typeof n.miner_configured === "boolean"
      ? { miner_configured: n.miner_configured }
      : {}),
    ...(typeof n.miner_controllable === "boolean"
      ? { miner_controllable: n.miner_controllable }
      : {}),
    billing_cycle: n.billing_cycle ?? 0,
    currency: n.currency ?? "",
    group: n.group ?? "",
    traffic_limit: n.traffic_limit ?? 0,
    traffic_limit_type: n.traffic_limit_type,
    expired_at: n.expired_at ?? "",
    created_at: n.created_at ?? "",
    updated_at: n.updated_at ?? "",
    ipv4: n.ipv4,
    ipv6: n.ipv6,
  };
}
