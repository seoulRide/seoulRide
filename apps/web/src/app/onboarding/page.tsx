"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ONBOARDING_STORAGE_KEY } from "@/components/OnboardingGate";

export default function OnboardingPage() {
  const router = useRouter();

  const start = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // localStorage blocked — proceed anyway so the user isn't stuck.
    }
    router.replace("/");
  };

  return (
    <main className="min-h-dvh w-full bg-[#dceaf5] text-zinc-900 flex flex-col items-center justify-between px-6 pt-10 pb-16">
      <div className="flex-1 flex flex-col items-center justify-center text-center select-none">
        <Image
          src="/logo.png"
          alt="seoulRide"
          width={520}
          height={520}
          priority
          className="w-[min(86vw,520px)] h-auto drop-shadow-sm"
        />
      </div>
      <button
        type="button"
        onClick={start}
        className="rounded-full bg-emerald-600 text-white font-semibold text-base px-10 py-3.5 shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-transform"
      >
        START
      </button>
    </main>
  );
}
