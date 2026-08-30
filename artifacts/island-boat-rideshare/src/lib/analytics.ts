type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt a booking, crossing, or receipt action.
  }
}

export function passengerCountBand(count: number): string {
  if (count === 1) return '1';
  if (count <= 4) return '2-4';
  if (count <= 8) return '5-8';
  return '9-16';
}