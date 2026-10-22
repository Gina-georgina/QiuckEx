export type AnalyticsEventName =
  | "scam_alert_shown"
  | "scam_alert_dismissed"
  | "scam_alert_proceeded"
  | "onboarding_completed"
  | "onboarding_skipped";

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  properties?: Record<string, string | number | boolean | undefined>;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Fire-and-forget analytics event. Pushes to `window.dataLayer` (if a tag
 * manager is present) and dispatches a `quickex:analytics` DOM event so any
 * listener can forward it. Never throws.
 */
export function trackEvent(name: AnalyticsEventName, properties?: AnalyticsEvent["properties"]): void {
  if (typeof window === "undefined") return;
  const event: AnalyticsEvent = { name, properties };
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: name, ...properties });
    window.dispatchEvent(new CustomEvent<AnalyticsEvent>("quickex:analytics", { detail: event }));
  } catch {
    // Analytics must never break the UI.
  }
}
