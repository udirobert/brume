// Lightweight analytics wrapper with safe fallbacks
export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  try {
    // PostHog
    const posthog = (window as any)?.posthog;
    if (posthog && typeof posthog.capture === "function") {
      posthog.capture(eventName, properties);
      return;
    }

    // Mixpanel
    const mixpanel = (window as any)?.mixpanel;
    if (mixpanel && typeof mixpanel.track === "function") {
      mixpanel.track(eventName, properties);
      return;
    }

    // Fallback to console for local dev visibility only.
    if (import.meta.env?.DEV) {
      console.log(`[analytics] ${eventName}`, properties);
    }
  } catch (err) {
    console.debug("analytics error", err);
  }
}