"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { geoCentroid, geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import world from "@/data/world-countries-50m.json";
import type { MapRegionSummary } from "@/utils/mapRegions";
import { Button } from "@/components/ui/button";
import { createGlobeSamples, GLOBE_GRID, GLOBE_PITCH, GLOBE_SIZE, projectGlobeLocation, TEXTURE_HEIGHT, TEXTURE_WIDTH, textureColumn } from "./pixelGlobeGeometry";

interface GlobeAtlas {
  pixels: Uint16Array;
  names: string[];
  centers: Map<string, [number, number]>;
}
let atlas: GlobeAtlas | undefined;

function getAtlas(): GlobeAtlas | null {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const countries = feature(world as never, world.objects.countries as never) as unknown as FeatureCollection<Geometry, { name: string }>;
  const projection = geoEquirectangular().scale(TEXTURE_WIDTH / (2 * Math.PI)).translate([TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2]);
  const path = geoPath(projection, context);
  const names = [""];
  const centers = new Map<string, [number, number]>();
  countries.features.forEach((country, index) => {
    const id = index + 1;
    names.push(country.properties.name);
    centers.set(country.properties.name, geoCentroid(country));
    context.beginPath();
    path(country);
    context.fillStyle = `rgb(${id & 255},${id >> 8},255)`;
    context.fill();
  });
  // Tiny territories are smaller than one texture pixel but still need a marker.
  centers.set("Hong Kong", [114.17, 22.32]);
  centers.set("Singapore", [103.82, 1.35]);
  centers.set("Macao", [113.54, 22.2]);
  const rgba = context.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT).data;
  const pixels = new Uint16Array(TEXTURE_WIDTH * TEXTURE_HEIGHT);
  for (let i = 0; i < pixels.length; i++) {
    const offset = i * 4;
    const id = rgba[offset] + (rgba[offset + 1] << 8);
    if (rgba[offset + 3] === 255 && id < names.length) pixels[i] = id;
  }
  atlas = { pixels, names, centers };
  return atlas;
}

interface PixelGlobeProps {
  regions: MapRegionSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  hoverDetails?: ReactNode;
}

export function PixelGlobe({ regions, selectedKey, onSelect, onHover, paused, onPausedChange, hoverDetails }: PixelGlobeProps) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const hoveringRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotation = useRef(75);
  const paintRef = useRef<() => void>(() => undefined);
  const [unavailable, setUnavailable] = useState(false);
  const samples = useMemo(createGlobeSamples, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const texture = getAtlas();
    if (!canvas || !context || !texture) { setUnavailable(true); return; }
    const regionsByName = new Map(regions.map((region) => [region.mapName, region]));
    const colors = getComputedStyle(canvas);
    const color = (name: string) => colors.getPropertyValue(`--globe-${name}`).trim();
    let land = color("land"), ocean = color("ocean");
    let background = colors.getPropertyValue("--background");
    let statusColors = { online: color("online"), offline: color("offline"), partial: color("partial"), unknown: color("unknown") };
    const regionIds = new Map(regions.map((region, index) => [region.mapName, index + 1]));
    const countryIds = texture.names.map((name) => regionIds.get(name) ?? 0);
    const hitGrid = new Uint16Array(GLOBE_GRID * GLOBE_GRID);
    let fills = texture.names.map((name) => {
      const region = regionsByName.get(name);
      return region ? statusColors[region.status] : land;
    });
    const markers = regions.flatMap((region) => {
      const location = texture.centers.get(region.mapName);
      return location ? [{ region, location }] : [];
    });
    let dragging: { id: number; start: number; rotation: number; moved: boolean } | null = null;
    let inView = false;
    let frame = 0;
    let last = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = () => {
      context.clearRect(0, 0, GLOBE_SIZE, GLOBE_SIZE);
      hitGrid.fill(0);
      for (const sample of samples) {
        const id = texture.pixels[sample.row * TEXTURE_WIDTH + textureColumn(sample.longitude + rotation.current)];
        context.fillStyle = id ? fills[id] : ocean;
        context.globalAlpha = countryIds[id] ? 1 : sample.shade;
        hitGrid[sample.y / GLOBE_PITCH * GLOBE_GRID + sample.x / GLOBE_PITCH] = countryIds[id];
        const size = id ? GLOBE_PITCH - 1 : 1;
        context.fillRect(sample.x, sample.y, size, size);
      }
      context.globalAlpha = 1;
      for (const { region, location } of markers) {
        const point = projectGlobeLocation(location[0], location[1], rotation.current);
        if (!point) continue;
        const x = Math.round(point.x / GLOBE_PITCH) * GLOBE_PITCH;
        const y = Math.round(point.y / GLOBE_PITCH) * GLOBE_PITCH;
        context.fillStyle = background;
        context.fillRect(x - 6, y - 6, 13, 13);
        context.fillStyle = statusColors[region.status];
        context.fillRect(x - 3, y - 3, 7, 7);
        if (region.key === selectedKey) { context.strokeStyle = land; context.strokeRect(x - 8, y - 8, 17, 17); }
        const col = Math.round(x / GLOBE_PITCH), row = Math.round(y / GLOBE_PITCH);
        const id = regionIds.get(region.mapName) ?? 0;
        for (let dy = -3; dy <= 3; dy++) {
          const line = row + dy;
          if (line < 0 || line >= GLOBE_GRID) continue;
          hitGrid.fill(id, line * GLOBE_GRID + Math.max(0, col - 3), line * GLOBE_GRID + Math.min(GLOBE_GRID, col + 4));
        }
      }
      canvas.dataset.rotation = rotation.current.toFixed(2);
    };
    const paletteObserver = new MutationObserver(() => {
      land = color("land"); ocean = color("ocean");
      background = colors.getPropertyValue("--background");
      statusColors = { online: color("online"), offline: color("offline"), partial: color("partial"), unknown: color("unknown") };
      fills = texture.names.map((name) => {
        const region = regionsByName.get(name);
        return region ? statusColors[region.status] : land;
      });
      draw();
    });
    paletteObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    paintRef.current = draw;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; last = 0; };
    const tick = (time: number) => {
      if (!last) last = time;
      const elapsed = time - last;
      if (elapsed >= 50) {
        rotation.current = (rotation.current + Math.min(elapsed, 100) * 0.004) % 360;
        draw();
        last = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      stop();
      if (inView && !document.hidden && !media.matches && !paused && !dragging && !hoveringRef.current) frame = requestAnimationFrame(tick);
    };
    const pickRegion = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor((event.clientX - rect.left) / rect.width * GLOBE_GRID);
      const row = Math.floor((event.clientY - rect.top) / rect.height * GLOBE_GRID);
      if (col < 0 || col >= GLOBE_GRID || row < 0 || row >= GLOBE_GRID) return null;
      const id = hitGrid[row * GLOBE_GRID + col];
      return regions[id - 1]?.key ?? null;
    };
    const hover = (key: string | null) => {
      if (key === hoverKeyRef.current) return;
      hoverKeyRef.current = key;
      onHover(key);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      hoveringRef.current = true;
      sync();
    };
    const leave = () => { hoveringRef.current = false; hover(null); sync(); };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); });
    observer.observe(canvas);
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      dragging = { id: event.pointerId, start: event.clientX, rotation: rotation.current, moved: false };
      canvas.setPointerCapture(event.pointerId);
      sync();
    };
    const move = (event: PointerEvent) => {
      if (!dragging) {
        if (event.pointerType !== "touch") hover(pickRegion(event));
        return;
      }
      if (dragging.id !== event.pointerId) return;
      hover(null);
      const delta = event.clientX - dragging.start;
      dragging.moved ||= Math.abs(delta) > 4;
      rotation.current = dragging.rotation - delta * 0.5;
      draw();
    };
    const up = (event: PointerEvent) => {
      if (!dragging || dragging.id !== event.pointerId) return;
      if (!dragging.moved && event.type === "pointerup") {
        const key = pickRegion(event);
        if (key) onSelect(key);
      }
      dragging = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      sync();
    };
    const stage = stageRef.current;
    stage?.addEventListener("pointerenter", enter);
    stage?.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    draw();
    return () => {
      stop(); observer.disconnect(); paletteObserver.disconnect(); paintRef.current = () => undefined;
      stage?.removeEventListener("pointerenter", enter);
      stage?.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
      if (dragging && canvas.hasPointerCapture(dragging.id)) canvas.releasePointerCapture(dragging.id);
    };
  }, [regions, selectedKey, onSelect, onHover, paused, samples]);

  const turn = (delta: number) => { rotation.current += delta; paintRef.current(); };
  return <div className="pixel-globe">
    <div className="pixel-globe__stage" ref={stageRef}>
    <canvas ref={canvasRef} width={GLOBE_SIZE} height={GLOBE_SIZE} role="img" aria-label={t("dashboard.pixelGlobe")} />
    {hoverDetails}
    </div>
    {unavailable && <p role="status" className="text-xs text-muted-foreground">{t("dashboard.globeUnavailable")}</p>}
    <div className="pixel-globe__controls">
      <Button variant="ghost" size="icon" aria-label={t("dashboard.rotateLeft")} onClick={() => turn(-30)}><ArrowLeft /></Button>
      <Button variant="ghost" size="icon" aria-label={t(paused ? "dashboard.resumeGlobe" : "dashboard.pauseGlobe")} aria-pressed={paused} onClick={() => onPausedChange(!paused)}>{paused ? <Play /> : <Pause />}</Button>
      <Button variant="ghost" size="icon" aria-label={t("dashboard.rotateRight")} onClick={() => turn(30)}><ArrowRight /></Button>
    </div>
  </div>;
}
