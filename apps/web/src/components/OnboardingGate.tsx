"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "seoulride.onboarded";

/**
 * Client-side onboarding gate. On first mount checks localStorage; if the
 * user has not completed onboarding and isn't already on /onboarding,
 * redirects them there. Children stay hidden until the check resolves so
 * users don't see a flash of the map before bouncing.
 *
 * We intentionally don't use middleware/cookies because that would force
 * SSR off of public routes — the static-data design of this app benefits
 * from the cacheable HTML.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/onboarding") {
      setReady(true);
      return;
    }
    try {
      const onboarded = window.localStorage.getItem(STORAGE_KEY) === "1";
      if (!onboarded) {
        router.replace("/onboarding");
        return;
      }
    } catch {
      // localStorage can throw in strict privacy modes — treat as onboarded
      // so users aren't stuck on the gate.
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}

export const ONBOARDING_STORAGE_KEY = STORAGE_KEY;
