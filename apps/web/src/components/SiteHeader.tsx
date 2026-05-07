import Link from "next/link";
import { LangToggle } from "./LangToggle";
import { t, type Lang } from "@/lib/i18n";

export function SiteHeader({ lang }: { lang: Lang }) {
  const lngQs = lang === "ko" ? "?lng=ko" : "";
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href={`/${lngQs}`} className="font-semibold tracking-tight text-lg">
          <span className="text-emerald-600">seoul</span>
          <span>Ride</span>
        </Link>
        <nav className="flex items-center gap-2 md:gap-5 text-sm">
          <Link className="hidden md:inline hover:underline" href={`/${lngQs}`}>{t("nav.home", lang)}</Link>
          <Link className="hidden md:inline hover:underline" href={`/nearby${lngQs}`}>{t("nav.nearby", lang)}</Link>
          <Link className="hidden md:inline hover:underline" href={`/events${lngQs}`}>{t("nav.events", lang)}</Link>
          <Link className="hidden md:inline hover:underline" href={`/about${lngQs}`}>{t("nav.about", lang)}</Link>
          <LangToggle />
        </nav>
      </div>
    </header>
  );
}
