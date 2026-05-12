"use client";

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
    <main className="min-h-dvh w-full bg-emerald-600 text-white flex flex-col items-center justify-between px-6 pt-24 pb-16">
      <div className="flex-1 flex flex-col items-center justify-center text-center select-none">
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-tight">
          Bike Seoul.
        </h1>
        <p className="mt-3 text-lg sm:text-xl text-white/85 tracking-wide">seoulRide</p>
      </div>
      <button
        type="button"
        onClick={start}
        className="rounded-full bg-white text-emerald-700 font-semibold text-base px-10 py-3.5 shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-transform"
      >
        START
      </button>
    </main>
  );
}
