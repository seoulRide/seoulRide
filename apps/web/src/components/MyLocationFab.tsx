"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";

const DEFAULT_ZOOM = 15;

export function MyLocationFab({
  onLocate,
  lang,
  /** Extra bottom offset (px) so the FAB clears a sibling overlay. */
  bottomOffset = 0,
}: {
  onLocate: (lat: number, lng: number) => void;
  lang: Lang;
  bottomOffset?: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const handleClick = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState("error");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocate(pos.coords.latitude, pos.coords.longitude);
        setState("idle");
      },
      () => setState("error"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  };

  return (
    <div className="pointer-events-none absolute right-3 z-[900]" style={{ bottom: `calc(env(safe-area-inset-bottom) + ${16 + bottomOffset}px)` }}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("map.my_location", lang)}
        title={t("map.my_location", lang)}
        disabled={state === "loading"}
        className="pointer-events-auto h-11 w-11 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition disabled:opacity-60"
      >
        {state === "loading" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
          </svg>
        )}
      </button>
      {state === "error" && (
        <div className="mt-2 max-w-[16rem] rounded-md bg-zinc-900/95 text-white text-[11px] px-2 py-1.5 shadow">
          {t("location.permission_required", lang)}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_ZOOM as MY_LOCATION_FAB_DEFAULT_ZOOM };
