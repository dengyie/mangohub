"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import NodeDisplay from "@/components/NodeDisplay";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useNodeList } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import dynamic from "next/dynamic";
import { ChevronDown, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { Callouts } from "@/components/DashboardCallouts";
import { EarningsCard } from "@/components/EarningsCard";
const LazyNodeMapView = dynamic(() => import("@/components/NodeMapView").then((module) => module.NodeMapView), { ssr: false });
const MemoNodeDisplay = React.memo(NodeDisplay);

export default function DashboardContent() {
  const [t] = useTranslation();
  const { live_data, isLive } = useLiveData();
  const [mapOpen, setMapOpen] = useState(true);
  const { publicInfo } = usePublicInfo();
  
  // Sync document title with backend-set custom title
  useEffect(() => {
    if (publicInfo?.sitename) {
      document.title = publicInfo.sitename;
    }
  }, [publicInfo?.sitename]);
  
  //#region 节点数据
  const { nodeList, isLoading, error, refresh } = useNodeList();

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }
  // 有数据(nodeList 来自快照/上次成功)时错误降级为横幅,不整屏盖掉缓存内容
  if (error && !nodeList) {
    return <div>{t("common.error", { defaultValue: "Error" })}: {error}</div>;
  }
  //#endregion

  return (
    <div className="container mx-auto px-4 space-y-4">
      <Callouts />

      {error && nodeList ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {t("common.error", { defaultValue: "Error" })}: {error}
        </div>
      ) : null}

      <Suspense fallback={<div className="p-4">{t("nodes.loading", { defaultValue: "Loading nodes..." })}</div>}>
        <MemoNodeDisplay
          nodes={nodeList ?? []}
          liveData={live_data?.data ?? null}
          isLive={isLive}
        >
          <section className="overflow-hidden rounded-xl border bg-card">
            <Button variant="ghost" className="h-11 w-full justify-between rounded-none px-4 text-xs" aria-expanded={mapOpen} aria-controls="dashboard-map" onClick={() => setMapOpen((value) => !value)}>
              <span className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-muted-foreground" />{t("dashboard.map")}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mapOpen ? "rotate-180" : ""}`} />
            </Button>
            {mapOpen && <div id="dashboard-map"><LazyNodeMapView nodes={nodeList ?? []} liveData={isLive ? live_data?.data ?? null : null} mapOnly /></div>}
          </section>
        </MemoNodeDisplay>
      </Suspense>
      <EarningsCard />
    </div>
  );
}

