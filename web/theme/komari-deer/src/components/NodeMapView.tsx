"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "@/types/LiveData";
import { buildMapViewSummary } from "@/utils/mapRegions";
import Flag from "@/components/Flag";
import { GlobeRegionDetails } from "./GlobeRegionDetails";
import { PixelGlobe } from "./PixelGlobe";
import "./NodeMapView.css";

interface NodeMapViewProps {
  nodes: NodeBasicInfo[];
  liveData?: LiveData | null;
  mapOnly?: boolean;
}

export function NodeMapView({ nodes, liveData, mapOnly = false }: NodeMapViewProps) {
  const { t } = useTranslation();
  const summary = useMemo(() => buildMapViewSummary(nodes, liveData), [nodes, liveData]);
  const regionsByKey = useMemo(() => new Map(summary.regions.map((region) => [region.key, region])), [summary.regions]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hovered = hoveredKey ? regionsByKey.get(hoveredKey) : null;
  const selected = selectedKey ? regionsByKey.get(selectedKey) : null;
  return <div className={`node-map-view ${mapOnly ? "node-map-view--embedded" : ""}`}>
    <div className="node-map-view__copy">
      <p className="node-map-view__eyebrow">MANGOHUB / GLOBAL NETWORK</p>
      <h2>{t("mapView.title")}</h2>
      <p className="node-map-view__description">{t("mapView.servers", { count: summary.totalNodes })}<span aria-hidden="true"> / </span>{t("mapView.activeCountries", { count: summary.regions.length })}</p>
      <div className="node-map-view__legend">
        {(["online", "offline", "unknown"] as const).map((status) => <span key={status} className="node-map-view__legend-item"><i className={`status-${status}`} aria-hidden="true" />{t(`dashboard.${status}`)} <strong>{summary[`${status}Nodes`]}</strong></span>)}
      </div>
      <div className="node-map-view__regions" aria-label={t("mapView.title")}>
        {summary.regions.map((region) => <button key={region.key} type="button" aria-pressed={region.key === selectedKey} aria-label={`${region.label} · ${t(region.status === "partial" ? "mapView.status.partial" : `dashboard.${region.status}`)} · ${region.total}`} onClick={() => setSelectedKey(region.key)}>
          <Flag flag={region.flagCode} size="5" /><span>{region.flagCode}</span><span className={`node-map-view__region-count status-${region.status}`}>{region.total}</span>
        </button>)}
      </div>
      <div className="node-map-view__selection" aria-live="polite">
        {selected ? <><p><strong>{selected.label}</strong><span>{t(selected.status === "partial" ? "mapView.status.partial" : `dashboard.${selected.status}`)}</span></p><div className="node-map-view__node-links">{selected.nodes.map((node) => <a key={node.uuid} href={`#/instance/${node.uuid}`}>{node.name}<span aria-hidden="true"> ↗</span></a>)}</div></> : <p className="text-muted-foreground">{t("dashboard.globeHint")}</p>}
      </div>
      {summary.unmappedNodes.length > 0 && <details className="node-map-view__unmapped"><summary>{t("mapView.regionUnknown")} · {summary.unmappedNodes.length}</summary><div className="node-map-view__node-links">{summary.unmappedNodes.map((node) => <a key={node.uuid} href={`#/instance/${node.uuid}`}>{node.name}</a>)}</div></details>}
    </div>
    <PixelGlobe regions={summary.regions} selectedKey={selectedKey} onSelect={setSelectedKey} onHover={setHoveredKey} hoverDetails={hovered ? <div className="pixel-globe__hover"><GlobeRegionDetails region={hovered} liveData={liveData} /></div> : undefined} />
  </div>;
}
