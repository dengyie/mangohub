"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";

export default function AppearanceSwitch() {
  const { t } = useTranslation();
  const { setAppearance } = useTheme();
  return <div role="group" aria-label={t("dashboard.appearance")} className="flex shrink-0 rounded-full border border-border bg-secondary p-0.5">
    <button type="button" title={t("dashboard.dayMode")} aria-label={t("dashboard.dayMode")} onClick={() => setAppearance("light")} className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-colors dark:bg-transparent dark:text-muted-foreground dark:shadow-none focus-visible:outline-2 focus-visible:outline-ring"><Sun className="h-4 w-4" /></button>
    <button type="button" title={t("dashboard.nightMode")} aria-label={t("dashboard.nightMode")} onClick={() => setAppearance("dark")} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors dark:bg-background dark:text-foreground dark:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"><Moon className="h-4 w-4" /></button>
  </div>;
}
