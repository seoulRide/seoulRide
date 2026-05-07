"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EventExplorer, type ExplorerEvent } from "./EventExplorer";
import { isMobileUA } from "@/lib/map-app-links";
import { useGeolocation } from "@/lib/use-geolocation";
import { t, type Lang } from "@/lib/i18n";

export type { ExplorerEvent };

export function RouteClient({ events, lang }: { events: ExplorerEvent[]; lang: Lang }) {
  const { origin, locStatus, requestLocation } = useGeolocation();
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(isMobileUA()); }, []);

  const anchor = events[0];
  const anchorTitle = anchor ? (lang === "ko" ? anchor.title_ko : anchor.title_en) : "";

  const banner = (
    <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2 max-w-full">
      <Link
        href={lang === "ko" ? "/?lng=ko" : "/"}
        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
        prefetch={false}
        aria-label="Back"
      >
        ←
      </Link>
      <span className="truncate">{anchorTitle}</span>
      <span className="text-zinc-400">·</span>
      <span className="text-zinc-500">
        {lang === "ko" ? `${events.length}개 행사` : `${events.length} events`}
      </span>
      {locStatus === "denied" || locStatus === "unsupported" ? (
        <button
          onClick={requestLocation}
          className="ml-1 text-emerald-600 font-medium underline-offset-2 hover:underline"
          type="button"
        >
          {lang === "ko" ? "위치 다시" : "Retry GPS"}
        </button>
      ) : locStatus === "idle" ? (
        <button
          onClick={requestLocation}
          className="ml-1 text-emerald-600 font-medium"
          type="button"
        >
          {t("route.use_my_location", lang)}
        </button>
      ) : null}
    </div>
  );

  return (
    <EventExplorer
      events={events}
      lang={lang}
      origin={origin}
      originGranted={locStatus === "granted"}
      initialCenter={anchor ? { lat: anchor.lat, lng: anchor.lng } : undefined}
      topBanner={banner}
      mobile={mobile}
    />
  );
}
