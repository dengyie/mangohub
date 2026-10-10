import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "@/types/LiveData";
import { resolveFlagCode } from "@/utils/flag";
import { emojiToRegionMap } from "@/utils/regionHelper";

type RegionStatus = "online" | "offline" | "partial" | "unknown";

type RegionMeta = {
  key: string;
  label: string;
  mapName: string;
  flagCode: string;
};

const regionMetaOverridesByFlagCode: Record<
  string,
  Partial<Pick<RegionMeta, "label" | "mapName">>
> = {
  US: { label: "United States", mapName: "United States of America" },
  TR: { label: "Turkey", mapName: "Turkey" },
  MO: { label: "Macau", mapName: "Macao" },
  HK: { label: "Hong Kong", mapName: "Hong Kong" },
};

const englishRegionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export interface MapRegionSummary {
  emoji: string;
  key: string;
  label: string;
  mapName: string;
  flagCode: string;
  total: number;
  online: number;
  offline: number;
  unknown: number;
  status: RegionStatus;
  nodes: NodeBasicInfo[];
}

export interface MapViewSummary {
  regions: MapRegionSummary[];
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unknownNodes: number;
  unmappedNodes: NodeBasicInfo[];
}

function getRegionStatus(online: number, offline: number, unknown: number): RegionStatus {
  if (unknown > 0) return "unknown";
  if (online === 0) {
    return "offline";
  }

  if (offline === 0) {
    return "online";
  }

  return "partial";
}

function resolveRegionMetaFromFlagCode(flagCode: string): RegionMeta | null {
  if (flagCode === "UN") {
    return null;
  }

  const displayName = englishRegionDisplayNames?.of(flagCode)?.trim();
  if (!displayName) {
    return null;
  }

  const overrides = regionMetaOverridesByFlagCode[flagCode];

  return {
    key: flagCode,
    label: overrides?.label ?? displayName,
    mapName: overrides?.mapName ?? displayName,
    flagCode,
  };
}

function resolveRegionMeta(region: string): RegionMeta | null {
  const flagCode = resolveFlagCode(region);
  const standardizedMeta = resolveRegionMetaFromFlagCode(flagCode);
  if (standardizedMeta) {
    return standardizedMeta;
  }

  const regionInfo = emojiToRegionMap[region];
  if (!regionInfo) {
    return null;
  }

  return {
    key: flagCode,
    label: regionInfo.en,
    mapName: regionInfo.en,
    flagCode,
  };
}

export function buildMapViewSummary(nodes: NodeBasicInfo[], liveData?: LiveData | null): MapViewSummary {
  const hasLiveStatus = Boolean(liveData);
  const onlineSet = hasLiveStatus ? new Set(liveData?.online ?? []) : null;
  const regionMap = new Map<string, MapRegionSummary>();
  const unmappedNodes: NodeBasicInfo[] = [];
  let onlineNodes = 0, offlineNodes = 0, unknownNodes = 0;

  for (const node of nodes) {
    const known = Boolean(liveData?.data[node.uuid]);
    const isNodeOnline = known && Boolean(onlineSet?.has(node.uuid));
    if (!known) unknownNodes++;
    else if (isNodeOnline) onlineNodes++;
    else offlineNodes++;
    const regionMeta = resolveRegionMeta(node.region);

    if (!regionMeta) {
      unmappedNodes.push(node);
      continue;
    }

    const existing = regionMap.get(regionMeta.key);

    if (existing) {
      existing.nodes.push(node);
      existing.total += 1;
      if (!known) existing.unknown++;
      else if (isNodeOnline) existing.online++;
      else existing.offline++;
      existing.status = getRegionStatus(existing.online, existing.offline, existing.unknown);
      continue;
    }

    regionMap.set(regionMeta.key, {
      emoji: node.region,
      key: regionMeta.key,
      label: regionMeta.label,
      mapName: regionMeta.mapName,
      flagCode: regionMeta.flagCode,
      total: 1,
      online: isNodeOnline ? 1 : 0,
      offline: known && !isNodeOnline ? 1 : 0,
      unknown: known ? 0 : 1,
      status: getRegionStatus(isNodeOnline ? 1 : 0, known && !isNodeOnline ? 1 : 0, known ? 0 : 1),
      nodes: [node],
    });
  }

  const regions = Array.from(regionMap.values()).sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    if (right.online !== left.online) {
      return right.online - left.online;
    }

    return left.label.localeCompare(right.label);
  });


  return {
    regions,
    totalNodes: nodes.length,
    onlineNodes,
    offlineNodes,
    unknownNodes,
    unmappedNodes,
  };
}
