"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";
import { useRPC2Call } from "./RPC2Context";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";
import { loadSnapshot, saveLiveDataSnapshot } from "@/lib/snapshotCache";
import { normalizeLiveData } from "@/lib/liveData";

interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  showCallout: boolean;
  isLive: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => () => void;
}
const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null, showCallout: false, isLive: false, onRefresh: () => () => {},
});

export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [refreshCallbacks] = useState(() => new Set<(data: LiveDataResponse) => void>());
  const { callViaHTTP } = useRPC2Call();
  const onRefresh = useCallback((callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
    return () => { refreshCallbacks.delete(callback); };
  }, [refreshCallbacks]);

  useIsomorphicLayoutEffect(() => {
    const snap = loadSnapshot();
    if (snap?.liveData) setLiveData(snap.liveData);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchLatest = async () => {
      try {
        const result = await callViaHTTP<undefined, unknown>("common:getNodesLatestStatus", undefined, { signal: controller.signal, timeout: 10000 });
        if (controller.signal.aborted) return;
        const live = normalizeLiveData(result);
        setLiveData(live);
        setIsLive(true);
        refreshCallbacks.forEach((callback) => callback(live));
        saveLiveDataSnapshot(live);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("RPC2 live status unavailable:", error);
        setIsLive(false);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(fetchLatest, 4000);
      }
    };
    void fetchLatest();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [callViaHTTP, refreshCallbacks]);

  return <LiveDataContext.Provider value={{ live_data, showCallout: isLive, isLive, onRefresh }}>{children}</LiveDataContext.Provider>;
};
export const useLiveData = () => useContext(LiveDataContext);
export default LiveDataContext;
