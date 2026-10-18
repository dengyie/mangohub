"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getPixelCatFrame, PIXEL_CAT_PALETTE, PIXEL_CAT_SIZE, type PixelCatMood } from "./pixelCatFrames";
import "./PixelCat.css";

interface PixelCatProps {
  mood: PixelCatMood;
  paused: boolean;
  selectedLabel?: string;
  onTogglePaused: () => void;
}

const PIXEL_SIZE = 5;
const CANVAS_SIZE = PIXEL_CAT_SIZE * PIXEL_SIZE;
const COLORS: Record<string, string> = {
  ".": "transparent",
  D: PIXEL_CAT_PALETTE.outline,
  G: PIXEL_CAT_PALETTE.fur,
  L: PIXEL_CAT_PALETTE.furLight,
  E: PIXEL_CAT_PALETTE.eye,
  P: PIXEL_CAT_PALETTE.nose,
  Z: PIXEL_CAT_PALETTE.zzz,
  "*": PIXEL_CAT_PALETTE.cream,
};

export function PixelCat({ mood, paused, selectedLabel, onTogglePaused }: PixelCatProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let frameIndex = 0;
    let lastFrame = 0;

    const draw = () => {
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const frame = getPixelCatFrame(mood, frameIndex);
      frame.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          const color = COLORS[pixel];
          if (!color || color === "transparent") return;
          context.fillStyle = color;
          context.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        });
      });
    };
    const stop = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrame = 0;
    };
    const tick = (time: number) => {
      if (!lastFrame) lastFrame = time;
      if (time - lastFrame >= 240) {
        frameIndex += 1;
        draw();
        lastFrame = time;
      }
      animationFrame = requestAnimationFrame(tick);
    };
    const sync = () => {
      stop();
      draw();
      if (!paused && !document.hidden && !media.matches) animationFrame = requestAnimationFrame(tick);
    };

    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    sync();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
    };
  }, [mood, paused]);

  const moodText = t(`dashboard.pixelCat${mood[0].toUpperCase()}${mood.slice(1)}`);

  return (
    <div className={`pixel-cat pixel-cat--${mood}`}>
      <button
        type="button"
        className="pixel-cat__button"
        aria-label={t("dashboard.toggleGlobeFromCat")}
        aria-pressed={paused}
        onClick={onTogglePaused}
      >
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} role="img" aria-label={t("dashboard.pixelCat")} />
      </button>
      <p className="pixel-cat__mood" aria-live="polite">{selectedLabel ? `${moodText} · ${selectedLabel}` : moodText}</p>
    </div>
  );
}
