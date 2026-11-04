/**
 * The account shape the app reads after an email sign-in.
 *
 * This used to live in `blockchain.ts` next to Lens accounts, wallet
 * connections and transaction types. None of that ships; what is left is the
 * profile row and what the practice needs from it.
 */
export type UserRole = "user" | "creator" | "instructor";

export interface UserProfile {
  username?: string;
  name?: string;
  avatar?: string;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    website?: string;
  };
}

export interface User {
  id: string;
  email?: string;
  role: UserRole;
  creator_verified: boolean;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}
