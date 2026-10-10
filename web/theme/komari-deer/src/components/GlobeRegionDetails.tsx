import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MapRegionSummary } from "@/utils/mapRegions";
import type { LiveData } from "@/types/LiveData";
import { getNodeHealth } from "@/lib/dashboard";
import { emptyPingStats } from "@/lib/ping";
import Flag from "./Flag";

export function GlobeRegionDetails({ region, liveData }: { region: MapRegionSummary; liveData?: LiveData | null }) {
  const { t } = useTranslation();
  const online = useMemo(() => new Set(liveData?.online), [liveData]);
  const percent = (value: number | null) => value == null ? "—" : `${Math.round(value)}%`;
  return <section className="globe-region-details" aria-label={region.label}>
    <header><Flag flag={region.flagCode} /><strong>{region.label}</strong><span>{region.total} {t("dashboard.total")}</span></header>
    <div className="globe-region-details__nodes">
      {region.nodes.map((node) => {
        const live = liveData?.data[node.uuid];
        const status = !live ? "unknown" : online.has(node.uuid) ? "online" : "offline";
        const health = getNodeHealth(node, live, status, emptyPingStats());
        return <a key={node.uuid} href={`#/instance/${node.uuid}`} className="globe-region-details__node">
          <div><strong>{node.name}</strong><span className={`status-${status}`}>{t(`dashboard.${status}`)}</span></div>
          <dl><div><dt>CPU</dt><dd>{percent(health.cpu)}</dd></div><div><dt>RAM</dt><dd>{percent(health.ram)}</dd></div><div><dt>{t("nodeCard.disk")}</dt><dd>{percent(health.disk)}</dd></div></dl>
        </a>;
      })}
    </div>
  </section>;
}
