import { useCallback, useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { emptyPingStats, summarizePingHistory, type PingStats } from "@/lib/ping";

interface PingState { uuid: string; stats: PingStats; loading: boolean; error: Error | null }
export function usePingStats(uuid: string, enabled: boolean) {
  const { callViaHTTP } = useRPC2Call();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<PingState>(() => ({ uuid, stats: emptyPingStats(), loading: false, error: null }));
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled || !uuid) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      setState({ uuid, stats: emptyPingStats(), loading: true, error: null });
      try {
        const response = await callViaHTTP<{ uuid: string; type: string; hours: number; max_count: number }, unknown>(
          "common:getRecords", { uuid, type: "ping", hours: 1, max_count: 4000 }, { signal: controller.signal, timeout: 15000 },
        );
        if (controller.signal.aborted) return;
        setState({ uuid, stats: summarizePingHistory(response), loading: false, error: null });
      } catch (cause) {
        if (controller.signal.aborted) return;
        const error = new Error("Ping history unavailable");
        error.cause = cause;
        setState({ uuid, stats: emptyPingStats(), loading: false, error });
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 60000);
      }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [uuid, enabled, revision, callViaHTTP]);
  const current = state.uuid === uuid ? state : { stats: emptyPingStats(), loading: enabled, error: null };
  return { ...current, retry };
}
