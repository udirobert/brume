/**
 * Lens Protocol v3 Client Implementation (Simplified)
 *
 * Simplified implementation that maintains the v3 architecture
 * while using mock data until the full SDK integration is complete
 * - Proper TypeScript typing
 * - Clean error handling
 * - Session management
 * - Ready for real v3 SDK integration
 */

import type {
  Account,
  Post,
  BreathingSession,
  SocialActionResult,
  LensAuthTokens,
  Timeline,
} from "./types";
import { follow, unfollow } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import { blockchainAuthService } from "@/services/blockchain/BlockchainAuthService";
import { getTimeline as fetchTimelineFromAPI } from "@/lib/api/socialService";
import { services } from "@/config/environment";
import type { SignedSessionRecord } from "./types";

// SDK-adapter types for feed/publications mapping
interface SdkPageInfo { next?: string; prev?: string }
interface SdkFeedItem {
  id?: string;
  publicationId?: string;
  createdAt?: string;
  timestamp?: string;
  by?: {
    id?: string;
    handle?: string;
    ownedBy?: { address?: string };
    address?: string;
    metadata?: { name?: string; picture?: string };
  };
  author?: { address?: string; username?: string; name?: string; avatar?: string };
  metadata?: { content?: string; contentUri?: string; tags?: string[] };
  stats?: { reactions?: number; comments?: number; replies?: number; collects?: number; mirrors?: number; quotes?: number };
  content?: string;
}
interface SdkFeedResult {
  items: SdkFeedItem[];
  pageInfo?: SdkPageInfo;
  next?: string;
}

// Unwrap Lens SDK Result style objects
function unwrapResult<T>(res: unknown): T | null {
  if (!res) return null;
  if (typeof res === 'object' && res !== null && 'isOk' in res && typeof (res as { isOk: unknown }).isOk === 'function') {
    return (res as unknown as { isOk(): boolean; value: T }).isOk() ? (res as unknown as { value: T }).value : null;
  }
  if (typeof res === 'object' && res !== null && 'isErr' in res && typeof (res as { isErr: unknown }).isErr === 'function') {
    return (res as unknown as { isErr(): boolean; value: T }).isErr() ? null : (res as unknown as { value: T }).value;
  }
  return res as T;
}

// Lightweight random id helper for fallback cases
function cryptoRandomId(): string {
  try {
    const arr = new Uint32Array(2);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(arr);
    } else {
      throw new Error("getRandomValues unavailable");
    }
    return `pub-${arr[0].toString(16)}${arr[1].toString(16)}`;
  } catch {
    return `pub-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

// App identifier for content filtering (used by feedReason helpers)
const IMPERFECT_BREATH_APP_ID = "imperfect-breath";

/**
 * Simplified Lens v3 API Client
 */
export class LensV3API {
  private isAuthenticated = false;
  private currentUser: Account | null = null;
  private sessionData: {
    address: string;
    signature: string;
    authenticatedAt: number;
    expiresAt: number;
  } | null = null;
  // In-memory cache for dedup and smoother pagination
  private seenPostIds: Set<string> = new Set();
  private timelineCacheNext: string | undefined = undefined;

  /**
   * Login to Lens Protocol with wallet
   */
  async login(
    walletAddress: string,
    signMessage: (message: string) => Promise<string>,
  ): Promise<SocialActionResult> {
    try {
      console.log("🌿 Starting Lens v3 login for:", walletAddress);

      // Simulate challenge-response flow
      const challengeMessage = `Welcome to Brume!\n\nSign this message to authenticate with Lens Protocol.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;

      // Get signature
      const signature = await signMessage(challengeMessage);

      if (!signature) {
        throw new Error("Signature required for authentication");
      }

      // Authenticate with signature
      this.isAuthenticated = true;
      
      // Store session data
      this.sessionData = {
        address: walletAddress,
        signature,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Create user account from wallet address
      this.currentUser = {
        id: walletAddress,
        address: walletAddress,
        username: {
          localName: `user${walletAddress.slice(-4)}`,
          fullHandle: `user${walletAddress.slice(-4)}.lens`,
          ownedBy: walletAddress,
        },
        ownedBy: { address: walletAddress },
        metadata: {
          name: "Lens User",
          bio: "Welcome to the breathing community!",
        },
        stats: {
          posts: 0,
          followers: 0,
          following: 0,
        },
        timestamp: new Date().toISOString(),
      };

      // Store session data
      this.sessionData = {
        address: walletAddress,
        signature,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      // Store in localStorage for persistence
      if (typeof window !== "undefined") {
        localStorage.setItem("lens-session", JSON.stringify(this.sessionData));
        localStorage.setItem("lens-user", JSON.stringify(this.currentUser));
      }

      console.log("✅ Lens login successful (mock)");
      return { success: true };
    } catch (error) {
      console.error("❌ Lens login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  }

  /**
   * Resume existing session from storage
   */
  async resumeSession(): Promise<SocialActionResult> {
    try {
      if (typeof window === "undefined") {
        return { success: false, error: "No window available" };
      }

      const sessionData = localStorage.getItem("lens-session");
      const userData = localStorage.getItem("lens-user");

      if (!sessionData || !userData) {
        return { success: false, error: "No session to resume" };
      }

      const session = JSON.parse(sessionData);
      const user = JSON.parse(userData);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.clearLocalStorage();
        return { success: false, error: "Session expired" };
      }

      this.isAuthenticated = true;
      this.currentUser = user;
      this.sessionData = session;

      console.log("✅ Session resumed successfully");
      return { success: true };
    } catch (error) {
      this.clearLocalStorage();
      return {
        success: false,
        error: error instanceof Error ? error.message : "Session resume failed",
      };
    }
  }

  /**
   * Get current session details
   */
  async getCurrentSession(): Promise<
    SocialActionResult & {
      data?: {
        address: string;
        signature: string;
        authenticatedAt: number;
        expiresAt: number;
      };
    }
  > {
    if (!this.isAuthenticated || !this.sessionData) {
      return { success: false, error: "Not authenticated" };
    }

    return {
      success: true,
      data: this.sessionData,
    };
  }

  /**
   * Get account information
   */
  async getAccount(
    address: string,
  ): Promise<SocialActionResult & { data?: Account }> {
    try {
      // Return current user if requesting own account
      if (this.isAuthenticated && this.currentUser?.address === address) {
        return {
          success: true,
          data: this.currentUser,
        };
      }

      // Mock other accounts
      const mockAccount: Account = {
        id: address,
        address,
        username: {
          localName: `user${address.slice(-4)}`,
          fullHandle: `user${address.slice(-4)}.lens`,
          ownedBy: address,
        },
        ownedBy: { address },
        metadata: {
          name: "Lens User",
          bio: "A member of the breathing community",
        },
        stats: {
          posts: Math.floor(Math.random() * 50),
          followers: Math.floor(Math.random() * 200),
          following: Math.floor(Math.random() * 100),
        },
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: mockAccount,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch account",
      };
    }
  }

  /**
   * Create a post
   */
  async createPost(
    contentUri: string,
  ): Promise<SocialActionResult & { data?: { id: string; txHash: string } }> {
    if (!this.isAuthenticated || !this.currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Parse content from URI if it's a data URI
      let content = "New post shared!";
      if (contentUri.startsWith("data:application/json,")) {
        const jsonData = decodeURIComponent(
          contentUri.replace("data:application/json,", ""),
        );
        const metadata = JSON.parse(jsonData);
        content = metadata.content || content;
      }

      // Mock post creation
      const newPost: Post = {
        id: `post-${Date.now()}`,
        content,
        author: {
          id: this.currentUser.id,
          address: this.currentUser.address,
          username: this.currentUser.username,
          metadata: this.currentUser.metadata,
        },
        timestamp: new Date().toISOString(),
        stats: {
          reactions: 0,
          comments: 0,
          reposts: 0,
        },
      };

      // In a real app, this would be handled by the backend posting to Lens
      console.log("Post would be added to Lens timeline:", newPost);

      console.log("✅ Post created successfully (mock)");
      return {
        success: true,
        data: {
          id: newPost.id,
          txHash: `0x${Math.random().toString(16).slice(2)}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Post creation failed",
      };
    }
  }

  /**
   * Get timeline/feed posts
   */
  async getTimeline(
    cursor?: string,
  ): Promise<SocialActionResult & { data?: Timeline }> {
    // Ensure SDK session exists so we can derive the viewer address
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Reset cache on fresh fetch
      if (!cursor) {
        this.seenPostIds.clear();
      }

      // Determine viewer address from current Lens session
      let viewerAddress: string | null = null;
      try {
        const account = (await blockchainAuthService.getAuthorAccount()) as { ownedBy?: { address?: string }; address?: string } | null;
        viewerAddress = account?.ownedBy?.address ?? account?.address ?? null;
      } catch {
        console.warn("Could not fetch author account for viewer address");
      }

      if (!viewerAddress) {
        // Fallback: use current session details
        try {
          const details = (await blockchainAuthService.getCurrentLensSessionDetails()) as { account?: { ownedBy?: { address?: string }; address?: string } } | null;
          const acct = details?.account;
          viewerAddress = acct?.ownedBy?.address ?? acct?.address ?? null;
        } catch {
          console.warn("Could not fetch session details for viewer address");
        }
      }

      if (!viewerAddress) {
        return { success: false, error: "Unable to determine viewer address" };
      }

      // Try direct client-side SDK fetching first, then fall back to backend
      let posts: Post[] | null = null;
      let pageInfo: SdkPageInfo | undefined;

      try {
        const actions = await import("@lens-protocol/client/actions") as { fetchFeed?: (...args: any[]) => any } & Record<string, unknown>;
        const { evmAddress } = await import("@lens-protocol/client");

        if (typeof actions.fetchFeed === "function") {
          const sdkRes = await actions.fetchFeed(session, {
            feed: evmAddress(viewerAddress as `0x${string}`),
            cursor,
          } as any);
          const value = unwrapResult<SdkFeedResult>(sdkRes);
          if (value) {
            const items = value.items ?? [];
            posts = items.map((item) => {
              const authorAddr = item?.by?.ownedBy?.address || item?.by?.address || item?.author?.address || viewerAddress;
              const username = item?.by?.handle || item?.author?.username || undefined;
              const content = item?.metadata?.content || item?.content || item?.metadata?.contentUri || "";
              const createdAt = item?.createdAt || item?.timestamp || new Date().toISOString();
              const reactions = item?.stats?.reactions ?? item?.stats?.collects ?? 0;
              const comments = item?.stats?.comments ?? item?.stats?.replies ?? 0;
              const reposts = item?.stats?.mirrors ?? item?.stats?.quotes ?? 0;

              return {
                id: String(item?.id ?? item?.publicationId ?? cryptoRandomId()),
                content,
                author: {
                  id: String(item?.by?.id ?? authorAddr ?? ""),
                  address: String(authorAddr ?? ""),
                  username: username ? { localName: String(username), fullHandle: String(username) } : undefined,
                  metadata: { name: item?.by?.metadata?.name || item?.author?.name, picture: item?.by?.metadata?.picture || item?.author?.avatar },
                },
                timestamp: createdAt,
                stats: { reactions, comments, reposts },
                metadata: { content, tags: Array.isArray(item?.metadata?.tags) ? item.metadata.tags : [] },
              } as Post;
            });
            pageInfo = value.pageInfo ?? { next: value?.next };
          }
        } else if (typeof actions.fetchPublications === "function") {
          const sdkRes = await actions.fetchPublications(session, {
            where: { from: evmAddress(viewerAddress as `0x${string}`) },
            cursor,
          } as any);
          const value = unwrapResult<SdkFeedResult>(sdkRes);
          if (value) {
            const items = value.items ?? [];
            posts = items.map((item) => {
              const authorAddr = item?.by?.ownedBy?.address || item?.by?.address || item?.author?.address || viewerAddress;
              const username = item?.by?.handle || item?.author?.username || undefined;
              const content = item?.metadata?.content || item?.content || item?.metadata?.contentUri || "";
              const createdAt = item?.createdAt || item?.timestamp || new Date().toISOString();
              const reactions = item?.stats?.reactions ?? item?.stats?.collects ?? 0;
              const comments = item?.stats?.comments ?? item?.stats?.replies ?? 0;
              const reposts = item?.stats?.mirrors ?? item?.stats?.quotes ?? 0;

              return {
                id: String(item?.id ?? item?.publicationId ?? cryptoRandomId()),
                content,
                author: {
                  id: String(item?.by?.id ?? authorAddr ?? ""),
                  address: String(authorAddr ?? ""),
                  username: username ? { localName: String(username), fullHandle: String(username) } : undefined,
                  metadata: { name: item?.by?.metadata?.name || item?.author?.name, picture: item?.by?.metadata?.picture || item?.author?.avatar },
                },
                timestamp: createdAt,
                stats: { reactions, comments, reposts },
                metadata: { content, tags: Array.isArray(item?.metadata?.tags) ? item.metadata.tags : [] },
              } as Post;
            });
            pageInfo = value.pageInfo ?? { next: value?.next };
          }
        }
      } catch (sdkError) {
        console.warn("Lens SDK feed fetch unavailable, falling back to backend:", sdkError);
      }

      if (!posts || posts.length === 0) {
        const apiResult = await fetchTimelineFromAPI(viewerAddress);
        posts = (apiResult.items || []).map((p: Record<string, any>) => ({
          id: p.id,
          content: p.content,
          author: {
            id: p.author.address,
            address: p.author.address,
            username: p.author.username ? { localName: p.author.username, fullHandle: p.author.username } : undefined,
            metadata: { name: p.author.name, picture: p.author.avatar },
          },
          timestamp: p.createdAt,
          stats: { reactions: p.stats?.reactions ?? 0, comments: p.stats?.comments ?? 0, reposts: p.stats?.mirrors ?? 0 },
          metadata: { content: p.content, tags: (p.metadata?.tags as string[]) || [] },
        }));
        pageInfo = { next: undefined, prev: undefined };
      }

      // In-memory dedup by id
      const deduped = posts.filter((post) => {
        if (this.seenPostIds.has(post.id)) return false;
        this.seenPostIds.add(post.id);
        return true;
      });

      const timeline: Timeline = {
        items: deduped.map((post) => ({
          ...post,
          feedReason: { type: this.determineFeedReason(post), context: this.getFeedContext(post) },
        })),
        pageInfo: { next: pageInfo?.next, prev: pageInfo?.prev, hasMore: Boolean(pageInfo?.next) },
      };

      // Cache next cursor
      this.timelineCacheNext = pageInfo?.next;

      return { success: true, data: timeline };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Timeline fetch failed" };
    }
  }

  /**
   * Follow an account
   */
  async followAccount(accountAddress: string): Promise<SocialActionResult> {
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }
    try {
      const result = await follow(session, { account: evmAddress(accountAddress as `0x${string}`) });
      if ((result as any).isErr?.()) {
        return { success: false, error: (result as any).error?.message || "Follow failed" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Follow failed" };
    }
  }

  /**
   * Unfollow an account
   */
  async unfollowAccount(accountAddress: string): Promise<SocialActionResult> {
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }
    try {
      const result = await unfollow(session, { account: evmAddress(accountAddress as `0x${string}`) });
      if ((result as any).isErr?.()) {
        return { success: false, error: (result as any).error?.message || "Unfollow failed" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unfollow failed" };
    }
  }

  // Reactions: like
  async likePost(publicationId: string): Promise<SocialActionResult> {
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) return { success: false, error: "Not authenticated" };
    try {
      const actions: any = await import("@lens-protocol/client/actions");
      const { postId } = await import("@lens-protocol/client");
      if (typeof actions.like === 'function') {
        const res = await actions.like(session, { publication: postId(publicationId) });
        if ((res as any).isErr?.()) return { success: false, error: (res as any).error?.message || "Like failed" };
        return { success: true };
      }
      if (typeof actions.addReaction === 'function') {
        const res = await actions.addReaction(session, { publication: postId(publicationId), reaction: 'UPVOTE' });
        if ((res as any).isErr?.()) return { success: false, error: (res as any).error?.message || "Reaction failed" };
        return { success: true };
      }
      return { success: false, error: "Like action unavailable" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Like failed" };
    }
  }

  // Mirror (repost)
  async mirrorPost(publicationId: string): Promise<SocialActionResult> {
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) return { success: false, error: "Not authenticated" };
    try {
      const actions: any = await import("@lens-protocol/client/actions");
      const { postId } = await import("@lens-protocol/client");
      if (typeof actions.mirror === 'function') {
        const res = await actions.mirror(session, { publication: postId(publicationId) });
        if ((res as any).isErr?.()) return { success: false, error: (res as any).error?.message || "Mirror failed" };
        return { success: true };
      }
      if (typeof actions.repost === 'function') {
        const res = await actions.repost(session, { publication: postId(publicationId) });
        if ((res as any).isErr?.()) return { success: false, error: (res as any).error?.message || "Repost failed" };
        return { success: true };
      }
      return { success: false, error: "Mirror action unavailable" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Mirror failed" };
    }
  }

  // Comment via SDK post with commentOn
  async commentOn(postIdStr: string, content: string): Promise<SocialActionResult> {
    const session = blockchainAuthService.getCurrentLensSession();
    if (!session) return { success: false, error: "Not authenticated" };
    try {
      const { createTextPostMetadata } = await import("@/lib/lens/createLensPostMetadata");
      const { uploadWithFallback } = await import("@/lib/lens/uploadToGrove");
      const actions: any = await import("@lens-protocol/client/actions");
      const { uri, postId, evmAddress } = await import("@lens-protocol/client");

      const metadata = createTextPostMetadata(content);
      const lensUri = await uploadWithFallback(metadata);

      const payload: any = { contentUri: uri(lensUri), commentOn: { post: postId(postIdStr) } };
      const authorAddr = blockchainAuthService.getAuthorAddress();
      if (authorAddr) payload.author = evmAddress(authorAddr as `0x${string}`);

      if (typeof actions.post !== 'function') return { success: false, error: "Post action unavailable" };
      const res = await actions.post(session, payload);
      if ((res as any).isErr?.()) return { success: false, error: (res as any).error?.message || "Comment failed" };
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Comment failed" };
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      this.clearLocalStorage();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.isAuthenticated = false;
      this.currentUser = null;
    }
  }

  /**
   * Get a signed session record from the vision-service
   */
  async getSignedSession(
    session: BreathingSession,
  ): Promise<SignedSessionRecord | null> {
    if (!this.currentUser?.address) return null;

    try {
      const response = await fetch(`${services.vision.url}/lens/sign-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: this.currentUser.address,
          pattern_name: session.patternName,
          duration: session.duration,
          score: session.score || 0,
          timestamp: session.completedAt,
        }),
      });

      if (!response.ok) throw new Error("Failed to sign session");
      return await response.json();
    } catch (error) {
      console.error("❌ Signing error:", error);
      return null;
    }
  }

  /**
   * Share a breathing session as a post with a verified record
   */
  async shareBreathingSession(
    session: BreathingSession,
  ): Promise<SocialActionResult> {
    if (!this.isAuthenticated) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // 1. Get a cryptographically signed record from the backend
      const signedRecord = await this.getSignedSession(session);

      // 2. Create content for breathing session
      const minutes = Math.round(session.duration / 60);
      let content = `🌬️ Just completed a ${session.patternName} breathing session!\n\n`;
      content += `⏱️ Duration: ${minutes} minute${minutes !== 1 ? "s" : ""}\n`;

      if (session.score) {
        content += `📊 Score: ${session.score}/100\n`;
      }

      if (signedRecord) {
        content += `✅ Verified by Brume\n`;
      }

      content += `\n#breathing #mindfulness #wellness #${session.patternName.toLowerCase().replace(/\s+/g, "")}`;

      // 3. Create metadata including the signed proof
      const metadata = {
        content,
        tags: [
          "breathing",
          "mindfulness",
          "wellness",
          "verified",
          session.patternName.toLowerCase().replace(/\s+/g, ""),
        ],
        attributes: [
          { key: "sessionType", value: "breathing" },
          { key: "pattern", value: session.patternName },
          { key: "duration", value: session.duration.toString() },
          { key: "verified", value: signedRecord ? "true" : "false" },
          { key: "signature", value: signedRecord?.signature || "" },
        ],
      };

      const contentUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

      // 4. Create the post on Lens
      return await this.createPost(contentUri);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to share breathing session",
      };
    }
  }


  /**
   * Determine feed reason for content discovery
   */
  private determineFeedReason(
    post: Post,
  ): "following" | "trending" | "recommended" {
    if (post.id.startsWith(IMPERFECT_BREATH_APP_ID)) return "recommended";
    if (post.id.startsWith("group-")) return "trending";
    if ((post.stats?.reactions || 0) > 20) return "trending";
    return "recommended";
  }

  /**
   * Get context for why this post was shown
   */
  private getFeedContext(post: Post): string {
    if (post.id.startsWith(IMPERFECT_BREATH_APP_ID)) {
      return "From the Brume community";
    }
    if (post.id.startsWith("group-")) {
      return "From wellness groups you might like";
    }
    if (post.id.startsWith("feed-")) {
      return "From curated mindfulness feeds";
    }
    return "Wellness content you might enjoy";
  }

  /**
   * Fallback content when curation fails
   */
  private getFallbackContent(): Post[] {
    return [
      {
        id: "fallback-1",
        content:
          "Welcome to the Brume community! 🌬️\n\nConnect your breathing practice with others on this journey of mindfulness and wellness.\n\n#community #breathing #mindfulness",
        author: {
          id: "0x0000",
          address: "0x0000000000000000000000000000000000000000",
          username: {
            localName: "imperfectbreath",
            fullHandle: "imperfectbreath.lens",
          },
          metadata: {
            name: "Brume",
          },
        },
        timestamp: new Date().toISOString(),
        stats: { reactions: 0, comments: 0, reposts: 0 },
      },
    ];
  }

  /**
   * Clear local storage
   */
  private clearLocalStorage(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("lens-session");
      localStorage.removeItem("lens-user");
    }
  }

  // Getters
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  getCurrentUser(): Account | null {
    return this.currentUser;
  }

  getSession(): {
    address: string;
    signature: string;
    authenticatedAt: number;
    expiresAt: number;
  } | null {
    return this.sessionData;
  }
}

// Export singleton instance
export const lensAPI = new LensV3API();

// Helper functions for session management
export const isClientAuthenticated = (): boolean => {
  return lensAPI.isAuth();
};

export const getCurrentSession = (): {
  address: string;
  signature: string;
  authenticatedAt: number;
  expiresAt: number;
} | null => {
  return lensAPI.getSession();
};

export const getSessionClient = (): {
  address: string;
  signature: string;
  authenticatedAt: number;
  expiresAt: number;
} | null => {
  return lensAPI.getSession();
};

export const initializeSession = async (): Promise<boolean> => {
  try {
    const result = await lensAPI.resumeSession();
    return result.success;
  } catch (error) {
    console.error("Failed to initialize session:", error);
    return false;
  }
};

// Storage helpers
export const setSession = async (tokens: LensAuthTokens): Promise<void> => {
  console.log("Session stored via client");
};

export const clearSession = async (): Promise<void> => {
  await lensAPI.logout();
};

// Mock PublicClient for external compatibility
export const publicClient: {
  login: (
    address: string,
    signMessage: (message: string) => Promise<string>,
  ) => Promise<SocialActionResult>;
  logout: () => Promise<void>;
  resumeSession: () => Promise<SocialActionResult>;
} = {
  login: lensAPI.login.bind(lensAPI),
  logout: lensAPI.logout.bind(lensAPI),
  resumeSession: lensAPI.resumeSession.bind(lensAPI),
};
