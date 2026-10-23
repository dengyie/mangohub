#!/bin/bash
# komari-agent 保活看门狗(Bohrium 无 systemd 替代;参照 beszel agent-loop.sh)
# 用法: komari-agent-loop.sh <host-dir>
#
# 2026-10-23 新增数据新鲜度自愈: agent WebSocket 会半死(TCP ESTAB 但 Hub 收不到
# 数据, pxed 2026-10-23 实证: 进程 Oct11 起、连接在、Hub 无数据 11 天), 只看 pid
# 察觉不了。每 STALE_TICK 轮向 Hub 公开 API 查本节点 recent 最新时间戳, 超过
# STALE_LIMIT 连续 2 次即 kill agent 由本循环拉起。
#
# 2026-10-23 修复误杀: 旧实现把 curl 失败/JSON 解析失败也当成超龄, 在抖动的
# 中国->Cloudflare 链路上探测经常超时, 连续两次探测失败就 kill 健康 agent
# (tebi/pxed 当天分别被误杀 12/15 次, 而 Hub 侧每分钟都有数据)。现改为三态:
# 只有 HTTP 200 且 JSON 解析成功、读到时间戳才判定新鲜/超龄; 探测失败记 UNKNOWN,
# 既不增加也不清零计数。
set -uo pipefail

DIR="${1:-/personal/beszel}"
BIN="/usr/local/bin/komari-agent"
ENVF="$DIR/komari-agent.env"
PIDF="$DIR/komari-agent-loop.pid"
LOGF="$DIR/komari-agent-loop.log"
ALOG="$DIR/komari-agent.log"
TICK=15
# 数据新鲜度自愈参数
STALE_TICK=20          # 每 20 轮(≈5 分钟)查一次 Hub
STALE_LIMIT=900        # 数据龄超过 900s(15 分钟)视为断流
STALE_FAILS=2          # 连续 2 次确认超龄才动手
STALE_RETRIES=3        # 单次判断内部重试次数(抵抗链路抖动)
HUB_PUBLIC="https://vps.mangoqwq.com"
NODE_NAME=""           # 从 $DIR/komari-agent-node.conf 读, 读不到再按 hostname 猜
TS() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(TS)] $*" >> "$LOGF"; }

[ -f "$ENVF" ] || { echo "missing $ENVF" >&2; exit 2; }
# 节点标识: 显式配置优先(推荐), 否则按 hostname 关键字猜(Bohrium 容器主机名是随机串, 猜不中)
NODE_CONF="$DIR/komari-agent-node.conf"
if [ -f "$NODE_CONF" ]; then
  NODE_NAME=$(grep -E "^NODE_NAME=" "$NODE_CONF" | head -1 | cut -d= -f2-)
fi

cleanup() {
  log "watchdog exit pid=$$ (signal)"
  [ -n "${AGENT_PID:-}" ] && kill -TERM "$AGENT_PID" 2>/dev/null || true
  rm -f "$PIDF"; exit 0
}

if [ -f "$PIDF" ]; then
  OLD=$(cat "$PIDF" 2>/dev/null)
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    log "stopping old watchdog pid=$OLD"
    kill -TERM "$OLD" 2>/dev/null || true
    for _ in $(seq 1 30); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
    kill -9 "$OLD" 2>/dev/null || true; rm -f "$PIDF"
  fi
fi
echo $$ > "$PIDF"
trap cleanup TERM INT

log "=== komari watchdog start pid=$$ dir=$DIR (stale-selfheal on) ==="
AGENT_PID=""
# 节点标识兜底: 仅当配置文件没给 NODE_NAME 时才按 hostname 猜
# (Bohrium 容器主机名是随机串, v3 教训: 猜不中 -> uuid 永远空 -> 永远误判 stale 误杀 agent)
if [ -z "$NODE_NAME" ]; then
  NODE_KEY="$(hostname | tr 'A-Z' 'a-z')"
  case "$NODE_KEY" in
    *tebi*)  NODE_NAME="tebi" ;;
    *pxed*)  NODE_NAME="pxed" ;;
    *)       NODE_NAME="$NODE_KEY" ;;
  esac
fi
# uuid 可直接写进配置固化(推荐), 也可留空由 Hub 节点名匹配解析, 成功后自动写回
NODE_UUID=""
if [ -f "$NODE_CONF" ]; then
  NODE_UUID=$(grep -E "^NODE_UUID=" "$NODE_CONF" | head -1 | cut -d= -f2-)
fi
TICKN=0
STALE_N=0

fetch_uuid() {
  NODE_UUID=$(curl --noproxy "*" -fsS --max-time 10 -A "komari-agent-loop/1.0" \
    "$HUB_PUBLIC/api/nodes" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    nodes = d if isinstance(d, list) else d.get('data', [])
    for n in nodes:
        if '$NODE_NAME' in (n.get('name') or '').lower():
            print(n.get('uuid', '')); break
except Exception:
    pass
" 2>/dev/null)
  # 解析成功即固化到配置, 下次重启不再依赖 Hub 节点名匹配
  if [ -n "$NODE_UUID" ]; then
    if [ -f "$NODE_CONF" ] && grep -qE "^NODE_UUID=" "$NODE_CONF"; then
      sed -i.bak-uuid "s|^NODE_UUID=.*|NODE_UUID=$NODE_UUID|" "$NODE_CONF"
    else
      echo "NODE_UUID=$NODE_UUID" >> "$NODE_CONF"
    fi
    log "node uuid resolved+persisted: $NODE_NAME -> $NODE_UUID"
  fi
}

# 单次探测: 0=新鲜 1=确认超龄 2=无法判定
# 只有 HTTP 200 + JSON 解析成功才给结论; 空 data 表示确实没上报, 算超龄。
probe_once() {
  local out
  out=$(curl --noproxy "*" -fsS --max-time 10 -A "komari-agent-loop/1.0" \
    "$HUB_PUBLIC/api/recent/$NODE_UUID" 2>/dev/null | python3 -c '
import sys, json, datetime, re
limit = int(sys.argv[1])
try:
    d = json.load(sys.stdin)
except Exception:
    print("UNKNOWN"); raise SystemExit
rows = d if isinstance(d, list) else d.get("data")
if not isinstance(rows, list):
    print("UNKNOWN"); raise SystemExit
if not rows:
    print("STALE"); raise SystemExit
t = rows[-1].get("updated_at") or rows[-1].get("time") or rows[-1].get("createdAt") or ""
m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$", t)
if not m:
    print("UNKNOWN"); raise SystemExit
frac = (m.group(2) or ".0")[:7]
tz = m.group(3) or "+00:00"
if tz == "Z":
    tz = "+00:00"
if len(tz) == 6 and ":" not in tz:
    tz = tz[:3] + ":" + tz[3:]
try:
    dt = datetime.datetime.fromisoformat(m.group(1) + frac + tz)
except Exception:
    print("UNKNOWN"); raise SystemExit
age = (datetime.datetime.now(datetime.timezone.utc) - dt).total_seconds()
print("STALE" if age > limit else "FRESH")
' "$STALE_LIMIT" 2>/dev/null)
  case "$out" in
    FRESH) return 0 ;;
    STALE) return 1 ;;
    *)     return 2 ;;
  esac
}

# 返回 0=新鲜 1=确认超龄 2=无法判定(不计数)
check_stale() {
  if [ -z "$NODE_UUID" ]; then
    fetch_uuid
    # uuid 解析不到是"无法判定", 不能当 stale 处理, 否则 conf 丢失会复发 v3 的连杀循环
    if [ -z "$NODE_UUID" ]; then
      log "node uuid unknown, skip stale check (no kill)"
      return 0
    fi
  fi
  local i rc
  for i in $(seq 1 "$STALE_RETRIES"); do
    rc=0
    probe_once || rc=$?
    [ "$rc" -ne 2 ] && return "$rc"
    sleep 3
  done
  return 2
}

while true; do
  if [ -z "$AGENT_PID" ] || ! kill -0 "$AGENT_PID" 2>/dev/null; then
    [ -n "$AGENT_PID" ] && log "agent died, restarting"
    set -a; . "$ENVF"; set +a
    "$BIN" >> "$ALOG" 2>&1 &
    AGENT_PID=$!
    log "agent started pid=$AGENT_PID"
  fi
  TICKN=$((TICKN + 1))
  if [ "$TICKN" -ge "$STALE_TICK" ]; then
    TICKN=0
    rc=0
    check_stale || rc=$?
    case "$rc" in
      1)
        STALE_N=$((STALE_N + 1))
        log "hub data stale (confirmed age>${STALE_LIMIT}s) $STALE_N/$STALE_FAILS"
        if [ "$STALE_N" -ge "$STALE_FAILS" ]; then
          log "agent alive but hub got no data -- killing pid=$AGENT_PID to resync"
          kill -9 "$AGENT_PID" 2>/dev/null || true
          AGENT_PID=""
          STALE_N=0
        fi
        ;;
      2)
        log "stale probe inconclusive (link/API failure), not counted (stale_n=$STALE_N)"
        ;;
      *)
        [ "$STALE_N" -gt 0 ] && { log "hub data fresh again (stale_n=$STALE_N cleared)"; STALE_N=0; }
        ;;
    esac
  fi
  waited=0
  while [ "$waited" -lt "$TICK" ]; do sleep 5; waited=$((waited + 5)); done
done
