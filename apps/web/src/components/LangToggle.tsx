"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function LangToggle() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("lng") === "ko" ? "ko" : "en";
  const target = current === "en" ? "ko" : "en";
  const newSp = new URLSearchParams(sp);
  newSp.set("lng", target);
  return (
    <Link
      href={`${pathname}?${newSp.toString()}`}
      className="text-xs uppercase tracking-wider px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      prefetch={false}
    >
      {target.toUpperCase()}
    </Link>
  );
}
