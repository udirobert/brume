/**
 * Brume Notifications — OneSignal integration (Keep Them Coming Back award)
 *
 * Design principles:
 * - NEVER block the app: everything is dynamic-imported, guarded, and try/caught.
 *   If the SDK or app id is missing, we log and no-op.
 * - Ask for push permission IN CONTEXT: only after the user's first completed
 *   session (they've felt the value), never on first app open.
 * - Client sends DATA TAGS; Journeys/campaigns are configured dashboard-side.
 *   Tag contract is documented in docs/BRUME.md — keep them in sync.
 *
 * Tag contract v1:
 *   first_breath_done  "true"            → Journey 1: First Breath (24h no session)
 *   last_session_at    ISO date string   → Journey 2: "Come back when you're ready" (gentle, no streak framing)
 *   streak             number as string  → segmentation only; never shown, never used for nudges
 *   verified_total     number as string  → Journey 4: Weekly Proof digest
 *   sessions_total     number as string  → analytics segmentation
 */

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined;
const STATS_KEY = "brume_notification_stats";

interface LocalStats {
  sessions_total: number;
  verified_total: number;
  shares_total: number;
  prompted_permission: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any = null;
let initAttempted = false;

function readStats(): LocalStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { sessions_total: 0, verified_total: 0, shares_total: 0, prompted_permission: false, ...JSON.parse(raw) };
  } catch { /* corrupted stats are non-fatal */ }
  return { sessions_total: 0, verified_total: 0, shares_total: 0, prompted_permission: false };
}

function writeStats(stats: LocalStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* storage full/denied — non-fatal */ }
}

/** Initialize OneSignal. Safe to call multiple times; only runs once. */
export async function initNotifications(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  if (!APP_ID) {
    console.info("🔕 OneSignal: VITE_ONESIGNAL_APP_ID not set — notifications disabled (dev mode)");
    return;
  }

  try {
    const mod = await import("onesignal-cordova-plugin");
    sdk = mod.default ?? mod;
    sdk.initialize(APP_ID);
    console.info("🔔 OneSignal initialized");
  } catch (error) {
    console.warn("🔕 OneSignal SDK unavailable (web/PWA without plugin?):", error);
    sdk = null;
  }
}

/**
 * Record a completed session and update journey tags.
 * Called from sessionStore.completeSession — must never throw.
 *
 * @param verified  session had camera verification active (proof of practice)
 * @param streak    current streak if known by caller (optional)
 */
export function trackSessionCompleted(opts: { verified: boolean; streak?: number }): void {
  try {
    const stats = readStats();
    stats.sessions_total += 1;
    if (opts.verified) stats.verified_total += 1;
    const isFirstSession = stats.sessions_total === 1;
    writeStats(stats);

    if (!sdk) return;

    const tags: Record<string, string> = {
      first_breath_done: "true",
      last_session_at: new Date().toISOString().slice(0, 10),
      sessions_total: String(stats.sessions_total),
      verified_total: String(stats.verified_total),
    };
    if (typeof opts.streak === "number") tags.streak = String(opts.streak);
    sdk.User.addTags(tags);

    // Contextual permission ask: right after first session completion,
    // the moment the value loop just closed. One time only.
    if (isFirstSession && !stats.prompted_permission) {
      stats.prompted_permission = true;
      writeStats(stats);
      void sdk.Notifications.requestPermission(true);
    }
  } catch (error) {
    console.warn("OneSignal trackSessionCompleted failed (non-fatal):", error);
  }
}

/** Record a credential share — the virality metric (Grand Prize evidence). */
export function trackCredentialShared(): void {
  try {
    const stats = readStats();
    stats.shares_total += 1;
    writeStats(stats);
    sdk?.User.addTag("shares_total", String(stats.shares_total));
  } catch { /* non-fatal */ }
}

/** Alias the device to an authenticated user. Wired in useAuthOrchestrator. */
export function identifyUser(userId: string): void {
  try {
    sdk?.login(userId);
  } catch { /* non-fatal */ }
}

/** Clear the alias on sign out. Wired in useAuthOrchestrator. */
export function resetNotificationUser(): void {
  try {
    sdk?.logout();
  } catch { /* non-fatal */ }
}
