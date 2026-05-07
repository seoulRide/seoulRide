/**
 * Simplified brand marks for the map-app deep-link buttons.
 * These are recognizable brand-color silhouettes (not the exact official
 * vector logos), inlined to avoid pulling a brand-icons npm package.
 */

export function GoogleMapsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#1A73E8"
        d="M12 2C7.03 2 3 6.03 3 11c0 6.75 8.22 10.74 8.57 10.91a1 1 0 0 0 .86 0C12.78 21.74 21 17.75 21 11c0-4.97-4.03-9-9-9z"
      />
      <circle cx="12" cy="11" r="3.6" fill="#fff" />
      <circle cx="12" cy="11" r="1.7" fill="#EA4335" />
    </svg>
  );
}

export function NaverIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#03C75A" />
      <path
        fill="#fff"
        d="M14.86 6.5h2.78v11h-3.18l-4.32-6.49v6.49H6.36V6.5h3.18l4.32 6.49V6.5z"
      />
    </svg>
  );
}

export function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#FEE500" />
      <path
        fill="#3C1E1E"
        d="M12 6.4c-3.4 0-6.2 2.18-6.2 4.87 0 1.74 1.17 3.26 2.92 4.12l-.74 2.74c-.07.24.21.44.43.3l3.27-2.16c.1.01.21.02.32.02 3.4 0 6.2-2.18 6.2-4.87S15.4 6.4 12 6.4z"
      />
    </svg>
  );
}
