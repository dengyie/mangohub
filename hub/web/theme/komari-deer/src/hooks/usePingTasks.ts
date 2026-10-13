import { useCallback, useEffect, useState } from "react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { parsePingTasks, type PingTaskType } from "@/lib/ping";

export function usePingTasks() {
  const { callViaHTTP } = useRPC2Call();
  const [types, setTypes] = useState<ReadonlyMap<number, PingTaskType>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      setLoading(true);
      try {
        const result = await callViaHTTP<undefined, unknown>("public:getPublicPingTasks", undefined, { signal: controller.signal, timeout: 10000 });
        if (controller.signal.aborted) return;
        setTypes(new Map(parsePingTasks(result).map((task) => [task.id, task.type])));
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const failure = new Error("Ping task metadata unavailable");
        failure.cause = cause;
        setTypes(new Map());
        setError(failure);
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(refresh, 60000); }
      }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [callViaHTTP, revision]);
  return { types, error, loading, retry };
}
