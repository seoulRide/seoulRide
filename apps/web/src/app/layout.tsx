import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NaverSdkScript } from "@/components/NaverSdkScript";
import { OnboardingGate } from "@/components/OnboardingGate";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://seoulride.site"),
  title: "seoulRide — Where foreigners ride in Seoul",
  description:
    "Top Seoul bike-share stations rented by foreign visitors, plus nearby cultural events and weather.",
  manifest: "/manifest.webmanifest",
  applicationName: "seoulRide",
  appleWebApp: {
    capable: true,
    title: "seoulRide",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    url: "https://seoulride.site",
    siteName: "seoulRide",
    title: "seoulRide — Where foreigners ride in Seoul",
    description:
      "Top Seoul bike-share stations rented by foreign visitors, plus nearby cultural events and weather.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "seoulRide" }],
  },
  twitter: {
    card: "summary",
    title: "seoulRide — Where foreigners ride in Seoul",
    description:
      "Top Seoul bike-share stations rented by foreign visitors, plus nearby cultural events and weather.",
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* min-h-dvh (dynamic viewport) keeps the bottom tab bar pinned to the
          visual bottom on iOS Chrome when its tool-bar collapses on scroll;
          the static 100vh that min-h-screen resolves to leaks an extra strip
          underneath. */}
      <body className="min-h-dvh bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <OnboardingGate>{children}</OnboardingGate>
        <NaverSdkScript />
      </body>
    </html>
  );
}
