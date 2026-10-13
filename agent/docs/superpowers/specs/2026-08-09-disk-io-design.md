# Mango Agent 磁盘 IO 采集模块 — 设计规范

- 日期:2026-08-09
- 状态:已归档
- 依赖:gopsutil v4.26.4(已在 go.mod)

## 1. 背景与目标

为了支持 Linux 主机和容器多块盘高精度 IOPS 与读写速率统计，Agent 需要采集物理块设备与挂载点映射的 IO 计数器（读 `/proc/diskstats`），计算采样窗口内的增量速率并上报给 Mangohub 主控。

**目标**: 给 agent 增加磁盘 IO 采集与上报。

## 2. 范围

- 采集磁盘 IO 读写速率与 IOPS。
- 保证挂载点映射到实际块设备（如 `/tmp/mnt` 映射到 `vda5`）。
- 异常场景优雅降级，不阻塞其他监控指标。

## 3. 方案

用 gopsutil 读 `/proc/diskstats` 的计数器(`disk.IOCounters`),用 `disk.Partitions(true)` 做挂载点→块设备映射,按配置的挂载点过滤,再以「两次采样差值 ÷ 实际间隔」算出速率。映射直接来自系统分区表,配置复用 agent 现有挂载点白名单。

## 4. 架构与组件

新增一个采集单元 + 扩展现有上报,不重构:

```
monitoring/unit/disk_io.go   ← 新增
   ├─ 挂载点→设备: disk.Partitions(true) → 按 IncludeMountpoints 过滤出挂载点,取其 Device(去 /dev/ 前缀)
   ├─ 设备→计数器: disk.IOCounters() 一次取全量 map[设备名]IOCountersStat
   ├─ delta 速率:  本次计数 - 上次计数 ÷ 实际 elapsed(复用 netstatic 的 safeDelta 模式)
   └─ 内存缓存:    lastCounters + lastSampleTime(包级变量)
monitoring/monitoring.go    ← 扩展
   └─ report 结构加 DiskIO 字段;GenerateReport 里填充
```

**边界**:只读不写、失败不阻塞——IO 采集出错时 `disk_io` 字段缺省(`omitempty`),其余指标照常,与现有「指标失败只往 message 追加」模式一致。

## 5. 数据流

```
disk.Partitions(true)  ──▶  { "/tmp/mnt" → "/dev/vda5", "/hostfs" → "/dev/sda1", ... }
disk.IOCounters()      ──▶  { "vda5" → {ReadBytes, WriteBytes, ReadCount, WriteCount}, ... }
        │
        ▼
按挂载点取对应设备 → 与上次计数算 delta → 速率 = delta / elapsed
        │
        ▼
report.DiskIO = [ {device, mountpoint, read_bytes, write_bytes, read_iops, write_iops} ]
```

速率计算细节:

- **首次采样**:只记录基线计数与时间,不输出速率(无前值可比)。
- **计数器回绕/重置**:复用 netstatic 的 `safeDelta`(cur < prev 视为 0 增量)。
- **elapsed**:两次 `GenerateReport` 的实际间隔,不假设固定上报周期(AGENT_INTERVAL 可配)。

## 6. 配置(复用现有旗标)

| 环境变量 | 说明 | 现网示例 |
|---|---|---|
| `AGENT_INCLUDE_MOUNTPOINTS` | 分号分隔挂载点白名单;**已有旗标,IO 直接复用** | tebi/pxed:`/tmp/mnt`;googlevps:`/hostfs`;hk:`/` |
| `HOST_PROC` | gopsutil 读宿主 `/proc` 的挂载点(已有旗标)——tebi/pxed 容器内拿 vda5 的关键路径,与 Beszel 同机制 | 由部署环境决定 |

挂载点过滤逻辑与现有 `unit.Disk()` 完全一致:

- 配置了 `IncludeMountpoints` → 只统计白名单内的挂载点;
- 未配置 → 默认遍历所有物理盘(`isPhysicalDisk`),IO 跟随容量统计的同一批设备。

**零行为**:未配置 `AGENT_INCLUDE_MOUNTPOINTS` 时仍会采集物理盘 IO(与现有 disk 容量逻辑一致),老配置无需任何改动;采集失败则为空数组。

## 7. 上报格式

```json
"disk_io": [
  {
    "device": "vda5",
    "mountpoint": "/tmp/mnt",
    "read_bytes": 1234,   // 读速率,字节/秒
    "write_bytes": 5678,  // 写速率,字节/秒
    "read_iops": 12,      // 读 IOPS,次/秒
    "write_iops": 34      // 写 IOPS,次/秒
  }
]
```

- 未配置挂载点时 `disk_io` 跟随默认物理盘集合;采集失败时字段缺省(`omitempty`)。
- **兼容性**:server 端 `v1.Report` 结构无 `disk_io` 字段,`json.Unmarshal` 静默忽略未知字段(已核实 `web/api/client/ingest.go` 链路);`protocol/v2/jsonrpc.go` 的 `BuildReportPayload` 将 report 字节原样透传。hub 不会因加字段报错。

## 8. 错误处理

| 场景 | 行为 |
|---|---|
| `disk.Partitions` 失败 | 跳过 IO 采集,`disk_io` 字段缺省(`omitempty`),message 追加日志,不阻塞 |
| `disk.IOCounters` 失败 | 同上 |
| 挂载点在分区表里无对应设备 | 跳过该条;若全部跳过,`disk_io` 为空数组 `[]` |
| 首次采样 | 只记基线,输出空 |

## 9. 测试

- 单测(`monitoring/unit/disk_io_test.go`):构造假 `PartitionStat` / `IOCountersStat` 注入,不依赖真实 `/proc`:
  - 挂载点→设备映射正确
  - delta 速率计算正确(含 elapsed 缩放)
  - 首次采样零输出、计数器回绕零增量
  - 空配置走默认物理盘逻辑
- `go vet ./...` + `go build ./...` 通过
- 本地 `go test ./monitoring/...` 通过

## 10. 架构决策

- 复用 `AGENT_INCLUDE_MOUNTPOINTS` 挂载点白名单。
- module path 为 `github.com/dengyie/mangohub/agent`。
- agent 自更新指向上游自建源 `dengyie/mangohub`。
- **平台差异(macOS/开发机)**:`disk.Partitions` 在 macOS 上报设备名带切片后缀(`/dev/disk3s1s1`),而 `disk.IOCounters()` 只返回整盘键(`disk0`/`disk4`),两者对不上 → `disk_io` 恒为空数组。**仅影响开发机**,Linux(生产目标主机)上设备名一致(`vda5`/`sda1`),设计如此。