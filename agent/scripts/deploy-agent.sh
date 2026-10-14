#!/bin/bash
# mangohub-agent 原子部署(Bohrium 无 systemd,走 watchdog pidfile 换 bin 重启)
# 用法: deploy-agent.sh <host-dir> [new-bin-path]
#   <host-dir>     例 /personal/beszel/tebi 或 /personal/beszel/pxed
#   [new-bin-path] 缺省 /tmp/mangohub-agent.new (兼容 /tmp/komari-agent.new)
set -uo pipefail
DIR="${1:?host-dir required, e.g. /personal/beszel/tebi}"
NEW="${2:-}"
if [ -z "$NEW" ]; then
  if [ -f /tmp/mangohub-agent.new ]; then
    NEW="/tmp/mangohub-agent.new"
  elif [ -f /tmp/komari-agent.new ]; then
    NEW="/tmp/komari-agent.new"
  else
    NEW="/tmp/mangohub-agent.new"
  fi
fi

BIN="/usr/local/bin/mangohub-agent"
LEGACY_BIN="/usr/local/bin/komari-agent"
LOOP="$DIR/mangohub-agent-loop.sh"
[ -f "$LOOP" ] || LOOP="$DIR/komari-agent-loop.sh"
PIDF="$DIR/mangohub-agent-loop.pid"
[ -f "$PIDF" ] || PIDF="$DIR/komari-agent-loop.pid"
LOGF="$DIR/mangohub-agent-loop.log"
[ -f "$LOGF" ] || LOGF="$DIR/komari-agent-loop.log"
TS(){ date "+%Y-%m-%d %H:%M:%S"; }
log(){ echo "[$(TS)] $*" >> "$LOGF"; }

[ -f "$NEW" ]  || { echo "FATAL: missing new binary $NEW" >&2; exit 2; }
[ -f "$LOOP" ] || { echo "FATAL: missing watchdog $LOOP" >&2; exit 3; }
[ "$(head -c 4 "$NEW" 2>/dev/null | od -An -tx1 | tr -d ' \n')" = "7f454c46" ] || { echo "FATAL: $NEW not an ELF" >&2; exit 4; }
chmod +x "$NEW"
"$NEW" --help >/dev/null 2>&1 || { echo "FATAL: new binary smoke test failed" >&2; exit 5; }

# 1. 停旧 watchdog(其 TERM trap 会杀 agent + 删 pidfile);再保险清残留 agent
if [ -f "$PIDF" ]; then
  OLD=$(cat "$PIDF" 2>/dev/null || true)
  if [ -n "${OLD:-}" ] && kill -0 "$OLD" 2>/dev/null; then
    log "deploy: stopping watchdog pid=$OLD"
    kill -TERM "$OLD" 2>/dev/null || true
    for _ in $(seq 1 30); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
    kill -9 "$OLD" 2>/dev/null || true
  fi
  rm -f "$PIDF"
fi
for pattern in '^/usr/local/bin/mangohub-agent$' '^/usr/local/bin/komari-agent$'; do
  if pgrep -f "$pattern" >/dev/null; then
    log "deploy: killing stray agent ($pattern)"
    pkill -9 -f "$pattern"
    sleep 1
  fi
done

# 2. 换 bin(留 .old 回滚)
[ -f "$BIN" ] && mv "$BIN" "$BIN.old"
mv "$NEW" "$BIN"
chmod +x "$BIN"
ln -sf "$BIN" "$LEGACY_BIN" 2>/dev/null || true

# 3. 重启 watchdog(setsid 脱离 SSH,断开不杀);有界轮询 pidfile(慢宿主机不误报)
setsid nohup "$LOOP" "$DIR" >/dev/null 2>&1 &
NEWPID=""
for _ in $(seq 1 15); do
  NEWPID=$(cat "$PIDF" 2>/dev/null || true)
  [ -n "$NEWPID" ] && kill -0 "$NEWPID" 2>/dev/null && break
  sleep 1
done
if [ -n "${NEWPID:-}" ] && kill -0 "$NEWPID" 2>/dev/null; then
  log "deploy: OK bin=$BIN watchdog=$NEWPID"
  echo "DEPLOY_OK watchdog=$NEWPID"
else
  log "deploy: FAIL watchdog did not start"
  echo "FATAL: watchdog did not start" >&2
  exit 6
fi
