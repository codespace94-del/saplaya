// Mirrors the backend tiers. The backend recomputes the fee, so this is display-only.
export const STORE = { lat: -6.163, lng: 35.7516 }; // Dodoma hub
export const FREE_RADIUS_KM = 5;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function deliveryTier(km: number) {
  if (km <= FREE_RADIUS_KM) return { fee: 0, label: 'Free close-area delivery', free: true };
  if (km <= 10) return { fee: 2000, label: 'Standard delivery (5–10 km)', free: false };
  return { fee: 4000, label: 'Extended delivery (10 km+)', free: false };
}
