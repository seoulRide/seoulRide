"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { t, type Lang } from "@/lib/i18n";

type TabName = "map" | "nearby" | "events" | "about";

function TabIcon({ name, active }: { name: TabName; active: boolean }) {
  const opacity = active ? 1 : 0.6;
  if (name === "map") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    );
  }
  if (name === "nearby") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden>
        <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    );
  }
  if (name === "events") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01M11 12h1v4h1" />
    </svg>
  );
}

export function BottomTabNav({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const lngQs = lang === "ko" ? "?lng=ko" : "";

  const otherLang = lang === "en" ? "ko" : "en";
  const langSp = new URLSearchParams(sp.toString());
  langSp.set("lng", otherLang);
  const langHref = `${pathname}?${langSp.toString()}`;

  const items: { name: TabName; href: string; label: string; match: (p: string) => boolean }[] = [
    {
      name: "map",
      href: `/${lngQs}`,
      label: t("nav.home", lang),
      match: (p) => p === "/" || p.startsWith("/station"),
    },
    { name: "nearby", href: `/nearby${lngQs}`, label: t("nav.nearby", lang), match: (p) => p.startsWith("/nearby") },
    { name: "events", href: `/events${lngQs}`, label: t("nav.events", lang), match: (p) => p.startsWith("/events") },
    { name: "about",  href: `/about${lngQs}`,  label: t("nav.about", lang),  match: (p) => p.startsWith("/about") },
  ];

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur pb-safe"
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around h-14">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.name} className="flex-1">
              <Link
                href={it.href}
                prefetch={false}
                className={[
                  "h-full flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide",
                  active ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-zinc-500 dark:text-zinc-400",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <TabIcon name={it.name} active={active} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href={langHref}
            prefetch={false}
            className="h-full flex flex-col items-center justify-center gap-0.5 text-[10px] tracking-wide text-zinc-500 dark:text-zinc-400"
            aria-label={`Switch language to ${otherLang.toUpperCase()}`}
          >
            <span className="text-[13px] font-semibold tabular-nums">{otherLang.toUpperCase()}</span>
            <span>Lang</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
