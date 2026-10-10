"use client";

import AppearanceSwitch from "./AppearanceSwitch";
import LanguageSwitch from "./Language";
import LoginDialog from "./Login";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTranslation } from "react-i18next";
import { dispatchOpenRemainingValueCalculatorEvent } from "@/lib/remainingValueEvents";

const NavBar = () => {
  const { publicInfo } = usePublicInfo();
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all duration-300 shadow-sm">
      <div className="container mx-auto flex h-16 md:h-20 items-center justify-between gap-2 px-4">
        {/* Logo and Title */}
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 hover:opacity-80 transition-all">
            <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center overflow-hidden">
              {/* 品牌 logo：透明 PNG，/assets/logo.png 由品牌资产提供 */}
              <img src="/assets/logo.png" alt="logo" className="h-8 w-8 object-contain" />
            </div>
            <span className="truncate text-lg md:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {publicInfo?.sitename}
            </span>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={dispatchOpenRemainingValueCalculatorEvent}
          >
            <Calculator className="h-4 w-4" />
            <span className="sr-only">
              {t("remainingValue.title", { defaultValue: "Remaining Value Calculator" })}
            </span>
          </Button>
          <AppearanceSwitch />
          <LanguageSwitch />

          {publicInfo?.private_site ? (
            <LoginDialog
              autoOpen={publicInfo?.private_site}
              info={t('common.private_site')}
              onLoginSuccess={() => { window.location.reload(); }}
            />
          ) : (
            <LoginDialog />
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
