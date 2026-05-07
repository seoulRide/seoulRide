"use client";

import Script from "next/script";

/**
 * Loads the NAVER Maps Web Dynamic Map JavaScript SDK once for the whole app.
 * Uses ncpKeyId (NCP API Key ID) for authentication. The SDK is auto-initialized
 * unless the consumer specifies otherwise; a ready signal is detected via
 * a polling check in NaverMap (similar to Kakao's `kakao.maps.load`).
 */
export function NaverSdkScript() {
  const key = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  if (!key) return null;
  const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
  return <Script src={src} strategy="afterInteractive" />;
}
