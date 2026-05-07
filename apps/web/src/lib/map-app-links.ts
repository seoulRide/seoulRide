/**
 * Deep links / web URLs to open external map apps in bicycle routing mode.
 * Pattern: mobile → app deep link, desktop → web URL. If a provider has no
 * usable web equivalent on a given device, the entry is `null` and callers
 * should hide the button.
 */

export type MapAppProvider = "google" | "naver";

export interface MapEndpoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface MapAppLink {
  provider: MapAppProvider;
  label: string;
  url: string | null;
}

export function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function googleUrl(from: MapEndpoint, to: MapEndpoint): string {
  // Universal — opens Google Maps app via Universal Link on mobile,
  // and the web map on desktop. Same URL works for both.
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${from.lat},${from.lng}` +
    `&destination=${to.lat},${to.lng}` +
    `&travelmode=bicycling`
  );
}

function naverMobileDeep(from: MapEndpoint, to: MapEndpoint): string {
  const sn = encodeURIComponent(from.name ?? "Start");
  const dn = encodeURIComponent(to.name ?? "End");
  return (
    `nmap://route/bicycle?slat=${from.lat}&slng=${from.lng}&sname=${sn}` +
    `&dlat=${to.lat}&dlng=${to.lng}&dname=${dn}&appname=com.seoulride`
  );
}

function naverWebUrl(from: MapEndpoint, to: MapEndpoint): string {
  // PC web bicycle directions: /p/directions/{slng},{slat},{sname},,PLACE_POI/.../-/bike
  // (NAVER's mode segment is "bike", not "bicycle", on map.naver.com.)
  const sn = encodeURIComponent(from.name ?? "Start");
  const dn = encodeURIComponent(to.name ?? "End");
  return (
    `https://map.naver.com/p/directions/` +
    `${from.lng},${from.lat},${sn},,PLACE_POI/` +
    `${to.lng},${to.lat},${dn},,PLACE_POI/-/bike`
  );
}

/** Build the list of map-app buttons for a given route (rental → return). */
export function bicycleAppLinks(
  from: MapEndpoint,
  to: MapEndpoint,
  mobile: boolean = isMobileUA(),
): MapAppLink[] {
  return [
    {
      provider: "google",
      label: "Google Maps",
      url: googleUrl(from, to),
    },
    {
      provider: "naver",
      label: "NAVER",
      url: mobile ? naverMobileDeep(from, to) : naverWebUrl(from, to),
    },
  ];
}
